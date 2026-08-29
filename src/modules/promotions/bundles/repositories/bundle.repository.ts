import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service.js';
import type {
  Bundle,
  BundleItem,
  BundleSkuAvailability,
} from '../types/bundle.type.js';

type BundleRow = Omit<Bundle, 'items'> & { items: unknown };

@Injectable()
export class BundleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Bundle | null> {
    const rows = await this.prisma.$queryRaw<BundleRow[]>`
      SELECT "id", "name", "bundlePriceAmount", "currency", "status", "startsAt", "endsAt", "items"
      FROM "Bundle" WHERE "id" = ${id}::uuid LIMIT 1`;
    return rows[0] ? this.toBundle(rows[0]) : null;
  }

  async findSkuAvailability(
    skuIds: string[],
  ): Promise<BundleSkuAvailability[]> {
    if (skuIds.length === 0) return [];
    const ids = Prisma.join(skuIds.map((skuId) => Prisma.sql`${skuId}::uuid`));
    return this.prisma.$queryRaw<BundleSkuAvailability[]>(Prisma.sql`
      SELECT sku."id" AS "skuId",
             GREATEST(COALESCE(inventory."availableQuantity" - inventory."flashSaleAllocation", 0), 0) AS "availableQuantity"
      FROM "SKU" sku
      JOIN "Variant" variant ON variant."id" = sku."variantId"
      JOIN "Product" product ON product."id" = variant."productId"
      JOIN "Seller" seller ON seller."id" = product."sellerId"
      LEFT JOIN "Inventory" inventory ON inventory."skuId" = sku."id"
      WHERE sku."id" IN (${ids})
        AND sku."isActive" = true
        AND product."status" = 'ACTIVE'::"ProductStatus"
        AND seller."status" = 'ACTIVE'::"SellerStatus"`);
  }

  private toBundle(row: BundleRow): Bundle {
    return { ...row, items: this.items(row.items) };
  }

  private items(value: unknown): BundleItem[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
      const candidate = item as Record<string, unknown>;
      return typeof candidate.skuId === 'string' &&
        typeof candidate.quantity === 'number' &&
        Number.isSafeInteger(candidate.quantity) &&
        candidate.quantity > 0
        ? [{ skuId: candidate.skuId, quantity: candidate.quantity }]
        : [];
    });
  }
}
