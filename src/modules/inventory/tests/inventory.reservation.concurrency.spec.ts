import { InsufficientStockError } from '../errors/inventory.error.js';
import type {
  InventoryMutation,
  InventoryMutationResult,
} from '../repositories/inventory.repository.js';
import { InventoryService } from '../services/inventory.service.js';
import type { InventorySnapshot } from '../types/inventory.type.js';

class AtomicInventoryRepository {
  private stock: InventorySnapshot = {
    skuId: 'sku-id',
    availableQuantity: 1,
    reservedQuantity: 0,
    soldQuantity: 0,
    flashSaleAllocation: 0,
    incomingQuantity: 0,
    version: 0,
  };
  private ledger: InventoryMutation[] = [];
  private pendingMutation: Promise<void> = Promise.resolve();

  async findBySkuId(skuId: string): Promise<InventorySnapshot | null> {
    return skuId === this.stock.skuId ? { ...this.stock } : null;
  }

  async applyMutation(
    mutation: InventoryMutation,
  ): Promise<InventoryMutationResult | null> {
    let unlock = (): void => undefined;
    const previousMutation = this.pendingMutation;
    this.pendingMutation = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    await previousMutation;

    try {
      const nextAvailable =
        this.stock.availableQuantity + mutation.availableDelta;
      const nextReserved = this.stock.reservedQuantity + mutation.reservedDelta;
      const nextSold = this.stock.soldQuantity + mutation.soldDelta;
      const nextFlashSaleAllocation =
        this.stock.flashSaleAllocation +
        (mutation.flashSaleAllocationDelta ?? 0);
      const requiredStandardStock = mutation.standardAvailabilityRequired ?? 0;
      if (
        nextAvailable < 0 ||
        nextReserved < 0 ||
        nextSold < 0 ||
        nextFlashSaleAllocation < 0 ||
        nextFlashSaleAllocation > nextAvailable ||
        this.stock.availableQuantity - this.stock.flashSaleAllocation <
          requiredStandardStock
      ) {
        return null;
      }

      this.stock = {
        ...this.stock,
        availableQuantity: nextAvailable,
        reservedQuantity: nextReserved,
        soldQuantity: nextSold,
        flashSaleAllocation: nextFlashSaleAllocation,
        version: this.stock.version + 1,
      };
      this.ledger.push(mutation);
      return { inventory: { ...this.stock }, applied: true };
    } finally {
      unlock();
    }
  }

  getLedgerEntries(): readonly InventoryMutation[] {
    return this.ledger;
  }
}

describe('Inventory reservation concurrency', () => {
  it('allows exactly one of 100 concurrent reservations against one available SKU unit', async () => {
    const repository = new AtomicInventoryRepository();
    const service = new InventoryService(repository);

    const results = await Promise.allSettled(
      Array.from({ length: 100 }, (_, index) =>
        service.reserve('sku-id', 1, 'STANDARD', {
          referenceType: 'ORDER',
          referenceId: `order-${index}`,
          idempotencyKey: `reservation-${index}`,
        }),
      ),
    );

    const successes = results.filter(
      (result): result is PromiseFulfilledResult<InventorySnapshot> =>
        result.status === 'fulfilled',
    );
    const failures = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(99);
    expect(
      failures.every(
        (result) => result.reason instanceof InsufficientStockError,
      ),
    ).toBe(true);
    expect(repository.getLedgerEntries()).toHaveLength(1);
    await expect(service.getBySkuId('sku-id')).resolves.toMatchObject({
      availableQuantity: 0,
      reservedQuantity: 1,
      soldQuantity: 0,
    });
  });
});
