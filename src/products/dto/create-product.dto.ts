import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

const normalizeImageUrls = (value: unknown): string[] | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const rawValues = Array.isArray(value) ? value : [value];
  const normalized = rawValues
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return Array.from(new Set(normalized));
};

const normalizeBoolean = (value: unknown): unknown => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue === 'true') {
      return true;
    }

    if (normalizedValue === 'false') {
      return false;
    }
  }

  return value;
};

export class CreateProductDto {
  @ApiProperty({ example: 'iPhone 15 Pro' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'iphone-15-pro' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({ example: 'Latest iPhone model with advanced features' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 999.99 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price: number;

  @ApiPropertyOptional({ example: 1199.99 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  comparePrice?: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  stock: number;

  @ApiProperty({ example: 'IPH-15-PRO-001' })
  @IsString()
  @IsNotEmpty()
  sku: string;

  @ApiPropertyOptional({ example: ['https://example.com/image1.jpg'] })
  @Transform(
    ({ value, obj }: { value: unknown; obj: Record<string, unknown> }) =>
      normalizeImageUrls(value ?? obj['imageUrl'] ?? obj['image']),
  )
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  imageUrls?: string[];

  @ApiPropertyOptional({
    example: 'https://example.com/image1.jpg',
    deprecated: true,
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/image1.jpg',
    deprecated: true,
  })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiPropertyOptional({ example: true })
  @Transform(({ value }: { value: unknown }) => normalizeBoolean(value))
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ example: 'uuid-of-category' })
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;
}
