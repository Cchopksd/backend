import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/types/auth-user.type.js';
import type { CartPromotionPreviewDto, CartResponseDto, CartSummaryDto } from '../dto/cart.dto.js';
import { PricingService } from '../../pricing/services/pricing.service.js';
import { BundleService } from '../../promotions/bundles/services/bundle.service.js';
import {
  CartItemNotFoundError,
  CartQuantityLimitError,
  CartSkuNotFoundError,
  CartSkuUnavailableError,
} from '../errors/cart.error.js';
import { CartRepository, type CartItemRecord, type CartSkuRecord } from '../repositories/cart.repository.js';

@Injectable()
export class CartService {
  constructor(
    private readonly repository: CartRepository,
    private readonly pricing: PricingService,
    private readonly bundles: BundleService,
  ) {}

  async get(user: AuthenticatedUser): Promise<CartResponseDto> {
    return this.toResponse(await this.repository.listItems(user.id));
  }

  async add(user: AuthenticatedUser, skuId: string, quantity: number): Promise<CartResponseDto> {
    await this.assertPurchasableSku(skuId, quantity);
    if (!(await this.repository.addItem(user.id, skuId, quantity))) throw new CartQuantityLimitError();
    return this.get(user);
  }

  async updateQuantity(user: AuthenticatedUser, itemId: string, quantity: number): Promise<CartResponseDto> {
    const item = await this.requireItem(user, itemId);
    await this.assertPurchasableSku(item.skuId, quantity);
    if (!(await this.repository.updateQuantity(user.id, itemId, quantity))) throw new CartQuantityLimitError();
    return this.get(user);
  }

  async setItemSelection(user: AuthenticatedUser, itemId: string, selected: boolean): Promise<CartResponseDto> {
    const item = await this.requireItem(user, itemId);
    if (selected) await this.assertPurchasableSku(item.skuId, item.quantity);
    if (!(await this.repository.setItemSelection(user.id, itemId, selected))) throw new CartItemNotFoundError();
    return this.get(user);
  }

  async setAllSelection(user: AuthenticatedUser, selected: boolean): Promise<CartResponseDto> {
    if (selected) {
      const items = await this.repository.listItems(user.id);
      for (const item of items) await this.assertPurchasableSku(item.skuId, item.quantity);
    }
    await this.repository.setAllSelection(user.id, selected);
    return this.get(user);
  }

  async remove(user: AuthenticatedUser, itemId: string): Promise<void> {
    if (!(await this.repository.removeItem(user.id, itemId))) throw new CartItemNotFoundError();
  }

  async preview(user: AuthenticatedUser, request: CartPromotionPreviewDto): Promise<CartSummaryDto> {
    const items = (await this.repository.listItems(user.id)).filter(
      (item) => item.selected && item.skuActive && item.productActive && item.sellerActive && item.quantity <= item.availableQuantity,
    );
    const eligibleBundles = await this.bundles.findEligibleForCart(
      new Map(items.map((item) => [item.skuId, item.quantity])),
    );
    if (items.length === 0) {
      return { currency: 'THB', selectedItemCount: 0, baseSubtotalAmount: 0, bundleDiscountAmount: 0, voucherDiscountAmount: 0, estimatedShippingAmount: 0, estimatedTotalAmount: 0, couponCode: null, couponState: null, eligibleBundleIds: [] };
    }
    const pricing = await this.pricing.calculate({
      userId: user.id,
      items: items.map((item) => ({ skuId: item.skuId, quantity: item.quantity })),
      bundles: (request.bundleIds ?? []).map((bundleId) => ({ bundleId })),
      couponCode: request.couponCode,
      // Shipping is address-dependent and is deliberately not accepted from the browser.
      shippingAmount: 0,
    });
    return {
      currency: pricing.currency,
      selectedItemCount: items.length,
      baseSubtotalAmount: pricing.baseSubtotalAmount,
      bundleDiscountAmount: pricing.bundleDiscountAmount,
      voucherDiscountAmount: pricing.couponDiscountAmount,
      estimatedShippingAmount: pricing.shippingAmount,
      estimatedTotalAmount: pricing.finalAmount,
      couponCode: pricing.coupon?.couponCode ?? null,
      couponState: pricing.coupon?.state ?? null,
      eligibleBundleIds: eligibleBundles.flatMap((bundle) => bundle.bundleId ? [bundle.bundleId] : []),
    };
  }

  private async requireItem(user: AuthenticatedUser, itemId: string): Promise<CartItemRecord> {
    const item = await this.repository.findItem(user.id, itemId);
    if (!item) throw new CartItemNotFoundError();
    return item;
  }

  private async assertPurchasableSku(skuId: string, quantity: number): Promise<void> {
    const sku = await this.repository.findSku(skuId);
    if (!sku) throw new CartSkuNotFoundError();
    this.assertAvailable(sku, quantity);
  }

  private assertAvailable(sku: CartSkuRecord, quantity: number): void {
    if (!sku.skuActive || !sku.productActive || !sku.sellerActive) throw new CartSkuUnavailableError();
    if (quantity > sku.availableQuantity) throw new CartQuantityLimitError();
  }

  private toResponse(items: CartItemRecord[]): CartResponseDto {
    const groups = new Map<string, CartResponseDto['sellerGroups'][number]>();
    for (const item of items) {
      const group = groups.get(item.sellerId) ?? {
        sellerId: item.sellerId,
        sellerName: item.sellerName,
        items: [],
      };
      group.items.push({
        id: item.id,
        skuId: item.skuId,
        skuCode: item.skuCode,
        productId: item.productId,
        productName: item.productName,
        variantName: item.variantName,
        sellerId: item.sellerId,
        sellerName: item.sellerName,
        unitPriceAmount: item.unitPriceAmount,
        currency: item.currency,
        quantity: item.quantity,
        selected: item.selected,
        availableQuantity: item.availableQuantity,
        available: item.skuActive && item.productActive && item.sellerActive && item.quantity <= item.availableQuantity,
        productMedia: item.productMedia,
      });
      groups.set(item.sellerId, group);
    }
    return { sellerGroups: [...groups.values()] };
  }
}
