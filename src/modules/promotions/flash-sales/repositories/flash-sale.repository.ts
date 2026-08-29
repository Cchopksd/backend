import { Injectable } from '@nestjs/common';
import type { Prisma as PrismaNamespace } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service.js';
import type {
  FlashSale,
  FlashSaleItem,
  FlashSaleReservationResult,
  FlashSaleSkuAvailability,
  ReserveFlashSaleInput,
} from '../types/flash-sale.type.js';

type TransactionClient = PrismaNamespace.TransactionClient;
type FlashSaleRow = Omit<FlashSale, 'items'> & { items: unknown };
class ReservationRejected extends Error {
  constructor(
    readonly result: Exclude<
      FlashSaleReservationResult,
      'RESERVED' | 'DUPLICATE'
    >,
  ) {
    super(result);
  }
}

@Injectable()
export class FlashSaleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<FlashSale | null> {
    const rows = await this.prisma.$queryRaw<FlashSaleRow[]>`
      SELECT "id", "name", "status", "startsAt", "endsAt", "items"
      FROM "FlashSale" WHERE "id" = ${id}::uuid LIMIT 1`;
    return rows[0] ? { ...rows[0], items: this.items(rows[0].items) } : null;
  }

  async findSkuAvailability(
    skuId: string,
  ): Promise<FlashSaleSkuAvailability | null> {
    const rows = await this.prisma.$queryRaw<FlashSaleSkuAvailability[]>`
      SELECT sku."id" AS "skuId", COALESCE(inventory."availableQuantity", 0) AS "availableQuantity",
             COALESCE(inventory."flashSaleAllocation", 0) AS "flashSaleAllocation"
      FROM "SKU" sku
      JOIN "Variant" variant ON variant."id" = sku."variantId"
      JOIN "Product" product ON product."id" = variant."productId"
      JOIN "Seller" seller ON seller."id" = product."sellerId"
      LEFT JOIN "Inventory" inventory ON inventory."skuId" = sku."id"
      WHERE sku."id" = ${skuId}::uuid AND sku."isActive" = true
        AND product."status" = 'ACTIVE'::"ProductStatus"
        AND seller."status" = 'ACTIVE'::"SellerStatus" LIMIT 1`;
    return rows[0] ?? null;
  }

  async reserve(
    input: ReserveFlashSaleInput,
    perUserLimit: number | null,
    now: Date,
  ): Promise<FlashSaleReservationResult> {
    try {
      return await this.prisma.$transaction((transaction) =>
        this.reserveInTransaction(transaction, input, perUserLimit, now),
      );
    } catch (error: unknown) {
      if (error instanceof ReservationRejected) return error.result;
      const duplicate = await this.findReservation(input.idempotencyKey);
      if (duplicate) return 'DUPLICATE';
      throw error;
    }
  }

  async reserveInTransaction(
    transaction: TransactionClient,
    input: ReserveFlashSaleInput,
    perUserLimit: number | null,
    now: Date,
  ): Promise<FlashSaleReservationResult> {
    if (
      await this.findReservationInTransaction(transaction, input.idempotencyKey)
    )
      return 'DUPLICATE';

    const inventory = await transaction.$queryRaw<{ skuId: string }[]>`
      UPDATE "Inventory" inventory SET "availableQuantity" = "availableQuantity" - ${input.quantity},
        "reservedQuantity" = "reservedQuantity" + ${input.quantity},
        "flashSaleAllocation" = "flashSaleAllocation" - ${input.quantity},
        "version" = "version" + 1, "updatedAt" = NOW()
      WHERE inventory."skuId" = ${input.skuId}::uuid
        AND inventory."availableQuantity" >= ${input.quantity}
        AND inventory."flashSaleAllocation" >= ${input.quantity}
        AND EXISTS (SELECT 1 FROM "FlashSale" sale WHERE sale."id" = ${input.flashSaleId}::uuid
          AND sale."status" = 'ACTIVE'::"PromotionStatus" AND sale."startsAt" <= ${now} AND sale."endsAt" > ${now})
        AND EXISTS (SELECT 1 FROM "SKU" sku JOIN "Variant" variant ON variant."id" = sku."variantId"
          JOIN "Product" product ON product."id" = variant."productId" JOIN "Seller" seller ON seller."id" = product."sellerId"
          WHERE sku."id" = inventory."skuId" AND sku."isActive" = true
            AND product."status" = 'ACTIVE'::"ProductStatus" AND seller."status" = 'ACTIVE'::"SellerStatus")
      RETURNING inventory."skuId"`;
    if (!inventory[0]) throw new ReservationRejected('SOLD_OUT');

    const purchases = await transaction.$queryRaw<{ quantity: number }[]>`
      INSERT INTO "FlashSalePurchase" ("id", "flashSaleId", "skuId", "userId", "quantity", "createdAt", "updatedAt")
      SELECT gen_random_uuid(), ${input.flashSaleId}::uuid, ${input.skuId}::uuid, ${input.userId}::uuid, ${input.quantity}, NOW(), NOW()
      WHERE ${perUserLimit}::integer IS NULL OR ${input.quantity} <= ${perUserLimit}
      ON CONFLICT ("flashSaleId", "skuId", "userId") DO UPDATE SET "quantity" = "FlashSalePurchase"."quantity" + ${input.quantity}, "updatedAt" = NOW()
        WHERE ${perUserLimit}::integer IS NULL OR "FlashSalePurchase"."quantity" + ${input.quantity} <= ${perUserLimit}
      RETURNING "quantity"`;
    if (!purchases[0]) throw new ReservationRejected('PER_USER_LIMIT_REACHED');

    await transaction.$executeRaw`
      INSERT INTO "InventoryLedger" ("id", "skuId", "type", "quantityDelta", "availableDelta", "reservedDelta", "soldDelta", "referenceType", "referenceId", "idempotencyKey", "metadata", "createdAt")
      VALUES (gen_random_uuid(), ${input.skuId}::uuid, 'RESERVE'::"LedgerType", ${-input.quantity}, ${-input.quantity}, ${input.quantity}, 0,
        'FLASH_SALE', ${input.referenceId}, ${input.idempotencyKey}, ${JSON.stringify({ channel: 'FLASH_SALE', flashSaleId: input.flashSaleId })}::jsonb, NOW())`;
    await transaction.$executeRaw`
      INSERT INTO "FlashSaleReservation" ("id", "flashSaleId", "skuId", "userId", "quantity", "referenceId", "idempotencyKey", "createdAt")
      VALUES (gen_random_uuid(), ${input.flashSaleId}::uuid, ${input.skuId}::uuid, ${input.userId}::uuid, ${input.quantity}, ${input.referenceId}, ${input.idempotencyKey}, NOW())`;
    return 'RESERVED';
  }

  private async findReservation(idempotencyKey: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<
      { id: string }[]
    >`SELECT "id" FROM "FlashSaleReservation" WHERE "idempotencyKey" = ${idempotencyKey} LIMIT 1`;
    return Boolean(rows[0]);
  }

  private async findReservationInTransaction(
    transaction: TransactionClient,
    idempotencyKey: string,
  ): Promise<boolean> {
    const rows = await transaction.$queryRaw<
      { id: string }[]
    >`SELECT "id" FROM "FlashSaleReservation" WHERE "idempotencyKey" = ${idempotencyKey} LIMIT 1`;
    return Boolean(rows[0]);
  }

  private items(value: unknown): FlashSaleItem[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
      const candidate = item as Record<string, unknown>;
      return typeof candidate.skuId === 'string' &&
        typeof candidate.specialPriceAmount === 'number' &&
        typeof candidate.allocationQuantity === 'number' &&
        Number.isSafeInteger(candidate.specialPriceAmount) &&
        candidate.specialPriceAmount >= 0 &&
        Number.isSafeInteger(candidate.allocationQuantity) &&
        candidate.allocationQuantity > 0 &&
        (candidate.perUserLimit === null ||
          (typeof candidate.perUserLimit === 'number' &&
            Number.isSafeInteger(candidate.perUserLimit) &&
            candidate.perUserLimit > 0))
        ? [
            {
              skuId: candidate.skuId,
              specialPriceAmount: candidate.specialPriceAmount,
              allocationQuantity: candidate.allocationQuantity,
              perUserLimit:
                typeof candidate.perUserLimit === 'number'
                  ? candidate.perUserLimit
                  : null,
            },
          ]
        : [];
    });
  }
}
