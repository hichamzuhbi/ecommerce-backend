/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
  ) {}

  async create(userId: string, createPaymentDto: CreatePaymentDto) {
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
      throw new BadRequestException('Order already paid');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot pay for cancelled order');
    }

    if (order.payment) {
      throw new BadRequestException('Payment already exists for this order');
    }

    const payment = this.paymentRepository.create({
      order,
      amount: order.totalAmount,
      method: createPaymentDto.method,
      transactionId: createPaymentDto.transactionId,
      status:
        createPaymentDto.method === PaymentMethod.CASH_ON_DELIVERY
          ? PaymentStatusEnum.PENDING
          : PaymentStatusEnum.COMPLETED,
    });

    await this.paymentRepository.save(payment);

    if (payment.status === PaymentStatusEnum.COMPLETED) {
      order.paymentStatus = PaymentStatus.PAID;
      order.status = OrderStatus.CONFIRMED;
      await this.orderRepository.save(order);
    }

    return payment;
  }

  async findByOrderId(userId: string, orderId: string) {
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

    return order.payment;
  }
}
