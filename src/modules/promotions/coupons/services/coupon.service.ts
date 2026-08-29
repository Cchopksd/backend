import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  CouponNotFoundError,
  CouponRedemptionError,
} from '../errors/coupon.error.js';
import { CouponRepository } from '../repositories/coupon.repository.js';
import type {
  Coupon,
  CouponEvaluationItem,
  CouponEvaluationResult,
  EvaluateCouponInput,
  RedeemCouponInput,
} from '../types/coupon.type.js';

@Injectable()
export class CouponService {
  constructor(private readonly repository: CouponRepository) {}

  async evaluate(input: EvaluateCouponInput): Promise<CouponEvaluationResult> {
    const coupon = await this.repository.findByCode(
      input.code.trim().toUpperCase(),
    );
    if (!coupon)
      return this.result(input.code, 'ineligible', 0, 0, 'COUPON_NOT_FOUND');
    const now = input.now ?? new Date();
    const lifecycle = this.lifecycleResult(coupon, now);
    if (lifecycle) return lifecycle;
    const userUsage = await this.repository.countUserUsage(
      coupon.id,
      input.userId,
    );
    if (coupon.perUserLimit !== null && userUsage >= coupon.perUserLimit)
      return this.result(
        coupon.code,
        'exhausted',
        0,
        0,
        'PER_USER_LIMIT_REACHED',
        coupon.id,
      );

    const subtotal = this.subtotal(input.items);
    if (
      coupon.minimumSpendAmount !== null &&
      subtotal < coupon.minimumSpendAmount
    )
      return this.result(
        coupon.code,
        'ineligible',
        0,
        0,
        'MINIMUM_SPEND_NOT_MET',
        coupon.id,
      );

    const applicableSubtotal = this.applicableSubtotal(coupon, input.items);
    if (applicableSubtotal === 0)
      return this.result(
        coupon.code,
        'ineligible',
        0,
        0,
        'NO_ELIGIBLE_ITEMS',
        coupon.id,
      );

    return this.result(
      coupon.code,
      'eligible',
      this.discount(coupon, applicableSubtotal),
      applicableSubtotal,
      undefined,
      coupon.id,
    );
  }

  async redeem(input: RedeemCouponInput): Promise<void> {
    const coupon = await this.repository.findById(input.couponId);
    if (!coupon) throw new CouponNotFoundError();
    const result = await this.repository.redeem(
      coupon,
      input.userId,
      input.referenceId,
      input.now ?? new Date(),
    );
    if (result === 'REDEEMED' || result === 'DUPLICATE') return;
    if (result === 'PER_USER_LIMIT_REACHED')
      throw new CouponRedemptionError(
        'Coupon per-user usage limit has been reached',
      );
    if (result === 'EXHAUSTED')
      throw new CouponRedemptionError(
        'Coupon usage limit has been reached or it is no longer valid',
      );
    throw new CouponRedemptionError('Coupon is not active');
  }

  async redeemInTransaction(
    transaction: Prisma.TransactionClient,
    input: RedeemCouponInput,
  ): Promise<void> {
    const coupon = await this.repository.findById(input.couponId);
    if (!coupon) throw new CouponNotFoundError();
    const result = await this.repository.redeemInTransaction(
      transaction,
      coupon,
      input.userId,
      input.referenceId,
      input.now ?? new Date(),
    );
    if (result === 'REDEEMED' || result === 'DUPLICATE') return;
    if (result === 'PER_USER_LIMIT_REACHED')
      throw new CouponRedemptionError(
        'Coupon per-user usage limit has been reached',
      );
    if (result === 'EXHAUSTED')
      throw new CouponRedemptionError(
        'Coupon usage limit has been reached or it is no longer valid',
      );
    throw new CouponRedemptionError('Coupon is not active');
  }

  private lifecycleResult(
    coupon: Coupon,
    now: Date,
  ): CouponEvaluationResult | null {
    if (coupon.status === 'EXPIRED' || now >= coupon.endsAt)
      return this.result(
        coupon.code,
        'expired',
        0,
        0,
        'COUPON_EXPIRED',
        coupon.id,
      );
    if (coupon.status === 'SCHEDULED' || now < coupon.startsAt)
      return this.result(
        coupon.code,
        'upcoming',
        0,
        0,
        'COUPON_NOT_STARTED',
        coupon.id,
      );
    if (coupon.status !== 'ACTIVE')
      return this.result(
        coupon.code,
        'ineligible',
        0,
        0,
        'COUPON_INACTIVE',
        coupon.id,
      );
    if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit)
      return this.result(
        coupon.code,
        'exhausted',
        0,
        0,
        'USAGE_LIMIT_REACHED',
        coupon.id,
      );
    return null;
  }

  private subtotal(items: CouponEvaluationItem[]): number {
    return items.reduce(
      (sum, item) =>
        sum + (item.lineAmount ?? item.unitPriceAmount * item.quantity),
      0,
    );
  }

  private applicableSubtotal(
    coupon: Coupon,
    items: CouponEvaluationItem[],
  ): number {
    const { productIds, categoryIds } = coupon.restrictions;
    if (!productIds?.length && !categoryIds?.length)
      return this.subtotal(items);
    return items
      .filter(
        (item) =>
          productIds?.includes(item.productId) ||
          (item.categoryId !== null && categoryIds?.includes(item.categoryId)),
      )
      .reduce(
        (sum, item) =>
          sum + (item.lineAmount ?? item.unitPriceAmount * item.quantity),
        0,
      );
  }

  private discount(coupon: Coupon, applicableSubtotal: number): number {
    if (coupon.type === 'FREE_SHIPPING') return 0;
    const raw =
      coupon.type === 'PERCENTAGE'
        ? Math.floor((applicableSubtotal * coupon.value) / 100)
        : coupon.value;
    const capped =
      coupon.maximumDiscountAmount === null
        ? raw
        : Math.min(raw, coupon.maximumDiscountAmount);
    return Math.min(capped, applicableSubtotal);
  }

  private result(
    couponCode: string,
    state: CouponEvaluationResult['state'],
    discountAmount: number,
    applicableSubtotalAmount: number,
    reason?: string,
    couponId?: string,
  ): CouponEvaluationResult {
    return {
      couponCode,
      couponId,
      state,
      discountAmount,
      applicableSubtotalAmount,
      reason,
    };
  }
}
