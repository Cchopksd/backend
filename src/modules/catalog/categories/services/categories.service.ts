import { Injectable } from '@nestjs/common';
import { CatalogConflictError, CatalogInvalidStateError, CatalogNotFoundError } from '../../errors/catalog.error.js';
import { toPageResult, type PageResult } from '../../dto/pagination.dto.js';
import type { CategoryQueryDto, CategoryResponseDto, CreateCategoryDto, UpdateCategoryDto } from '../dto/category.dto.js';
import { CategoriesRepository, type CategoryRecord } from '../repositories/categories.repository.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly repository: CategoriesRepository) {}
  async create(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    if (dto.parentId && !(await this.repository.findById(dto.parentId))) throw new CatalogNotFoundError('Parent category');
    return this.map(await this.repository.create(dto));
  }
  async findOne(id: string): Promise<CategoryResponseDto> { return this.map(await this.require(id)); }
  async list(query: CategoryQueryDto): Promise<PageResult<CategoryResponseDto>> { const result = await this.repository.list(query); return toPageResult(result.items.map((item) => this.map(item)), result.total, query); }
  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryResponseDto> {
    if (dto.parentId === id) throw new CatalogInvalidStateError('A category cannot be its own parent');
    if (dto.parentId && !(await this.repository.findById(dto.parentId))) throw new CatalogNotFoundError('Parent category');
    const category = await this.repository.update(id, dto); if (!category) throw new CatalogNotFoundError('Category'); return this.map(category);
  }
  async remove(id: string): Promise<void> {
    await this.require(id);
    if (await this.repository.hasChildrenOrProducts(id)) throw new CatalogConflictError('Categories with children or products cannot be deleted');
    await this.repository.delete(id);
  }
  private async require(id: string): Promise<CategoryRecord> { const category = await this.repository.findById(id); if (!category) throw new CatalogNotFoundError('Category'); return category; }
  private map(record: CategoryRecord): CategoryResponseDto { return { ...record, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() }; }
}
