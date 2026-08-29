import { CouponService } from '../services/coupon.service.js';
import type { Coupon } from '../types/coupon.type.js';

describe('CouponService', () => {
  const now = new Date('2026-08-29T12:00:00.000Z');
  const coupon: Coupon = {
    id: 'coupon-id',
    code: 'SAVE20',
    type: 'PERCENTAGE',
    value: 20,
    minimumSpendAmount: 1_000,
    maximumDiscountAmount: 300,
    usageLimit: 10,
    usageCount: 0,
    perUserLimit: 2,
    startsAt: new Date('2026-08-01T00:00:00.000Z'),
    endsAt: new Date('2026-09-01T00:00:00.000Z'),
    status: 'ACTIVE',
    restrictions: { categoryIds: ['category-a'] },
  };
  const repository = {
    findByCode: vi.fn(),
    findById: vi.fn(),
    countUserUsage: vi.fn(),
    redeem: vi.fn(),
  };
  const service = new CouponService(repository);

  beforeEach(() => {
    vi.clearAllMocks();
    repository.findByCode.mockResolvedValue(coupon);
    repository.countUserUsage.mockResolvedValue(0);
  });

  it('calculates percentage discounts from eligible category items and applies the maximum discount', async () => {
    const result = await service.evaluate({
      code: ' save20 ',
      userId: 'user-id',
      now,
      items: [
        {
          productId: 'product-a',
          categoryId: 'category-a',
          unitPriceAmount: 2_000,
          quantity: 1,
        },
        {
          productId: 'product-b',
          categoryId: 'category-b',
          unitPriceAmount: 500,
          quantity: 1,
        },
      ],
    });

    expect(repository.findByCode).toHaveBeenCalledWith('SAVE20');
    expect(result).toMatchObject({
      state: 'eligible',
      applicableSubtotalAmount: 2_000,
      discountAmount: 300,
    });
  });

  it('uses the entire cart subtotal for minimum spend but rejects carts without eligible products', async () => {
    const result = await service.evaluate({
      code: 'SAVE20',
      userId: 'user-id',
      now,
      items: [
        {
          productId: 'product-b',
          categoryId: 'category-b',
          unitPriceAmount: 1_500,
          quantity: 1,
        },
      ],
    });

    expect(result).toMatchObject({
      state: 'ineligible',
      reason: 'NO_ELIGIBLE_ITEMS',
      discountAmount: 0,
    });
  });

  it('reports coupon lifecycle and usage states without calculating a discount', async () => {
    repository.findByCode.mockResolvedValue({ ...coupon, usageCount: 10 });
    const exhausted = await service.evaluate({
      code: 'SAVE20',
      userId: 'user-id',
      now,
      items: [],
    });
    repository.findByCode.mockResolvedValue({ ...coupon, endsAt: now });
    const expired = await service.evaluate({
      code: 'SAVE20',
      userId: 'user-id',
      now,
      items: [],
    });

    expect(exhausted).toMatchObject({
      state: 'exhausted',
      reason: 'USAGE_LIMIT_REACHED',
    });
    expect(expired).toMatchObject({
      state: 'expired',
      reason: 'COUPON_EXPIRED',
    });
  });

  it('treats duplicate redemption references as an idempotent success', async () => {
    repository.findById.mockResolvedValue(coupon);
    repository.redeem.mockResolvedValue('DUPLICATE');

    await expect(
      service.redeem({
        couponId: 'coupon-id',
        userId: 'user-id',
        referenceId: 'order-id',
        now,
      }),
    ).resolves.toBeUndefined();
  });
});
