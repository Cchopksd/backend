import { FlashSaleReservationError } from '../errors/flash-sale.error.js';
import { FlashSaleService } from '../services/flash-sale.service.js';
import type {
  FlashSale,
  FlashSaleReservationResult,
  ReserveFlashSaleInput,
} from '../types/flash-sale.type.js';

class AtomicFlashSaleRepository {
  private allocation = 3;
  private purchasedByUser = new Map<string, number>();
  private pending: Promise<void> = Promise.resolve();
  readonly sale: FlashSale = {
    id: 'sale-id',
    name: 'Launch sale',
    status: 'ACTIVE',
    startsAt: new Date('2026-08-29T00:00:00.000Z'),
    endsAt: new Date('2026-08-30T00:00:00.000Z'),
    items: [
      {
        skuId: 'sku-id',
        specialPriceAmount: 100,
        allocationQuantity: 3,
        perUserLimit: 1,
      },
    ],
  };

  async findById(id: string): Promise<FlashSale | null> {
    return id === this.sale.id ? this.sale : null;
  }

  async findSkuAvailability(): Promise<{
    skuId: string;
    availableQuantity: number;
    flashSaleAllocation: number;
  }> {
    return {
      skuId: 'sku-id',
      availableQuantity: this.allocation,
      flashSaleAllocation: this.allocation,
    };
  }

  async reserve(
    input: ReserveFlashSaleInput,
    perUserLimit: number | null,
  ): Promise<FlashSaleReservationResult> {
    let unlock = (): void => undefined;
    const previous = this.pending;
    this.pending = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    await previous;
    try {
      const purchased = this.purchasedByUser.get(input.userId) ?? 0;
      if (perUserLimit !== null && purchased + input.quantity > perUserLimit)
        return 'PER_USER_LIMIT_REACHED';
      if (this.allocation < input.quantity) return 'SOLD_OUT';
      this.allocation -= input.quantity;
      this.purchasedByUser.set(input.userId, purchased + input.quantity);
      return 'RESERVED';
    } finally {
      unlock();
    }
  }
}

describe('FlashSaleService', () => {
  const now = new Date('2026-08-29T12:00:00.000Z');

  it('uses server time to expose scheduled and expired states', async () => {
    const repository = new AtomicFlashSaleRepository();
    const service = new FlashSaleService(repository);

    await expect(
      service.evaluate(
        'sale-id',
        'sku-id',
        new Date('2026-08-28T23:59:59.000Z'),
      ),
    ).resolves.toMatchObject({ state: 'upcoming' });
    await expect(
      service.evaluate(
        'sale-id',
        'sku-id',
        new Date('2026-08-30T00:00:00.000Z'),
      ),
    ).resolves.toMatchObject({ state: 'expired' });
  });

  it('allows only the allocated quantity under contention and enforces the per-user cap', async () => {
    const repository = new AtomicFlashSaleRepository();
    const service = new FlashSaleService(repository);
    const outcomes = await Promise.allSettled(
      Array.from({ length: 20 }, (_, index) =>
        service.reserve({
          flashSaleId: 'sale-id',
          skuId: 'sku-id',
          userId: `user-${index}`,
          quantity: 1,
          referenceId: `order-${index}`,
          idempotencyKey: `reservation-${index}`,
          now,
        }),
      ),
    );

    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled'),
    ).toHaveLength(3);
    expect(
      outcomes.filter((outcome) => outcome.status === 'rejected'),
    ).toHaveLength(17);
    await expect(
      service.evaluate('sale-id', 'sku-id', now),
    ).resolves.toMatchObject({ state: 'exhausted', reason: 'SOLD_OUT' });
    const cappedRepository = new AtomicFlashSaleRepository();
    const cappedService = new FlashSaleService(cappedRepository);
    await cappedService.reserve({
      flashSaleId: 'sale-id',
      skuId: 'sku-id',
      userId: 'repeat-user',
      quantity: 1,
      referenceId: 'order-first',
      idempotencyKey: 'reservation-first',
      now,
    });
    await expect(
      cappedService.reserve({
        flashSaleId: 'sale-id',
        skuId: 'sku-id',
        userId: 'repeat-user',
        quantity: 1,
        referenceId: 'order-repeat',
        idempotencyKey: 'reservation-repeat',
        now,
      }),
    ).rejects.toBeInstanceOf(FlashSaleReservationError);
  });
});
