/* eslint-disable @typescript-eslint/no-unsafe-call */
import { IsNotEmpty, IsObject, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class ShippingAddressDto {
  @ApiProperty({ example: '123 Main Street' })
  @IsNotEmpty()
  street: string;

  @ApiProperty({ example: 'New York' })
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'NY' })
  @IsNotEmpty()
  state: string;

  @ApiProperty({ example: '10001' })
  @IsNotEmpty()
  zipCode: string;

  @ApiProperty({ example: 'USA' })
  @IsNotEmpty()
  country: string;
}

export class CreateOrderDto {
  @ApiProperty({
    type: ShippingAddressDto,
    example: {
      street: '123 Main Street',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'USA',
    },
  })
  @IsObject()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;
}
