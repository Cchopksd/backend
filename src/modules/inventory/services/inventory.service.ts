import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  InsufficientStockError,
  InvalidInventoryMutationError,
  InventoryNotFoundError,
} from '../errors/inventory.error.js';
import {
  InventoryRepository,
  type InventoryMutation,
} from '../repositories/inventory.repository.js';
import type {
  InventorySnapshot,
  StockChannel,
  StockReference,
} from '../types/inventory.type.js';

@Injectable()
export class InventoryService {
  constructor(private readonly repository: InventoryRepository) {}

  async getBySkuId(skuId: string): Promise<InventorySnapshot> {
    const inventory = await this.repository.findBySkuId(skuId);
    if (!inventory) throw new InventoryNotFoundError();
    return inventory;
  }

  async restock(
    skuId: string,
    quantity: number,
    reference: StockReference,
  ): Promise<InventorySnapshot> {
    this.assertPositiveQuantity(quantity);
    return this.apply({
      skuId,
      type: 'RESTOCK',
      quantityDelta: quantity,
      availableDelta: quantity,
      reservedDelta: 0,
      soldDelta: 0,
      ...reference,
    });
  }

  async reserve(
    skuId: string,
    quantity: number,
    channel: StockChannel,
    reference: StockReference,
  ): Promise<InventorySnapshot> {
    this.assertPositiveQuantity(quantity);
    return this.apply({
      skuId,
      type: 'RESERVE',
      quantityDelta: -quantity,
      availableDelta: -quantity,
      reservedDelta: quantity,
      soldDelta: 0,
      flashSaleAllocationDelta: channel === 'FLASH_SALE' ? -quantity : 0,
      standardAvailabilityRequired: channel === 'STANDARD' ? quantity : 0,
      metadata: { channel },
      ...reference,
    });
  }

  async reserveInTransaction(
    transaction: Prisma.TransactionClient,
    skuId: string,
    quantity: number,
    channel: StockChannel,
    reference: StockReference,
  ): Promise<InventorySnapshot> {
    this.assertPositiveQuantity(quantity);
    this.assertReference(reference);
    const result = await this.repository.applyMutationInTransaction(
      transaction,
      {
        skuId,
        type: 'RESERVE',
        quantityDelta: -quantity,
        availableDelta: -quantity,
        reservedDelta: quantity,
        soldDelta: 0,
        flashSaleAllocationDelta: channel === 'FLASH_SALE' ? -quantity : 0,
        standardAvailabilityRequired: channel === 'STANDARD' ? quantity : 0,
        metadata: { channel },
        ...reference,
      },
    );
    if (result) return result.inventory;
    const inventory = await this.repository.findBySkuId(skuId);
    if (!inventory) throw new InventoryNotFoundError();
    throw new InsufficientStockError();
  }

  async release(
    skuId: string,
    quantity: number,
    channel: StockChannel,
    reference: StockReference,
  ): Promise<InventorySnapshot> {
    this.assertPositiveQuantity(quantity);
    return this.apply({
      skuId,
      type: 'RELEASE',
      quantityDelta: quantity,
      availableDelta: quantity,
      reservedDelta: -quantity,
      soldDelta: 0,
      flashSaleAllocationDelta: channel === 'FLASH_SALE' ? quantity : 0,
      metadata: { channel },
      ...reference,
    });
  }

  async releaseInTransaction(
    transaction: Prisma.TransactionClient,
    skuId: string,
    quantity: number,
    channel: StockChannel,
    reference: StockReference,
  ): Promise<InventorySnapshot> {
    this.assertPositiveQuantity(quantity);
    this.assertReference(reference);
    const result = await this.repository.applyMutationInTransaction(
      transaction,
      {
        skuId,
        type: 'RELEASE',
        quantityDelta: quantity,
        availableDelta: quantity,
        reservedDelta: -quantity,
        soldDelta: 0,
        flashSaleAllocationDelta: channel === 'FLASH_SALE' ? quantity : 0,
        metadata: { channel },
        ...reference,
      },
    );
    if (result) return result.inventory;
    const inventory = await this.repository.findBySkuId(skuId);
    if (!inventory) throw new InventoryNotFoundError();
    throw new InsufficientStockError();
  }

  async commit(
    skuId: string,
    quantity: number,
    reference: StockReference,
  ): Promise<InventorySnapshot> {
    this.assertPositiveQuantity(quantity);
    return this.apply({
      skuId,
      type: 'COMMIT',
      quantityDelta: -quantity,
      availableDelta: 0,
      reservedDelta: -quantity,
      soldDelta: quantity,
      ...reference,
    });
  }

  async commitInTransaction(
    transaction: Prisma.TransactionClient,
    skuId: string,
    quantity: number,
    reference: StockReference,
  ): Promise<InventorySnapshot> {
    this.assertPositiveQuantity(quantity);
    this.assertReference(reference);
    const result = await this.repository.applyMutationInTransaction(
      transaction,
      {
        skuId,
        type: 'COMMIT',
        quantityDelta: -quantity,
        availableDelta: 0,
        reservedDelta: -quantity,
        soldDelta: quantity,
        ...reference,
      },
    );
    if (result) return result.inventory;
    const inventory = await this.repository.findBySkuId(skuId);
    if (!inventory) throw new InventoryNotFoundError();
    throw new InsufficientStockError();
  }

  async setFlashSaleAllocation(
    skuId: string,
    quantity: number,
    reference: StockReference,
  ): Promise<InventorySnapshot> {
    if (!Number.isSafeInteger(quantity) || quantity < 0)
      throw new InvalidInventoryMutationError(
        'Quantity must be a non-negative integer',
      );
    return this.apply({
      skuId,
      type: 'ADJUSTMENT',
      quantityDelta: 0,
      availableDelta: 0,
      reservedDelta: 0,
      soldDelta: 0,
      flashSaleAllocationTarget: quantity,
      metadata: {
        operation: 'FLASH_SALE_ALLOCATION',
        targetQuantity: quantity,
      },
      ...reference,
    });
  }

  private async apply(input: InventoryMutation): Promise<InventorySnapshot> {
    this.assertReference(input);
    const result = await this.repository.applyMutation(input);
    if (result) return result.inventory;
    const inventory = await this.repository.findBySkuId(input.skuId);
    if (!inventory) throw new InventoryNotFoundError();
    throw new InsufficientStockError();
  }

  private assertPositiveQuantity(quantity: number): void {
    if (!Number.isSafeInteger(quantity) || quantity <= 0)
      throw new InvalidInventoryMutationError(
        'Quantity must be a positive integer',
      );
  }

  private assertReference(reference: StockReference): void {
    if (
      !reference.referenceType ||
      !reference.referenceId ||
      !reference.idempotencyKey
    ) {
      throw new InvalidInventoryMutationError(
        'A reference type, reference ID, and idempotency key are required',
      );
    }
  }
}
