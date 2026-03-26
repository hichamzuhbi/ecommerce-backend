import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { Category } from '../categories/entities/category.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateStockDto } from './dto/update-stock.dto';

interface ProductFilters {
  page?: number;
  limit?: number;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  sortBy?: string;
  order?: 'ASC' | 'DESC';
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  async create(createProductDto: CreateProductDto) {
    const { categoryId, imageUrls, imageUrl, image, ...productData } =
      createProductDto;

    const existingProduct = await this.productRepository.findOne({
      where: [{ slug: productData.slug }, { sku: productData.sku }],
    });

    if (existingProduct) {
      throw new ConflictException('Product slug or SKU already exists');
    }

    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const normalizedImageUrls = this.normalizeImageUrls(
      imageUrls,
      imageUrl,
      image,
    );

    const product = this.productRepository.create({
      ...productData,
      imageUrls: normalizedImageUrls,
      category,
    });

    return this.productRepository.save(product);
  }

  async findAll(filters: ProductFilters) {
    const {
      page = 1,
      limit = 10,
      category,
      minPrice,
      maxPrice,
      search,
      sortBy = 'createdAt',
      order = 'DESC',
    } = filters;

    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.isActive = :isActive', { isActive: true });

    if (category) {
      queryBuilder.andWhere('category.id = :categoryId', {
        categoryId: category,
      });
    }

    if (minPrice !== undefined) {
      queryBuilder.andWhere('product.price >= :minPrice', { minPrice });
    }

    if (maxPrice !== undefined) {
      queryBuilder.andWhere('product.price <= :maxPrice', { maxPrice });
    }

    if (search) {
      queryBuilder.andWhere(
        '(product.name ILIKE :search OR product.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const validSortFields = ['price', 'createdAt', 'name'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';

    queryBuilder
      .orderBy(`product.${sortField}`, order)
      .skip((page - 1) * limit)
      .take(limit);

    const [products, total] = await queryBuilder.getManyAndCount();

    return {
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['category'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.findOne(id);

    const { categoryId, imageUrls, imageUrl, image, ...updateData } =
      updateProductDto;

    if (updateData.slug || updateData.sku) {
      const existingProduct = await this.productRepository.findOne({
        where: [{ slug: updateData.slug }, { sku: updateData.sku }],
      });

      if (existingProduct && existingProduct.id !== id) {
        throw new ConflictException('Product slug or SKU already exists');
      }
    }

    if (categoryId) {
      const category = await this.categoryRepository.findOne({
        where: { id: categoryId },
      });

      if (!category) {
        throw new NotFoundException('Category not found');
      }

      product.category = category;
    }

    const normalizedImageUrls = this.normalizeImageUrls(
      imageUrls,
      imageUrl,
      image,
    );

    Object.assign(product, updateData);

    if (normalizedImageUrls !== undefined) {
      product.imageUrls = normalizedImageUrls;
    }

    return this.productRepository.save(product);
  }

  async updateStock(id: string, updateStockDto: UpdateStockDto) {
    const product = await this.findOne(id);
    product.stock = updateStockDto.stock;
    return this.productRepository.save(product);
  }

  async remove(id: string) {
    const product = await this.findOne(id);
    await this.productRepository.remove(product);

    return {
      message: 'Product deleted successfully',
    };
  }

  private normalizeImageUrls(
    imageUrls?: string[],
    imageUrl?: string,
    image?: string,
  ): string[] | undefined {
    const hasExplicitImageValue =
      imageUrls !== undefined || imageUrl !== undefined || image !== undefined;

    if (!hasExplicitImageValue) {
      return undefined;
    }

    const rawValues = [...(imageUrls ?? []), imageUrl, image];
    const normalized = rawValues
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    return Array.from(new Set(normalized));
  }
}
