import type { PromotionEvaluationResult } from '../../types/promotion-evaluation-result.type.js';

export type BundleStatus =
  'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'ARCHIVED';

export type BundleItem = {
  skuId: string;
  quantity: number;
};

export type Bundle = {
  id: string;
  name: string;
  bundlePriceAmount: number;
  currency: string;
  status: BundleStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  items: BundleItem[];
};

export type BundleSkuAvailability = {
  skuId: string;
  availableQuantity: number;
};

export type BundleEvaluationResult = PromotionEvaluationResult & {
  bundleId?: string;
  bundlePriceAmount?: number;
  currency?: string;
  items?: BundleItem[];
  availableQuantity: number;
};
