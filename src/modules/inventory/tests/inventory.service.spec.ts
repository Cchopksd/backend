import {
  InsufficientStockError,
  InvalidInventoryMutationError,
} from '../errors/inventory.error.js';
import { InventoryService } from '../services/inventory.service.js';

describe('InventoryService', () => {
  const snapshot = {
    skuId: 'sku-id',
    availableQuantity: 10,
    reservedQuantity: 0,
    soldQuantity: 0,
    flashSaleAllocation: 3,
    incomingQuantity: 0,
    version: 1,
  };
  const repository = {
    findBySkuId: vi.fn(),
    applyMutation: vi.fn(),
  };
  const service = new InventoryService(repository);
  const reference = {
    referenceType: 'ORDER',
    referenceId: 'order-id',
    idempotencyKey: 'event-id',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository.applyMutation.mockResolvedValue({
      inventory: snapshot,
      applied: true,
    });
  });

  it('reserves standard stock only from the quantity not allocated to flash sales', async () => {
    await service.reserve('sku-id', 2, 'STANDARD', reference);

    expect(repository.applyMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RESERVE',
        availableDelta: -2,
        reservedDelta: 2,
        standardAvailabilityRequired: 2,
        flashSaleAllocationDelta: 0,
      }),
    );
  });

  it('reserves flash-sale stock from the SKU allocation instead of an independent pool', async () => {
    await service.reserve('sku-id', 2, 'FLASH_SALE', reference);

    expect(repository.applyMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        availableDelta: -2,
        reservedDelta: 2,
        flashSaleAllocationDelta: -2,
        metadata: { channel: 'FLASH_SALE' },
      }),
    );
  });

  it('commits a reservation by moving reserved stock to sold stock and creates a COMMIT mutation', async () => {
    await service.commit('sku-id', 2, reference);

    expect(repository.applyMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'COMMIT',
        quantityDelta: -2,
        availableDelta: 0,
        reservedDelta: -2,
        soldDelta: 2,
      }),
    );
  });

  it('uses a target value for flash-sale allocation so concurrent requests cannot apply a stale delta', async () => {
    await service.setFlashSaleAllocation('sku-id', 5, reference);

    expect(repository.applyMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADJUSTMENT',
        flashSaleAllocationTarget: 5,
        metadata: { operation: 'FLASH_SALE_ALLOCATION', targetQuantity: 5 },
      }),
    );
    expect(repository.findBySkuId).not.toHaveBeenCalled();
  });

  it('rejects invalid quantities and mutations that would make stock negative', async () => {
    await expect(
      service.restock('sku-id', 0, reference),
    ).rejects.toBeInstanceOf(InvalidInventoryMutationError);

    repository.applyMutation.mockResolvedValue(null);
    repository.findBySkuId.mockResolvedValue(snapshot);
    await expect(
      service.reserve('sku-id', 11, 'STANDARD', reference),
    ).rejects.toBeInstanceOf(InsufficientStockError);
  });

  it('requires stable references and idempotency keys for every mutation', async () => {
    await expect(
      service.release('sku-id', 1, 'STANDARD', {
        referenceType: 'ORDER',
        referenceId: 'order-id',
        idempotencyKey: '',
      }),
    ).rejects.toBeInstanceOf(InvalidInventoryMutationError);
  });
});
