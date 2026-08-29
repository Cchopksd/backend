import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service.js';
import type { InventorySnapshot } from '../types/inventory.type.js';

type LedgerType = 'RESTOCK' | 'RESERVE' | 'RELEASE' | 'COMMIT' | 'ADJUSTMENT';
type TransactionClient = Prisma.TransactionClient;

export type InventoryMutation = {
  skuId: string;
  type: LedgerType;
  quantityDelta: number;
  availableDelta: number;
  reservedDelta: number;
  soldDelta: number;
  flashSaleAllocationDelta?: number;
  flashSaleAllocationTarget?: number;
  standardAvailabilityRequired?: number;
  referenceType: string;
  referenceId: string;
  idempotencyKey: string;
  metadata?: Prisma.InputJsonValue;
};

export type InventoryMutationResult = {
  inventory: InventorySnapshot;
  applied: boolean;
};

@Injectable()
export class InventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBySkuId(skuId: string): Promise<InventorySnapshot | null> {
    const rows = await this.prisma.$queryRaw<InventorySnapshot[]>`
      SELECT "skuId", "availableQuantity", "reservedQuantity", "soldQuantity",
             "flashSaleAllocation", "incomingQuantity", "version"
      FROM "Inventory" WHERE "skuId" = ${skuId}::uuid`;
    return rows[0] ?? null;
  }

  async applyMutation(
    input: InventoryMutation,
  ): Promise<InventoryMutationResult | null> {
    try {
      return await this.prisma.$transaction((transaction) =>
        this.applyMutationInTransaction(transaction, input),
      );
    } catch (error: unknown) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      )
        throw error;
      const existing = await this.prisma.$queryRaw<{ skuId: string }[]>`
        SELECT "skuId" FROM "InventoryLedger"
        WHERE "idempotencyKey" = ${input.idempotencyKey}
        LIMIT 1`;
      if (!existing[0] || existing[0].skuId !== input.skuId) throw error;
      const inventory = await this.findBySkuId(input.skuId);
      return inventory ? { inventory, applied: false } : null;
    }
  }

  private async applyMutationInTransaction(
    transaction: TransactionClient,
    input: InventoryMutation,
  ): Promise<InventoryMutationResult | null> {
    const existingLedger = await transaction.$queryRaw<{ skuId: string }[]>`
      SELECT "skuId" FROM "InventoryLedger"
      WHERE "idempotencyKey" = ${input.idempotencyKey}
      LIMIT 1`;

    if (existingLedger[0]) {
      if (existingLedger[0].skuId !== input.skuId)
        throw new Error('Inventory idempotency key belongs to another SKU');
      const inventory = await this.findBySkuIdInTransaction(
        transaction,
        input.skuId,
      );
      return inventory ? { inventory, applied: false } : null;
    }

    const flashSaleAllocationDelta = input.flashSaleAllocationDelta ?? 0;
    const flashSaleAllocationTarget = input.flashSaleAllocationTarget ?? null;
    const standardAvailabilityRequired =
      input.standardAvailabilityRequired ?? 0;
    const updated = await transaction.$queryRaw<InventorySnapshot[]>`
      UPDATE "Inventory"
      SET "availableQuantity" = "availableQuantity" + ${input.availableDelta},
          "reservedQuantity" = "reservedQuantity" + ${input.reservedDelta},
          "soldQuantity" = "soldQuantity" + ${input.soldDelta},
          "flashSaleAllocation" = COALESCE(${flashSaleAllocationTarget}::integer, "flashSaleAllocation" + ${flashSaleAllocationDelta}),
          "version" = "version" + 1,
          "updatedAt" = NOW()
      WHERE "skuId" = ${input.skuId}::uuid
        AND "availableQuantity" + ${input.availableDelta} >= 0
        AND "reservedQuantity" + ${input.reservedDelta} >= 0
        AND "soldQuantity" + ${input.soldDelta} >= 0
        AND COALESCE(${flashSaleAllocationTarget}::integer, "flashSaleAllocation" + ${flashSaleAllocationDelta}) >= 0
        AND COALESCE(${flashSaleAllocationTarget}::integer, "flashSaleAllocation" + ${flashSaleAllocationDelta}) <= "availableQuantity" + ${input.availableDelta}
        AND "availableQuantity" - "flashSaleAllocation" >= ${standardAvailabilityRequired}
      RETURNING "skuId", "availableQuantity", "reservedQuantity", "soldQuantity",
                "flashSaleAllocation", "incomingQuantity", "version"`;
    const inventory = updated[0];
    if (!inventory) return null;

    await transaction.$executeRaw`
      INSERT INTO "InventoryLedger" (
        "id", "skuId", "type", "quantityDelta", "availableDelta", "reservedDelta", "soldDelta",
        "referenceType", "referenceId", "idempotencyKey", "metadata", "createdAt"
      ) VALUES (
        gen_random_uuid(), ${input.skuId}::uuid, ${input.type}::"LedgerType", ${input.quantityDelta},
        ${input.availableDelta}, ${input.reservedDelta}, ${input.soldDelta}, ${input.referenceType},
        ${input.referenceId}, ${input.idempotencyKey}, ${input.metadata === undefined ? null : input.metadata}::jsonb, NOW()
      )`;
    return { inventory, applied: true };
  }

  private async findBySkuIdInTransaction(
    transaction: TransactionClient,
    skuId: string,
  ): Promise<InventorySnapshot | null> {
    const rows = await transaction.$queryRaw<InventorySnapshot[]>`
      SELECT "skuId", "availableQuantity", "reservedQuantity", "soldQuantity",
             "flashSaleAllocation", "incomingQuantity", "version"
      FROM "Inventory" WHERE "skuId" = ${skuId}::uuid`;
    return rows[0] ?? null;
  }
}
