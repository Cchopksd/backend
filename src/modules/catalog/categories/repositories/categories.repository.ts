import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../database/prisma.service.js';
import type { CategoryQueryDto } from '../dto/category.dto.js';

export type CategoryRecord = { id: string; parentId: string | null; name: string; slug: string; createdAt: Date; updatedAt: Date };

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: { name: string; slug: string; parentId?: string }): Promise<CategoryRecord> {
    const rows = await this.prisma.$queryRaw<CategoryRecord[]>`
      INSERT INTO "Category" ("id", "parentId", "name", "slug", "createdAt", "updatedAt")
      VALUES (${randomUUID()}::uuid, ${input.parentId ?? null}::uuid, ${input.name}, ${input.slug}, NOW(), NOW())
      RETURNING "id", "parentId", "name", "slug", "createdAt", "updatedAt"`;
    return rows[0]!;
  }

  async findById(id: string): Promise<CategoryRecord | null> {
    const rows = await this.prisma.$queryRaw<CategoryRecord[]>`SELECT "id", "parentId", "name", "slug", "createdAt", "updatedAt" FROM "Category" WHERE "id" = ${id}::uuid LIMIT 1`;
    return rows[0] ?? null;
  }

  async list(query: CategoryQueryDto): Promise<{ items: CategoryRecord[]; total: number }> {
    const offset = (query.page - 1) * query.pageSize;
    const sortColumn = query.sortBy === 'createdAt' ? '"createdAt"' : '"name"';
    const direction = query.sortOrder === 'desc' ? 'DESC' : 'ASC';
    const sql = `SELECT "id", "parentId", "name", "slug", "createdAt", "updatedAt", COUNT(*) OVER() AS "total" FROM "Category" WHERE ($1::uuid IS NULL OR "parentId" = $1::uuid) AND ($2::text IS NULL OR "name" ILIKE $3) ORDER BY ${sortColumn} ${direction}, "id" ASC LIMIT $4 OFFSET $5`;
    const rows = await this.prisma.$queryRawUnsafe<(CategoryRecord & { total: bigint })[]>(sql, query.parentId ?? null, query.search ?? null, query.search ? `%${query.search}%` : null, query.pageSize, offset);
    return { items: rows, total: Number(rows[0]?.total ?? 0n) };
  }

  async update(id: string, input: { name?: string; slug?: string; parentId?: string }): Promise<CategoryRecord | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const rows = await this.prisma.$queryRaw<CategoryRecord[]>`
      UPDATE "Category" SET "name" = ${input.name ?? existing.name}, "slug" = ${input.slug ?? existing.slug},
      "parentId" = ${input.parentId ?? existing.parentId}::uuid, "updatedAt" = NOW()
      WHERE "id" = ${id}::uuid RETURNING "id", "parentId", "name", "slug", "createdAt", "updatedAt"`;
    return rows[0] ?? null;
  }

  async hasChildrenOrProducts(id: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS(SELECT 1 FROM "Category" WHERE "parentId" = ${id}::uuid)
      OR EXISTS(SELECT 1 FROM "Product" WHERE "categoryId" = ${id}::uuid) AS "exists"`;
    return rows[0]?.exists ?? false;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.prisma.$executeRaw`DELETE FROM "Category" WHERE "id" = ${id}::uuid`;
    return result > 0;
  }
}
