import type { PromotionEvaluationResult } from '../../types/promotion-evaluation-result.type.js';

export type FlashSaleStatus =
  'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'ARCHIVED';

export type FlashSaleItem = {
  skuId: string;
  specialPriceAmount: number;
  allocationQuantity: number;
  perUserLimit: number | null;
};

export type FlashSale = {
  id: string;
  name: string;
  status: FlashSaleStatus;
  startsAt: Date;
  endsAt: Date;
  items: FlashSaleItem[];
};

export type FlashSaleSkuAvailability = {
  skuId: string;
  availableQuantity: number;
  flashSaleAllocation: number;
};

export type FlashSaleEvaluationResult = PromotionEvaluationResult & {
  flashSaleId?: string;
  skuId: string;
  specialPriceAmount?: number;
  availableQuantity: number;
};

export type ReserveFlashSaleInput = {
  flashSaleId: string;
  skuId: string;
  userId: string;
  quantity: number;
  referenceId: string;
  idempotencyKey: string;
  now?: Date;
};

export type FlashSaleReservationResult =
  'RESERVED' | 'DUPLICATE' | 'SOLD_OUT' | 'PER_USER_LIMIT_REACHED' | 'INACTIVE';
