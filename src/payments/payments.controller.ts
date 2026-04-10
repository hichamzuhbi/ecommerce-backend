import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiBody,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CreatePaymentResponseDto } from './dto/create-payment-response.dto';
import { PaymentStatusResponseDto } from './dto/payment-status-response.dto';
import { Request } from 'express';

@ApiTags('payments')
@Controller('payments')
@ApiBearerAuth()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Initiate payment for an order' })
  @ApiOkResponse({ type: CreatePaymentResponseDto })
  create(
    @CurrentUser() user: { id: string },
    @Body() createPaymentDto: CreatePaymentDto,
  ): Promise<CreatePaymentResponseDto> {
    return this.paymentsService.create(user.id, createPaymentDto);
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Get payment status by order ID' })
  @ApiOkResponse({ type: PaymentStatusResponseDto })
  findByOrderId(
    @CurrentUser() user: { id: string },
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
  ): Promise<PaymentStatusResponseDto> {
    return this.paymentsService.findByOrderId(user.id, orderId);
  }

  @Post('webhook')
  @Public()
  @ApiOperation({ summary: 'Webhook callback from payment provider' })
  @ApiHeader({
    name: 'stripe-signature',
    required: true,
    description: 'HMAC signature for the raw webhook payload',
  })
  @ApiBody({
    schema: {
      example: {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_1234567890',
            status: 'succeeded',
            metadata: {
              paymentId: 'payment-uuid',
            },
          },
        },
      },
    },
  })
  webhook(
    @Headers('stripe-signature') signature: string,
    @Req() request: Request & { rawBody?: Buffer },
  ) {
    return this.paymentsService.processWebhook(request.rawBody, signature);
  }
}
