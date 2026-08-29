import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service.js';
import type { PricedSku } from '../types/pricing.type.js';

@Injectable()
export class PricingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPricedSkus(skuIds: string[]): Promise<PricedSku[]> {
    if (skuIds.length === 0) return [];
    const ids = Prisma.join(skuIds.map((skuId) => Prisma.sql`${skuId}::uuid`));
    return this.prisma.$queryRaw<PricedSku[]>(Prisma.sql`
      SELECT sku."id" AS "skuId", product."id" AS "productId", product."categoryId", sku."priceAmount" AS "unitPriceAmount", sku."currency"
      FROM "SKU" sku JOIN "Variant" variant ON variant."id" = sku."variantId"
      JOIN "Product" product ON product."id" = variant."productId"
      JOIN "Seller" seller ON seller."id" = product."sellerId"
      WHERE sku."id" IN (${ids}) AND sku."isActive" = true
        AND product."status" = 'ACTIVE'::"ProductStatus" AND seller."status" = 'ACTIVE'::"SellerStatus"`);
  }
}
