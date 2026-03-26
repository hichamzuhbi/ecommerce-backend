import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto) {
    const { parentCategoryId, imageUrl, image, imageUrls, ...categoryData } =
      createCategoryDto;

    const existingCategory = await this.categoryRepository.findOne({
      where: [{ name: categoryData.name }, { slug: categoryData.slug }],
    });

    if (existingCategory) {
      throw new ConflictException('Category name or slug already exists');
    }

    let parentCategory: Category | null = null;
    if (parentCategoryId) {
      parentCategory = await this.categoryRepository.findOne({
        where: { id: parentCategoryId },
      });

      if (!parentCategory) {
        throw new NotFoundException('Parent category not found');
      }
    }

    const normalizedImageUrl = this.pickImageUrl(imageUrl, image, imageUrls);

    const category = this.categoryRepository.create({
      ...categoryData,
      imageUrl: normalizedImageUrl ?? null,
      parentCategory: parentCategory ?? undefined,
    });

    return this.categoryRepository.save(category);
  }

  async findAll() {
    return this.categoryRepository.find({
      relations: ['children', 'parentCategory'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['children', 'parentCategory', 'products'],
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const category = await this.findOne(id);

    const { parentCategoryId, imageUrl, image, imageUrls, ...updateData } =
      updateCategoryDto;

    if (updateData.name || updateData.slug) {
      const existingCategory = await this.categoryRepository.findOne({
        where: [{ name: updateData.name }, { slug: updateData.slug }],
      });

      if (existingCategory && existingCategory.id !== id) {
        throw new ConflictException('Category name or slug already exists');
      }
    }

    if (parentCategoryId) {
      const parentCategory = await this.categoryRepository.findOne({
        where: { id: parentCategoryId },
      });

      if (!parentCategory) {
        throw new NotFoundException('Parent category not found');
      }

      category.parentCategory = parentCategory;
    }

    const normalizedImageUrl = this.pickImageUrl(imageUrl, image, imageUrls);

    Object.assign(category, updateData);

    if (
      imageUrl !== undefined ||
      image !== undefined ||
      imageUrls !== undefined
    ) {
      category.imageUrl = normalizedImageUrl ?? null;
    }

    return this.categoryRepository.save(category);
  }

  async remove(id: string) {
    const category = await this.findOne(id);
    await this.categoryRepository.remove(category);

    return {
      message: 'Category deleted successfully',
    };
  }

  private pickImageUrl(
    imageUrl?: string,
    image?: string,
    imageUrls?: string[],
  ): string | undefined {
    const rawValues = [imageUrl, image, ...(imageUrls ?? [])];

    return rawValues
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .find((item) => item.length > 0);
  }
}
