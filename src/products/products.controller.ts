import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { plainToInstance } from 'class-transformer';
import { ValidationError, validateSync } from 'class-validator';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { RolesGuard } from '../common/guards/roles.guard';
import { multerOptions } from '../uploads/multer.config';

interface UploadedImageFile {
  filename: string;
}

interface UploadedImageFields {
  image?: UploadedImageFile[];
  images?: UploadedImageFile[];
}

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create product (Admin only)' })
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        slug: { type: 'string' },
        description: { type: 'string' },
        price: { type: 'number' },
        comparePrice: { type: 'number' },
        stock: { type: 'number' },
        sku: { type: 'string' },
        categoryId: { type: 'string', format: 'uuid' },
        imageUrls: {
          type: 'array',
          items: { type: 'string' },
        },
        imageUrl: { type: 'string' },
        image: {
          oneOf: [{ type: 'string' }, { type: 'string', format: 'binary' }],
        },
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
      required: [
        'name',
        'slug',
        'description',
        'price',
        'stock',
        'sku',
        'categoryId',
      ],
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'image', maxCount: 1 },
        { name: 'images', maxCount: 5 },
      ],
      multerOptions as unknown as MulterOptions,
    ),
  )
  create(
    @Body() rawBody: Record<string, unknown>,
    @UploadedFiles() files?: UploadedImageFields,
  ) {
    const createProductDto = this.buildCreateProductDto(rawBody, files);
    return this.productsService.create(createProductDto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all products with filters (Public)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'minPrice', required: false, type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['price', 'createdAt', 'name'],
  })
  @ApiQuery({ name: 'order', required: false, enum: ['ASC', 'DESC'] })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('category') category?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('order') order?: 'ASC' | 'DESC',
  ) {
    return this.productsService.findAll({
      page,
      limit,
      category,
      minPrice: minPrice ? +minPrice : undefined,
      maxPrice: maxPrice ? +maxPrice : undefined,
      search,
      sortBy,
      order,
    });
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get product by ID (Public)' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update product (Admin only)' })
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Patch(':id/stock')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update product stock (Admin only)' })
  updateStock(@Param('id') id: string, @Body() updateStockDto: UpdateStockDto) {
    return this.productsService.updateStock(id, updateStockDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete product (Admin only)' })
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  private buildCreateProductDto(
    rawBody: Record<string, unknown>,
    files?: UploadedImageFields,
  ): CreateProductDto {
    const payload = this.unwrapPayload(rawBody);

    const existingImageUrls = payload.imageUrls;
    const currentImageUrls = Array.isArray(existingImageUrls)
      ? existingImageUrls.filter(
          (item): item is string => typeof item === 'string',
        )
      : typeof existingImageUrls === 'string'
        ? [existingImageUrls]
        : [];

    const uploadedImages = [
      ...(files?.image ?? []),
      ...(files?.images ?? []),
    ].map((file) => `http://localhost:3000/uploads/${file.filename}`);

    if (uploadedImages.length > 0) {
      payload.imageUrls = Array.from(
        new Set([...currentImageUrls, ...uploadedImages]),
      );
    }

    const dto = plainToInstance(CreateProductDto, payload);
    const validationErrors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (validationErrors.length > 0) {
      throw new BadRequestException(
        this.formatValidationErrors(validationErrors),
      );
    }

    return dto;
  }

  private unwrapPayload(
    rawBody: Record<string, unknown>,
  ): Record<string, unknown> {
    const wrapperKeys = ['product', 'data', 'payload'];

    for (const key of wrapperKeys) {
      const wrappedValue = rawBody[key];

      if (
        wrappedValue &&
        typeof wrappedValue === 'object' &&
        !Array.isArray(wrappedValue)
      ) {
        return wrappedValue as Record<string, unknown>;
      }
    }

    return rawBody;
  }

  private formatValidationErrors(errors: ValidationError[]): string[] {
    const messages: string[] = [];

    for (const error of errors) {
      if (error.constraints) {
        messages.push(...Object.values(error.constraints));
      }

      if (error.children && error.children.length > 0) {
        messages.push(...this.formatValidationErrors(error.children));
      }
    }

    return messages;
  }
}
