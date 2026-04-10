import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod, PaymentStatusEnum } from '../entities/payment.entity';
import { PaymentStatus } from '../../orders/entities/order.entity';

export class PaymentStatusResponseDto {
  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.UNPAID })
  paymentStatus!: PaymentStatus;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CREDIT_CARD })
  method!: PaymentMethod;

  @ApiProperty({ enum: PaymentStatusEnum, example: PaymentStatusEnum.PENDING })
  status!: PaymentStatusEnum;
}
