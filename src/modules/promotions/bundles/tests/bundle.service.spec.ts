import { BundleService } from '../services/bundle.service.js';
import type { Bundle } from '../types/bundle.type.js';

describe('BundleService', () => {
  const now = new Date('2026-08-29T12:00:00.000Z');
  const bundle: Bundle = {
    id: 'bundle-id',
    name: 'Starter pack',
    bundlePriceAmount: 1_500,
    currency: 'THB',
    status: 'ACTIVE',
    startsAt: null,
    endsAt: null,
    items: [
      { skuId: 'sku-a', quantity: 2 },
      { skuId: 'sku-b', quantity: 3 },
    ],
  };
  const repository = { findById: vi.fn(), findSkuAvailability: vi.fn() };
  const service = new BundleService(repository);

  beforeEach(() => {
    vi.clearAllMocks();
    repository.findById.mockResolvedValue(bundle);
  });

  it('derives bundle availability from the limiting underlying SKU', async () => {
    repository.findSkuAvailability.mockResolvedValue([
      { skuId: 'sku-a', availableQuantity: 10 },
      { skuId: 'sku-b', availableQuantity: 8 },
    ]);

    const result = await service.evaluate('bundle-id', now);

    expect(result).toMatchObject({ state: 'eligible', availableQuantity: 2 });
    expect(repository.findSkuAvailability).toHaveBeenCalledWith([
      'sku-a',
      'sku-b',
    ]);
  });

  it('returns ineligible when a required SKU has no current stock record', async () => {
    repository.findSkuAvailability.mockResolvedValue([
      { skuId: 'sku-a', availableQuantity: 10 },
    ]);

    await expect(service.evaluate('bundle-id', now)).resolves.toMatchObject({
      state: 'ineligible',
      availableQuantity: 0,
      reason: 'INSUFFICIENT_SKU_STOCK',
    });
  });

  it('does not query inventory for an inactive or expired bundle', async () => {
    repository.findById.mockResolvedValue({ ...bundle, endsAt: now });

    await expect(service.evaluate('bundle-id', now)).resolves.toMatchObject({
      state: 'expired',
      availableQuantity: 0,
    });
    expect(repository.findSkuAvailability).not.toHaveBeenCalled();
  });
});
