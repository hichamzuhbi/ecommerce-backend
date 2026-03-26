import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

const normalizeSingleImageUrl = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    const firstString = value.find(
      (item): item is string => typeof item === 'string',
    );
    const normalizedValue = firstString?.trim();

    return normalizedValue && normalizedValue.length > 0
      ? normalizedValue
      : undefined;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim();
    return normalizedValue.length > 0 ? normalizedValue : undefined;
  }

  return undefined;
};

export class CreateCategoryDto {
  @ApiProperty({ example: 'Electronics' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'electronics' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiPropertyOptional({ example: 'All electronic products' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/image.jpg' })
  @Transform(
    ({ value, obj }: { value: unknown; obj: Record<string, unknown> }) =>
      normalizeSingleImageUrl(value ?? obj['image'] ?? obj['imageUrls']),
  )
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/image.jpg',
    deprecated: true,
  })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiPropertyOptional({
    example: ['https://example.com/image.jpg'],
    deprecated: true,
  })
  @IsOptional()
  imageUrls?: string[];

  @ApiPropertyOptional({ example: 'uuid-of-parent-category' })
  @IsUUID()
  @IsOptional()
  parentCategoryId?: string;
}
