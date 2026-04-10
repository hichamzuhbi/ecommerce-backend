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
import { createHmac, timingSafeEqual } from 'crypto';
import Stripe from 'stripe';
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

interface StripeCheckoutSessionResponse {
  id: string;
  url: string | null;
}

interface WebhookPayload {
  type?: string;
  data?: {
    object?: {
      id?: string;
      status?: string;
      payment_status?: string;
      metadata?: {
        paymentId?: string;
        orderId?: string;
        userId?: string;
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
      record.providerReference = null;

      return paymentRepository.save(record);
    });

    const response: CreatePaymentResponseDto = {
      status: PaymentStatusEnum.PENDING,
      paymentId: payment.id,
    };

    if (
      createPaymentDto.method !== PaymentMethod.COD &&
      this.isStripeModeEnabled()
    ) {
      const stripeSession = await this.createStripeCheckoutSession(
        payment,
        order,
        userId,
      );

      payment.providerReference = stripeSession.id;
      await this.paymentRepository.save(payment);

      if (!stripeSession.url || !stripeSession.url.startsWith('https://')) {
        throw new BadRequestException('Stripe checkout URL is invalid');
      }

      response.paymentUrl = stripeSession.url;
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
      paymentStatus: order.paymentStatus,
      method: order.payment.method,
      status: order.payment.status,
    };
  }

  async processWebhook(rawBody: Buffer | undefined, signature: string) {
    if (!rawBody || rawBody.length === 0) {
      throw new BadRequestException('Missing webhook payload');
    }

    if (!signature) {
      throw new BadRequestException('Missing payment signature');
    }

    const payload = this.getVerifiedWebhookPayload(rawBody, signature);
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
      eventType === 'checkout.session.completed' ||
      eventType === 'payment_intent.succeeded' ||
      providerObject?.status === 'succeeded' ||
      providerObject?.status === 'complete' ||
      providerObject?.status === 'paid' ||
      providerObject?.payment_status === 'paid';
    const isFailure =
      eventType === 'checkout.session.async_payment_failed' ||
      eventType === 'checkout.session.expired' ||
      eventType === 'payment_intent.payment_failed' ||
      providerObject?.status === 'failed' ||
      providerObject?.payment_status === 'unpaid';

    if (!isSuccess && !isFailure) {
      this.logger.log(`Webhook ignored eventType=${eventType}`);
      return { received: true, ignored: true };
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

  private isStripeModeEnabled() {
    return (
      (process.env.PAYMENT_PROVIDER ?? 'mock').toLowerCase() === 'stripe' &&
      Boolean(process.env.STRIPE_SECRET_KEY)
    );
  }

  private getVerifiedWebhookPayload(rawBody: Buffer, signatureHeader: string) {
    if (this.isStripeModeEnabled()) {
      const secret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!secret) {
        throw new BadRequestException('Missing STRIPE_WEBHOOK_SECRET');
      }

      try {
        const stripe = this.getStripeClient();
        const event = stripe.webhooks.constructEvent(
          rawBody,
          signatureHeader,
          secret,
        );

        const objectData = event.data.object as unknown as Record<
          string,
          unknown
        >;
        const metadata =
          (objectData.metadata as Record<string, string> | undefined) ?? {};

        return {
          type: event.type,
          data: {
            object: {
              id: typeof objectData.id === 'string' ? objectData.id : undefined,
              status:
                typeof objectData.status === 'string'
                  ? objectData.status
                  : undefined,
              payment_status:
                typeof objectData.payment_status === 'string'
                  ? objectData.payment_status
                  : undefined,
              metadata: {
                paymentId: metadata.paymentId,
                orderId: metadata.orderId,
                userId: metadata.userId,
              },
            },
          },
        } as WebhookPayload;
      } catch {
        throw new BadRequestException('Invalid Stripe webhook signature');
      }
    }

    const secret = process.env.PAYMENT_WEBHOOK_SECRET ?? 'mock-payment-secret';
    return this.verifyWebhookSignature(rawBody, signatureHeader, secret);
  }

  private async createStripeCheckoutSession(
    payment: Payment,
    order: Order,
    userId: string,
  ): Promise<StripeCheckoutSessionResponse> {
    const stripe = this.getStripeClient();

    const baseUrl = (process.env.FRONTEND_URL ?? process.env.APP_URL ?? '')
      .split(',')[0]
      ?.trim()
      ?.replace(/\/$/, '');

    if (!baseUrl || !baseUrl.startsWith('http')) {
      throw new BadRequestException(
        'Missing FRONTEND_URL/APP_URL for Stripe checkout redirects',
      );
    }

    const amountInCents = Math.round(Number(order.totalAmount) * 100);
    if (!Number.isFinite(amountInCents) || amountInCents <= 0) {
      throw new BadRequestException('Invalid order total for payment');
    }

    const paymentMethodType: 'card' | 'paypal' =
      payment.method === PaymentMethod.PAYPAL ? 'paypal' : 'card';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `${baseUrl}/payment/success?paymentId=${payment.id}`,
      cancel_url: `${baseUrl}/payment/cancel?paymentId=${payment.id}`,
      payment_method_types: [paymentMethodType],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amountInCents,
            product_data: {
              name: `Order ${order.id}`,
            },
          },
        },
      ],
      metadata: {
        paymentId: payment.id,
        orderId: order.id,
        userId,
      },
    });

    return {
      id: session.id,
      url: session.url,
    };
  }

  private getStripeClient() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new BadRequestException('Missing STRIPE_SECRET_KEY');
    }

    return new Stripe(secretKey, {
      appInfo: {
        name: 'ecommerce-backend',
      },
    });
  }

  private verifyWebhookSignature(
    rawBody: Buffer,
    signatureHeader: string,
    secret: string,
  ) {
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
}

function payloadFromBuffer(rawBody: Buffer): WebhookPayload {
  return JSON.parse(rawBody.toString('utf8')) as WebhookPayload;
}
