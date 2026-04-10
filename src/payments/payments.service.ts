import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import {
  Payment,
  PaymentMethod,
  PaymentStatusEnum,
} from './entities/payment.entity';
import {
  Order,
  PaymentStatus,
  OrderStatus,
} from '../orders/entities/order.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreatePaymentResponseDto } from './dto/create-payment-response.dto';
import { PaymentStatusResponseDto } from './dto/payment-status-response.dto';

interface WebhookPayload {
  type?: string;
  data?: {
    object?: {
      id?: string;
      status?: string;
      metadata?: {
        paymentId?: string;
        orderId?: string;
      };
    };
  };
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    userId: string,
    createPaymentDto: CreatePaymentDto,
  ): Promise<CreatePaymentResponseDto> {
    const order = await this.orderRepository.findOne({
      where: { id: createPaymentDto.orderId },
      relations: ['user', 'payment'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.user.id !== userId) {
      throw new ForbiddenException('You can only pay for your own orders');
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new ConflictException('Order already paid');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot pay for cancelled order');
    }

    const payment = await this.dataSource.transaction(async (manager) => {
      const paymentRepository = manager.getRepository(Payment);
      const record = order.payment
        ? await paymentRepository.findOne({
            where: { id: order.payment.id },
            relations: ['order'],
          })
        : paymentRepository.create({ order });

      if (!record) {
        throw new NotFoundException('Payment record not available');
      }

      record.order = order;
      record.amount = order.totalAmount;
      record.method = createPaymentDto.method;
      record.status = PaymentStatusEnum.PENDING;
      record.transactionId = null;
      record.providerEventId = null;
      record.providerReference =
        createPaymentDto.method === PaymentMethod.CREDIT_CARD
          ? `pi_${randomUUID()}`
          : null;

      return paymentRepository.save(record);
    });

    const response: CreatePaymentResponseDto = {
      status: PaymentStatusEnum.PENDING,
      paymentId: payment.id,
    };

    if (createPaymentDto.method === PaymentMethod.CREDIT_CARD) {
      response.clientSecret = this.buildClientSecret(payment.id);
      response.paymentUrl = this.buildPaymentUrl(payment.id);
    }

    this.logger.log(
      `Payment created paymentId=${payment.id} orderId=${order.id} method=${createPaymentDto.method}`,
    );

    return response;
  }

  async findByOrderId(
    userId: string,
    orderId: string,
  ): Promise<PaymentStatusResponseDto> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['user', 'payment'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.user.id !== userId) {
      throw new ForbiddenException('You can only view your own payments');
    }

    if (!order.payment) {
      throw new NotFoundException('Payment not found for this order');
    }

    return {
      orderId: order.id,
      paymentId: order.payment.id,
      paymentStatus: order.payment.status,
      method: order.payment.method,
    };
  }

  async processWebhook(rawBody: Buffer | undefined, signature: string) {
    if (!rawBody || rawBody.length === 0) {
      throw new BadRequestException('Missing webhook payload');
    }

    if (!signature) {
      throw new BadRequestException('Missing payment signature');
    }

    const payload = this.verifyWebhookSignature(rawBody, signature);
    const eventType = payload.type;
    const providerObject = payload.data?.object;
    const paymentId = providerObject?.metadata?.paymentId;

    if (!paymentId) {
      throw new BadRequestException('Webhook payload missing paymentId');
    }

    if (!eventType) {
      throw new BadRequestException('Webhook event type is required');
    }

    const isSuccess =
      eventType === 'payment_intent.succeeded' ||
      providerObject?.status === 'succeeded';
    const isFailure =
      eventType === 'payment_intent.payment_failed' ||
      providerObject?.status === 'failed';

    if (!isSuccess && !isFailure) {
      throw new BadRequestException('Unsupported webhook event');
    }

    return this.dataSource.transaction(async (manager) => {
      const paymentRepository = manager.getRepository(Payment);
      const orderRepository = manager.getRepository(Order);

      const payment = await paymentRepository.findOne({
        where: { id: paymentId },
        relations: ['order'],
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      payment.providerEventId = providerObject?.id ?? payment.providerEventId;

      if (isSuccess) {
        payment.status = PaymentStatusEnum.SUCCESS;
        payment.order.paymentStatus = PaymentStatus.PAID;
        payment.order.status = OrderStatus.CONFIRMED;
      } else {
        payment.status = PaymentStatusEnum.FAILED;
        payment.order.paymentStatus = PaymentStatus.UNPAID;
      }

      await paymentRepository.save(payment);
      await orderRepository.save(payment.order);

      this.logger.log(
        `Webhook processed paymentId=${payment.id} orderId=${payment.order.id} status=${payment.status}`,
      );

      return {
        received: true,
        paymentId: payment.id,
        paymentStatus: payment.status,
      };
    });
  }

  private buildPaymentUrl(paymentId: string) {
    const appUrl = (process.env.APP_URL ?? 'http://localhost:3000').replace(
      /\/$/,
      '',
    );

    return `${appUrl}/payments/checkout/${paymentId}`;
  }

  private buildClientSecret(paymentId: string) {
    return `mock_secret_${this.sign(`${paymentId}:client_secret`)}`;
  }

  private verifyWebhookSignature(rawBody: Buffer, signatureHeader: string) {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET ?? 'mock-payment-secret';

    const parts = signatureHeader
      .split(',')
      .reduce<Record<string, string>>((accumulator, part) => {
        const [key, value] = part.trim().split('=');

        if (key && value) {
          accumulator[key] = value;
        }

        return accumulator;
      }, {});

    const timestamp = parts.t;
    const signature = parts.v1;

    if (!timestamp || !signature) {
      throw new BadRequestException('Invalid payment signature');
    }

    const timestampValue = Number(timestamp);
    const signedPayload = `${timestampValue}.${rawBody.toString('utf8')}`;
    const expectedSignature = createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const providedBuffer = Buffer.from(signature, 'hex');

    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      throw new BadRequestException('Invalid payment signature');
    }

    const ageSeconds = Math.floor(Date.now() / 1000) - timestampValue;
    if (Number.isNaN(ageSeconds) || Math.abs(ageSeconds) > 300) {
      throw new BadRequestException('Expired payment signature');
    }

    try {
      return payloadFromBuffer(rawBody);
    } catch {
      throw new BadRequestException('Invalid webhook payload');
    }
  }

  private sign(value: string) {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET ?? 'mock-payment-secret';
    return createHmac('sha256', secret)
      .update(value)
      .digest('hex')
      .slice(0, 24);
  }
}

function payloadFromBuffer(rawBody: Buffer): WebhookPayload {
  return JSON.parse(rawBody.toString('utf8')) as WebhookPayload;
}
