import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/types/auth-user.type.js';
import type { CartResponseDto } from '../dto/cart.dto.js';
import {
  CartItemNotFoundError,
  CartQuantityLimitError,
  CartSkuNotFoundError,
  CartSkuUnavailableError,
} from '../errors/cart.error.js';
import { CartRepository, type CartItemRecord, type CartSkuRecord } from '../repositories/cart.repository.js';

@Injectable()
export class CartService {
  constructor(private readonly repository: CartRepository) {}

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
