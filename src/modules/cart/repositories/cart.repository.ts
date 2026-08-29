import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';

export type CartSkuRecord = {
  skuId: string;
  skuActive: boolean;
  productActive: boolean;
  sellerActive: boolean;
  availableQuantity: number;
};

export type CartItemRecord = {
  id: string;
  skuId: string;
  quantity: number;
  selected: boolean;
  skuCode: string;
  productId: string;
  productName: string;
  productMedia: unknown;
  variantName: string;
  sellerId: string;
  sellerName: string;
  unitPriceAmount: number;
  currency: string;
  skuActive: boolean;
  productActive: boolean;
  sellerActive: boolean;
  availableQuantity: number;
};

@Injectable()
export class CartRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findSku(skuId: string): Promise<CartSkuRecord | null> {
    const rows = await this.prisma.$queryRaw<CartSkuRecord[]>`
      SELECT s."id" AS "skuId", s."isActive" AS "skuActive",
             p."status" = 'ACTIVE'::"ProductStatus" AS "productActive",
             seller."status" = 'ACTIVE'::"SellerStatus" AS "sellerActive",
             COALESCE(i."availableQuantity" - i."flashSaleAllocation", 0) AS "availableQuantity"
      FROM "SKU" s
      JOIN "Variant" v ON v."id" = s."variantId"
      JOIN "Product" p ON p."id" = v."productId"
      JOIN "Seller" seller ON seller."id" = p."sellerId"
      LEFT JOIN "Inventory" i ON i."skuId" = s."id"
      WHERE s."id" = ${skuId}::uuid
      LIMIT 1`;
    return rows[0] ?? null;
  }

  async findItem(userId: string, itemId: string): Promise<CartItemRecord | null> {
    const rows = await this.itemsQuery(userId, itemId);
    return rows[0] ?? null;
  }

  async listItems(userId: string): Promise<CartItemRecord[]> {
    return this.itemsQuery(userId);
  }

  async addItem(userId: string, skuId: string, quantity: number): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const carts = await transaction.$queryRaw<{ id: string }[]>`
        INSERT INTO "Cart" ("id", "userId", "status", "currency", "version", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), ${userId}::uuid, 'ACTIVE'::"CartStatus", 'THB', 0, NOW(), NOW())
        ON CONFLICT ("userId") DO UPDATE
          SET "status" = 'ACTIVE'::"CartStatus", "updatedAt" = NOW()
        RETURNING "id"`;
      const cartId = carts[0]!.id;
      const rows = await transaction.$queryRaw<{ id: string }[]>`
        INSERT INTO "CartItem" ("id", "cartId", "skuId", "quantity", "selected", "createdAt", "updatedAt")
        SELECT gen_random_uuid(), ${cartId}::uuid, ${skuId}::uuid, ${quantity}, true, NOW(), NOW()
        WHERE ${quantity} <= COALESCE((
          SELECT i."availableQuantity" - i."flashSaleAllocation"
          FROM "Inventory" i WHERE i."skuId" = ${skuId}::uuid
        ), 0)
        ON CONFLICT ("cartId", "skuId") DO UPDATE
          SET "quantity" = "CartItem"."quantity" + EXCLUDED."quantity",
              "selected" = true,
              "updatedAt" = NOW()
          WHERE "CartItem"."quantity" + EXCLUDED."quantity" <= COALESCE((
            SELECT i."availableQuantity" - i."flashSaleAllocation"
            FROM "Inventory" i WHERE i."skuId" = EXCLUDED."skuId"
          ), 0)
        RETURNING "id"`;
      return rows.length === 1;
    });
  }

  async updateQuantity(userId: string, itemId: string, quantity: number): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      UPDATE "CartItem" item
      SET "quantity" = ${quantity}, "updatedAt" = NOW()
      FROM "Cart" cart
      WHERE item."id" = ${itemId}::uuid
        AND item."cartId" = cart."id"
        AND cart."userId" = ${userId}::uuid
        AND cart."status" = 'ACTIVE'::"CartStatus"
        AND ${quantity} <= COALESCE((
          SELECT i."availableQuantity" - i."flashSaleAllocation"
          FROM "Inventory" i WHERE i."skuId" = item."skuId"
        ), 0)
      RETURNING item."id"`;
    return rows.length === 1;
  }

  async setItemSelection(userId: string, itemId: string, selected: boolean): Promise<boolean> {
    const result = await this.prisma.$executeRaw`
      UPDATE "CartItem" item
      SET "selected" = ${selected}, "updatedAt" = NOW()
      FROM "Cart" cart
      WHERE item."id" = ${itemId}::uuid
        AND item."cartId" = cart."id"
        AND cart."userId" = ${userId}::uuid
        AND cart."status" = 'ACTIVE'::"CartStatus"`;
    return result === 1;
  }

  async setAllSelection(userId: string, selected: boolean): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "CartItem" item
      SET "selected" = ${selected}, "updatedAt" = NOW()
      FROM "Cart" cart
      WHERE item."cartId" = cart."id"
        AND cart."userId" = ${userId}::uuid
        AND cart."status" = 'ACTIVE'::"CartStatus"`;
  }

  async removeItem(userId: string, itemId: string): Promise<boolean> {
    const result = await this.prisma.$executeRaw`
      DELETE FROM "CartItem" item
      USING "Cart" cart
      WHERE item."id" = ${itemId}::uuid
        AND item."cartId" = cart."id"
        AND cart."userId" = ${userId}::uuid
        AND cart."status" = 'ACTIVE'::"CartStatus"`;
    return result === 1;
  }

  private async itemsQuery(userId: string, itemId?: string): Promise<CartItemRecord[]> {
    return this.prisma.$queryRaw<CartItemRecord[]>`
      SELECT item."id", item."skuId", item."quantity", item."selected",
             s."code" AS "skuCode", p."id" AS "productId", p."name" AS "productName",
             p."media" AS "productMedia", v."name" AS "variantName",
             seller."id" AS "sellerId", seller."displayName" AS "sellerName",
             s."priceAmount" AS "unitPriceAmount", s."currency",
             s."isActive" AS "skuActive",
             p."status" = 'ACTIVE'::"ProductStatus" AS "productActive",
             seller."status" = 'ACTIVE'::"SellerStatus" AS "sellerActive",
             COALESCE(inventory."availableQuantity" - inventory."flashSaleAllocation", 0) AS "availableQuantity"
      FROM "CartItem" item
      JOIN "Cart" cart ON cart."id" = item."cartId"
      JOIN "SKU" s ON s."id" = item."skuId"
      JOIN "Variant" v ON v."id" = s."variantId"
      JOIN "Product" p ON p."id" = v."productId"
      JOIN "Seller" seller ON seller."id" = p."sellerId"
      LEFT JOIN "Inventory" inventory ON inventory."skuId" = s."id"
      WHERE cart."userId" = ${userId}::uuid
        AND cart."status" = 'ACTIVE'::"CartStatus"
        AND (${itemId ?? null}::uuid IS NULL OR item."id" = ${itemId ?? null}::uuid)
      ORDER BY seller."displayName", item."createdAt", item."id"`;
  }
}
