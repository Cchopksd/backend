import { InventoryRepository } from '../repositories/inventory.repository.js';

describe('InventoryRepository persistence integration', () => {
  const snapshot = {
    skuId: '11111111-1111-1111-1111-111111111111',
    availableQuantity: 8,
    reservedQuantity: 2,
    soldQuantity: 0,
    flashSaleAllocation: 3,
    incomingQuantity: 0,
    version: 4,
  };

  it('performs the guarded inventory update and ledger insert in one transaction', async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([snapshot]);
    const executeRaw = vi.fn().mockResolvedValue(1);
    const prisma = {
      $queryRaw: queryRaw,
      $executeRaw: executeRaw,
      $transaction: vi.fn(
        async (
          operation: (transaction: {
            $queryRaw: typeof queryRaw;
            $executeRaw: typeof executeRaw;
          }) => Promise<unknown>,
        ) => operation({ $queryRaw: queryRaw, $executeRaw: executeRaw }),
      ),
    };
    const repository = new InventoryRepository(prisma);

    const result = await repository.applyMutation({
      skuId: snapshot.skuId,
      type: 'RESERVE',
      quantityDelta: -2,
      availableDelta: -2,
      reservedDelta: 2,
      soldDelta: 0,
      standardAvailabilityRequired: 2,
      referenceType: 'ORDER',
      referenceId: 'order-id',
      idempotencyKey: 'reserve-order-id',
    });

    expect(result).toEqual({ inventory: snapshot, applied: true });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    const updateSql = String(queryRaw.mock.calls[1]?.[0]);
    expect(updateSql).toContain('UPDATE "Inventory"');
    expect(updateSql).toContain('"availableQuantity" +');
    expect(updateSql).toContain('"reservedQuantity" +');
    expect(updateSql).toContain('"flashSaleAllocation" <= "availableQuantity"');
    expect(String(executeRaw.mock.calls[0]?.[0])).toContain(
      'INSERT INTO "InventoryLedger"',
    );
  });
});
