import { Injectable } from '@nestjs/common';
import { BundleService } from '../../promotions/bundles/services/bundle.service.js';
import { CouponService } from '../../promotions/coupons/services/coupon.service.js';
import { FlashSaleService } from '../../promotions/flash-sales/services/flash-sale.service.js';
import { PricingError } from '../errors/pricing.error.js';
import { PricingRepository } from '../repositories/pricing.repository.js';
import type {
  PricedSku,
  PricingBreakdown,
  PricingRequest,
} from '../types/pricing.type.js';

type Line = PricedSku & {
  quantity: number;
  flashSaleId?: string;
  flashSaleQuantity: number;
  amountAfterFlashSale: number;
  amountAfterBundle: number;
};

@Injectable()
export class PricingService {
  constructor(
    private readonly repository: PricingRepository,
    private readonly flashSales: FlashSaleService,
    private readonly bundles: BundleService,
    private readonly coupons: CouponService,
  ) {}

  async calculate(input: PricingRequest): Promise<PricingBreakdown> {
    this.validate(input);
    const now = input.now ?? new Date();
    const catalog = await this.repository.findPricedSkus(
      input.items.map((item) => item.skuId),
    );
    const lines = this.lines(input, catalog);
    await this.applyFlashSales(lines, now);
    const baseSubtotalAmount = lines.reduce(
      (sum, line) => sum + line.unitPriceAmount * line.quantity,
      0,
    );
    const subtotalAfterFlashSaleAmount = lines.reduce(
      (sum, line) => sum + line.amountAfterFlashSale,
      0,
    );
    const bundleDiscountAmount = await this.applyBundles(
      lines,
      input.bundles ?? [],
      now,
    );
    const subtotalAfterBundleAmount = lines.reduce(
      (sum, line) => sum + line.amountAfterBundle,
      0,
    );
    const coupon = input.couponCode
      ? await this.coupons.evaluate({
          code: input.couponCode,
          userId: input.userId,
          now,
          items: lines.map((line) => ({
            productId: line.productId,
            categoryId: line.categoryId,
            unitPriceAmount: line.unitPriceAmount,
            quantity: line.quantity,
            lineAmount: line.amountAfterBundle,
          })),
        })
      : null;
    const couponDiscountAmount =
      coupon?.state === 'eligible' ? coupon.discountAmount : 0;
    const subtotalAfterCouponAmount =
      subtotalAfterBundleAmount - couponDiscountAmount;
    const currency = lines[0]?.currency ?? 'THB';
    return {
      currency,
      baseSubtotalAmount,
      flashSaleDiscountAmount:
        baseSubtotalAmount - subtotalAfterFlashSaleAmount,
      subtotalAfterFlashSaleAmount,
      bundleDiscountAmount,
      subtotalAfterBundleAmount,
      couponDiscountAmount,
      subtotalAfterCouponAmount,
      shippingAmount: input.shippingAmount,
      finalAmount: subtotalAfterCouponAmount + input.shippingAmount,
      coupon: coupon
        ? {
            couponId: coupon.couponId,
            couponCode: coupon.couponCode,
            state: coupon.state,
            discountAmount: coupon.discountAmount,
          }
        : undefined,
      items: lines.map((line) => ({
        skuId: line.skuId,
        productId: line.productId,
        categoryId: line.categoryId,
        quantity: line.quantity,
        baseUnitPriceAmount: line.unitPriceAmount,
        flashSaleQuantity: line.flashSaleQuantity,
        amountAfterFlashSale: line.amountAfterFlashSale,
        amountAfterBundle: line.amountAfterBundle,
      })),
    };
  }

  private lines(input: PricingRequest, catalog: PricedSku[]): Line[] {
    const bySku = new Map(catalog.map((sku) => [sku.skuId, sku]));
    const currencies = new Set(catalog.map((sku) => sku.currency));
    if (catalog.length !== input.items.length || currencies.size > 1)
      throw new PricingError(
        'Cart contains unavailable SKUs or multiple currencies',
      );
    return input.items.map((item) => {
      const sku = bySku.get(item.skuId);
      if (!sku) throw new PricingError('Cart contains an unavailable SKU');
      const amount = sku.unitPriceAmount * item.quantity;
      return {
        ...sku,
        quantity: item.quantity,
        flashSaleId: item.flashSaleId,
        flashSaleQuantity: 0,
        amountAfterFlashSale: amount,
        amountAfterBundle: amount,
      };
    });
  }

  private async applyFlashSales(lines: Line[], now: Date): Promise<void> {
    for (const line of lines) {
      if (!line.flashSaleId) continue;
      const sale = await this.flashSales.evaluate(
        line.flashSaleId,
        line.skuId,
        now,
      );
      if (sale.state !== 'eligible' || sale.specialPriceAmount === undefined)
        continue;
      const quantity = Math.min(line.quantity, sale.availableQuantity);
      line.flashSaleQuantity = quantity;
      line.amountAfterFlashSale =
        quantity * sale.specialPriceAmount +
        (line.quantity - quantity) * line.unitPriceAmount;
      line.amountAfterBundle = line.amountAfterFlashSale;
    }
  }

  private async applyBundles(
    lines: Line[],
    requested: NonNullable<PricingRequest['bundles']>,
    now: Date,
  ): Promise<number> {
    let totalDiscount = 0;
    const remaining = new Map(lines.map((line) => [line.skuId, line.quantity]));
    for (const request of requested) {
      const evaluation = await this.bundles.evaluate(request.bundleId, now);
      if (
        evaluation.state !== 'eligible' ||
        !evaluation.items?.length ||
        evaluation.bundlePriceAmount === undefined
      )
        continue;
      const cartQuantity = Math.min(
        ...evaluation.items.map((item) =>
          Math.floor((remaining.get(item.skuId) ?? 0) / item.quantity),
        ),
      );
      const quantity = Math.min(
        request.quantity ?? cartQuantity,
        cartQuantity,
        evaluation.availableQuantity,
      );
      if (quantity < 1) continue;
      const matched = lines.filter((line) =>
        evaluation.items?.some((item) => item.skuId === line.skuId),
      );
      const subtotal = matched.reduce(
        (sum, line) =>
          sum +
          (line.amountAfterBundle / line.quantity) *
            (evaluation.items?.find((item) => item.skuId === line.skuId)
              ?.quantity ?? 0) *
            quantity,
        0,
      );
      const discount = Math.max(
        0,
        Math.floor(subtotal - evaluation.bundlePriceAmount * quantity),
      );
      this.distributeDiscount(matched, discount);
      for (const item of evaluation.items)
        remaining.set(
          item.skuId,
          (remaining.get(item.skuId) ?? 0) - item.quantity * quantity,
        );
      totalDiscount += discount;
    }
    return totalDiscount;
  }

  private distributeDiscount(lines: Line[], discount: number): void {
    let remainder = discount;
    const subtotal = lines.reduce(
      (sum, line) => sum + line.amountAfterBundle,
      0,
    );
    for (const [index, line] of lines.entries()) {
      const reduction =
        index === lines.length - 1
          ? remainder
          : Math.min(
              line.amountAfterBundle,
              Math.floor((discount * line.amountAfterBundle) / subtotal),
            );
      line.amountAfterBundle -= reduction;
      remainder -= reduction;
    }
  }

  private validate(input: PricingRequest): void {
    if (
      !input.userId ||
      !Number.isSafeInteger(input.shippingAmount) ||
      input.shippingAmount < 0 ||
      input.items.length === 0
    )
      throw new PricingError('Pricing input is invalid');
    if (
      new Set(input.items.map((item) => item.skuId)).size !==
        input.items.length ||
      input.items.some(
        (item) =>
          !item.skuId ||
          !Number.isSafeInteger(item.quantity) ||
          item.quantity <= 0,
      )
    )
      throw new PricingError('SKU quantities must be positive and unique');
  }
}
