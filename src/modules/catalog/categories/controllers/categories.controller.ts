import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../auth/decorators/roles.decorator.js';
import { FirebaseAuthGuard } from '../../../auth/guards/firebase-auth.guard.js';
import { RolesGuard } from '../../../auth/guards/roles.guard.js';
import { CategoriesService } from '../services/categories.service.js';
import { CategoryQueryDto, CategoryResponseDto, CreateCategoryDto, UpdateCategoryDto } from '../dto/category.dto.js';
import type { PageResult } from '../../dto/pagination.dto.js';

@ApiTags('catalog/categories') @Controller('categories')
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}
  @Get() @ApiOperation({ summary: 'List categories' }) @ApiOkResponse({ type: CategoryResponseDto, isArray: true }) list(@Query() query: CategoryQueryDto): Promise<PageResult<CategoryResponseDto>> { return this.service.list(query); }
  @Get(':id') @ApiOperation({ summary: 'Get a category' }) @ApiOkResponse({ type: CategoryResponseDto }) findOne(@Param('id') id: string): Promise<CategoryResponseDto> { return this.service.findOne(id); }
  @Post() @UseGuards(FirebaseAuthGuard, RolesGuard) @Roles('ADMIN') @ApiBearerAuth() @ApiCreatedResponse({ type: CategoryResponseDto }) create(@Body() dto: CreateCategoryDto): Promise<CategoryResponseDto> { return this.service.create(dto); }
  @Patch(':id') @UseGuards(FirebaseAuthGuard, RolesGuard) @Roles('ADMIN') @ApiBearerAuth() @ApiOkResponse({ type: CategoryResponseDto }) update(@Param('id') id: string, @Body() dto: UpdateCategoryDto): Promise<CategoryResponseDto> { return this.service.update(id, dto); }
  @Delete(':id') @UseGuards(FirebaseAuthGuard, RolesGuard) @Roles('ADMIN') @ApiBearerAuth() @HttpCode(HttpStatus.NO_CONTENT) @ApiNoContentResponse() async remove(@Param('id') id: string): Promise<void> { await this.service.remove(id); }
}
