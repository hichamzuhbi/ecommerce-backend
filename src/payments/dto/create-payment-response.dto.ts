import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatusEnum } from '../entities/payment.entity';

export class CreatePaymentResponseDto {
  @ApiProperty({ enum: PaymentStatusEnum, example: PaymentStatusEnum.PENDING })
  status!: PaymentStatusEnum;

  @ApiProperty({ example: 'payment-uuid' })
  paymentId!: string;

  @ApiPropertyOptional({
    example: 'https://example.com/payments/checkout/payment-uuid',
  })
  paymentUrl?: string;

  @ApiPropertyOptional({ example: 'mock_secret_123456' })
  clientSecret?: string;
}
