import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service.js';
import type { AuthenticatedUser } from '../../auth/types/auth-user.type.js';
import { InventoryService } from '../../inventory/services/inventory.service.js';
import { PricingService } from '../../pricing/services/pricing.service.js';
import { CouponService } from '../../promotions/coupons/services/coupon.service.js';
import { FlashSaleService } from '../../promotions/flash-sales/services/flash-sale.service.js';
import type { CheckoutDto, CheckoutResponseDto } from '../dto/checkout.dto.js';
import {
  CheckoutCartEmptyError,
  CheckoutPromotionError,
} from '../errors/checkout.error.js';
import {
  OrdersRepository,
  type CheckoutCartItem,
} from '../repositories/orders.repository.js';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersRepository,
    private readonly pricing: PricingService,
    private readonly inventory: InventoryService,
    private readonly coupons: CouponService,
    private readonly flashSales: FlashSaleService,
  ) {}

  async checkout(
    user: AuthenticatedUser,
    dto: CheckoutDto,
  ): Promise<CheckoutResponseDto> {
    const existing = await this.orders.findOrderByCheckoutReference(
      dto.idempotencyKey,
    );
    if (existing) return existing;
    const now = new Date();
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const duplicate = await this.orders.findOrderByCheckoutReference(
          dto.idempotencyKey,
        );
        if (duplicate) return duplicate;
        const items = await this.orders.selectedCartItems(
          transaction,
          user.id,
          dto.sellerId,
        );
        if (!items.length) throw new CheckoutCartEmptyError();

        const flashSales = new Map(
          (dto.flashSales ?? []).map((request) => [
            request.skuId,
            request.flashSaleId,
          ]),
        );
        if (
          flashSales.size !== (dto.flashSales ?? []).length ||
          [...flashSales.keys()].some(
            (skuId) => !items.some((item) => item.skuId === skuId),
          )
        )
          throw new CheckoutPromotionError(
            'Flash sale selections must uniquely match selected cart items',
          );

        const pricing = await this.pricing.calculate({
          userId: user.id,
          items: items.map((item) => ({
            skuId: item.skuId,
            quantity: item.quantity,
            flashSaleId: flashSales.get(item.skuId),
          })),
          bundles: dto.bundles,
          couponCode: dto.couponCode,
          shippingAmount: 0,
          now,
        });
        if (dto.couponCode && pricing.coupon?.state !== 'eligible')
          throw new CheckoutPromotionError(
            'The selected coupon is not eligible for this checkout',
          );
        if (
          [...flashSales.keys()].some(
            (skuId) =>
              (pricing.items.find((item) => item.skuId === skuId)
                ?.flashSaleQuantity ?? 0) < 1,
          )
        )
          throw new CheckoutPromotionError(
            'A selected flash sale is no longer eligible',
          );

        const orderId = randomUUID();
        for (const pricedItem of pricing.items) {
          const flashSaleId = flashSales.get(pricedItem.skuId);
          if (flashSaleId && pricedItem.flashSaleQuantity > 0) {
            await this.flashSales.reserveInTransaction(transaction, {
              flashSaleId,
              skuId: pricedItem.skuId,
              userId: user.id,
              quantity: pricedItem.flashSaleQuantity,
              referenceId: orderId,
              idempotencyKey: `${dto.idempotencyKey}:flash:${pricedItem.skuId}`,
              now,
            });
          }
          const standardQuantity =
            pricedItem.quantity - pricedItem.flashSaleQuantity;
          if (standardQuantity > 0) {
            await this.inventory.reserveInTransaction(
              transaction,
              pricedItem.skuId,
              standardQuantity,
              'STANDARD',
              {
                referenceType: 'ORDER',
                referenceId: orderId,
                idempotencyKey: `${dto.idempotencyKey}:standard:${pricedItem.skuId}`,
              },
            );
          }
        }

        if (pricing.coupon?.couponId)
          await this.coupons.redeemInTransaction(transaction, {
            couponId: pricing.coupon.couponId,
            userId: user.id,
            referenceId: orderId,
            now,
          });
        const order = await this.orders.create(
          transaction,
          this.orderInput(orderId, dto, user.id, items, pricing),
        );
        await this.orders.clearCheckedOutItems(
          transaction,
          user.id,
          dto.sellerId,
        );
        return order;
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const completed = await this.orders.findOrderByCheckoutReference(
          dto.idempotencyKey,
        );
        if (completed) return completed;
      }
      throw error;
    }
  }

  private orderInput(
    orderId: string,
    dto: CheckoutDto,
    customerId: string,
    items: CheckoutCartItem[],
    pricing: Awaited<ReturnType<PricingService['calculate']>>,
  ): Parameters<OrdersRepository['create']>[1] {
    const pricedBySku = new Map(
      pricing.items.map((item) => [item.skuId, item]),
    );
    const promotionSnapshot: Prisma.InputJsonObject = {
      pricing: { ...pricing },
      requested: {
        couponCode: dto.couponCode ?? null,
        bundles: (dto.bundles ?? []).map((bundle) => ({
          bundleId: bundle.bundleId,
          quantity: bundle.quantity ?? null,
        })),
        flashSales: (dto.flashSales ?? []).map((sale) => ({
          skuId: sale.skuId,
          flashSaleId: sale.flashSaleId,
        })),
      },
    };
    let allocatedCouponDiscount = 0;
    return {
      id: orderId,
      orderNumber: `ORD-${orderId.replaceAll('-', '').toUpperCase()}`,
      checkoutReference: dto.idempotencyKey,
      customerId,
      sellerId: dto.sellerId,
      currency: pricing.currency,
      subtotalAmount: pricing.baseSubtotalAmount,
      discountAmount:
        pricing.baseSubtotalAmount - pricing.subtotalAfterCouponAmount,
      totalAmount: pricing.finalAmount,
      promotionSnapshot,
      shippingAddress: this.jsonObject(dto.shippingAddress),
      items: items.map((item, index) => {
        const priced = pricedBySku.get(item.skuId)!;
        const couponDiscountAmount =
          index === items.length - 1
            ? pricing.couponDiscountAmount - allocatedCouponDiscount
            : Math.floor(
                (pricing.couponDiscountAmount * priced.amountAfterBundle) /
                  pricing.subtotalAfterBundleAmount,
              );
        allocatedCouponDiscount += couponDiscountAmount;
        const totalAmount = priced.amountAfterBundle - couponDiscountAmount;
        const discountAmount =
          priced.baseUnitPriceAmount * priced.quantity - totalAmount;
        return {
          ...item,
          unitPriceAmount: priced.baseUnitPriceAmount,
          discountAmount,
          totalAmount,
          promotionSnapshot: {
            flashSaleQuantity: priced.flashSaleQuantity,
            amountAfterFlashSale: priced.amountAfterFlashSale,
            amountAfterBundle: priced.amountAfterBundle,
            couponDiscountAmount,
          },
        };
      }),
    };
  }

  private jsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, this.jsonValue(item)]),
    );
  }

  private jsonValue(value: unknown): Prisma.InputJsonValue | null {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'boolean'
    )
      return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (Array.isArray(value)) return value.map((item) => this.jsonValue(item));
    if (typeof value === 'object')
      return this.jsonObject(value as Record<string, unknown>);
    throw new CheckoutPromotionError(
      'Shipping address must contain only JSON values',
    );
  }
}
