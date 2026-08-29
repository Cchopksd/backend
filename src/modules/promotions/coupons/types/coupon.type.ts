import type { PromotionEvaluationResult } from '../../types/promotion-evaluation-result.type.js';

export type CouponType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
export type CouponStatus =
  'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'ARCHIVED';

export type CouponRestrictions = {
  productIds?: string[];
  categoryIds?: string[];
};

export type Coupon = {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  minimumSpendAmount: number | null;
  maximumDiscountAmount: number | null;
  usageLimit: number | null;
  usageCount: number;
  perUserLimit: number | null;
  startsAt: Date;
  endsAt: Date;
  status: CouponStatus;
  restrictions: CouponRestrictions;
};

export type CouponEvaluationItem = {
  productId: string;
  categoryId: string | null;
  unitPriceAmount: number;
  quantity: number;
  lineAmount?: number;
};

export type EvaluateCouponInput = {
  code: string;
  userId: string;
  items: CouponEvaluationItem[];
  now?: Date;
};

export type CouponEvaluationResult = PromotionEvaluationResult & {
  couponId?: string;
  couponCode: string;
};

export type RedeemCouponInput = {
  couponId: string;
  userId: string;
  referenceId: string;
  now?: Date;
};

export type CouponRedemptionResult =
  | 'REDEEMED'
  | 'DUPLICATE'
  | 'EXHAUSTED'
  | 'PER_USER_LIMIT_REACHED'
  | 'INACTIVE';
