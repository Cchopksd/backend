import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { PaginationDto } from '../../dto/pagination.dto.js';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateCategoryDto {
  @ApiProperty({ maxLength: 120 }) @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @ApiProperty({ pattern: SLUG_PATTERN.source, maxLength: 140 }) @IsString() @Matches(SLUG_PATTERN) @MaxLength(140) slug!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) @IsOptional() @IsUUID() parentId?: string;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ maxLength: 120 }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @ApiPropertyOptional({ pattern: SLUG_PATTERN.source, maxLength: 140 }) @IsOptional() @IsString() @Matches(SLUG_PATTERN) @MaxLength(140) slug?: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) @IsOptional() @IsUUID() parentId?: string;
}

export class CategoryQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() parentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) search?: string;
  @ApiPropertyOptional({ enum: ['name', 'createdAt'], default: 'name' }) @IsOptional() @IsIn(['name', 'createdAt']) sortBy: 'name' | 'createdAt' = 'name';
  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' }) @IsOptional() @IsIn(['asc', 'desc']) sortOrder: 'asc' | 'desc' = 'asc';
}

export class CategoryResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ nullable: true }) parentId!: string | null;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}
