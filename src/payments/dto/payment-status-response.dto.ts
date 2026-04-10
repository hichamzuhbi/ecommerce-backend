import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod, PaymentStatusEnum } from '../entities/payment.entity';

export class PaymentStatusResponseDto {
  @ApiProperty({ example: 'order-uuid' })
  orderId!: string;

  @ApiProperty({ example: 'payment-uuid' })
  paymentId!: string;

  @ApiProperty({ enum: PaymentStatusEnum, example: PaymentStatusEnum.PENDING })
  paymentStatus!: PaymentStatusEnum;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CREDIT_CARD })
  method!: PaymentMethod;
}
