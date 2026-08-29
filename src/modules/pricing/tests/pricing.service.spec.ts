import { PricingService } from '../services/pricing.service.js';

describe('PricingService', () => {
  const now = new Date('2026-08-29T12:00:00.000Z');
  const repository = { findPricedSkus: vi.fn() };
  const flashSales = { evaluate: vi.fn() };
  const bundles = { evaluate: vi.fn() };
  const coupons = { evaluate: vi.fn() };
  const service = new PricingService(repository, flashSales, bundles, coupons);

  beforeEach(() => {
    vi.clearAllMocks();
    repository.findPricedSkus.mockResolvedValue([
      {
        skuId: 'sku-a',
        productId: 'product-a',
        categoryId: 'category-a',
        unitPriceAmount: 100,
        currency: 'THB',
      },
      {
        skuId: 'sku-b',
        productId: 'product-b',
        categoryId: 'category-b',
        unitPriceAmount: 200,
        currency: 'THB',
      },
    ]);
    flashSales.evaluate.mockResolvedValue({
      state: 'eligible',
      availableQuantity: 1,
      specialPriceAmount: 80,
    });
    bundles.evaluate.mockResolvedValue({
      state: 'eligible',
      availableQuantity: 1,
      bundlePriceAmount: 200,
      items: [
        { skuId: 'sku-a', quantity: 1 },
        { skuId: 'sku-b', quantity: 1 },
      ],
    });
    coupons.evaluate.mockResolvedValue({
      state: 'eligible',
      discountAmount: 20,
    });
  });

  it('uses catalog prices and applies every promotion stage in order', async () => {
    const result = await service.calculate({
      userId: 'user-id',
      items: [
        { skuId: 'sku-a', quantity: 1, flashSaleId: 'sale-id' },
        { skuId: 'sku-b', quantity: 1 },
      ],
      bundles: [{ bundleId: 'bundle-id' }],
      couponCode: 'SAVE20',
      shippingAmount: 50,
      now,
    });

    expect(repository.findPricedSkus).toHaveBeenCalledWith(['sku-a', 'sku-b']);
    expect(flashSales.evaluate).toHaveBeenCalledWith('sale-id', 'sku-a', now);
    expect(bundles.evaluate).toHaveBeenCalledWith('bundle-id', now);
    expect(result).toMatchObject({
      baseSubtotalAmount: 300,
      flashSaleDiscountAmount: 20,
      subtotalAfterFlashSaleAmount: 280,
      bundleDiscountAmount: 80,
      subtotalAfterBundleAmount: 200,
      couponDiscountAmount: 20,
      subtotalAfterCouponAmount: 180,
      shippingAmount: 50,
      finalAmount: 230,
    });
  });

  it('does not apply inactive flash-sale or coupon values', async () => {
    flashSales.evaluate.mockResolvedValue({
      state: 'expired',
      availableQuantity: 0,
    });
    bundles.evaluate.mockResolvedValue({
      state: 'ineligible',
      availableQuantity: 0,
    });
    coupons.evaluate.mockResolvedValue({
      state: 'ineligible',
      discountAmount: 0,
    });

    const result = await service.calculate({
      userId: 'user-id',
      items: [
        { skuId: 'sku-a', quantity: 1, flashSaleId: 'sale-id' },
        { skuId: 'sku-b', quantity: 1 },
      ],
      couponCode: 'NOPE',
      shippingAmount: 50,
      now,
    });

    expect(result).toMatchObject({
      baseSubtotalAmount: 300,
      flashSaleDiscountAmount: 0,
      bundleDiscountAmount: 0,
      couponDiscountAmount: 0,
      finalAmount: 350,
    });
  });
});
