import { Injectable } from '@nestjs/common';
import { BundleNotFoundError } from '../errors/bundle.error.js';
import { BundleRepository } from '../repositories/bundle.repository.js';
import type {
  Bundle,
  BundleEvaluationResult,
  BundleItem,
} from '../types/bundle.type.js';

@Injectable()
export class BundleService {
  constructor(private readonly repository: BundleRepository) {}

  /** Call immediately before checkout inventory reservation to revalidate live SKU availability. */
  async evaluate(
    bundleId: string,
    now = new Date(),
  ): Promise<BundleEvaluationResult> {
    const bundle = await this.repository.findById(bundleId);
    if (!bundle) throw new BundleNotFoundError();
    const lifecycle = this.lifecycleResult(bundle, now);
    if (lifecycle) return lifecycle;

    const requiredQuantities = this.requiredQuantities(bundle.items);
    if (requiredQuantities.size === 0)
      return this.result(bundle, 'ineligible', 0, 'BUNDLE_ITEMS_INVALID');

    const stock = await this.repository.findSkuAvailability([
      ...requiredQuantities.keys(),
    ]);
    const availableBySku = new Map(
      stock.map((item) => [item.skuId, item.availableQuantity]),
    );
    const availableQuantity = Math.min(
      ...[...requiredQuantities].map(([skuId, requiredQuantity]) =>
        Math.floor((availableBySku.get(skuId) ?? 0) / requiredQuantity),
      ),
    );
    if (availableQuantity < 1)
      return this.result(bundle, 'ineligible', 0, 'INSUFFICIENT_SKU_STOCK');
    return this.result(bundle, 'eligible', availableQuantity);
  }

  async findEligibleForCart(
    quantities: Map<string, number>,
    now = new Date(),
  ): Promise<BundleEvaluationResult[]> {
    const bundles = await this.repository.findActive();
    const results = await Promise.all(bundles.map((bundle) => this.evaluate(bundle.id, now)));
    return results.filter((result) =>
      result.state === 'eligible' && result.items?.every(
        (item) => (quantities.get(item.skuId) ?? 0) >= item.quantity,
      ),
    );
  }

  private lifecycleResult(
    bundle: Bundle,
    now: Date,
  ): BundleEvaluationResult | null {
    if (
      bundle.status === 'EXPIRED' ||
      (bundle.endsAt !== null && now >= bundle.endsAt)
    )
      return this.result(bundle, 'expired', 0, 'BUNDLE_EXPIRED');
    if (
      bundle.status === 'SCHEDULED' ||
      (bundle.startsAt !== null && now < bundle.startsAt)
    )
      return this.result(bundle, 'upcoming', 0, 'BUNDLE_NOT_STARTED');
    if (bundle.status !== 'ACTIVE')
      return this.result(bundle, 'ineligible', 0, 'BUNDLE_INACTIVE');
    return null;
  }

  private requiredQuantities(items: BundleItem[]): Map<string, number> {
    return items.reduce((quantities, item) => {
      quantities.set(
        item.skuId,
        (quantities.get(item.skuId) ?? 0) + item.quantity,
      );
      return quantities;
    }, new Map<string, number>());
  }

  private result(
    bundle: Bundle,
    state: BundleEvaluationResult['state'],
    availableQuantity: number,
    reason?: string,
  ): BundleEvaluationResult {
    return {
      bundleId: bundle.id,
      bundlePriceAmount: bundle.bundlePriceAmount,
      currency: bundle.currency,
      items: bundle.items,
      state,
      discountAmount: 0,
      applicableSubtotalAmount: 0,
      availableQuantity,
      reason,
    };
  }
}
