import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  FlashSaleNotFoundError,
  FlashSaleReservationError,
} from '../errors/flash-sale.error.js';
import { FlashSaleRepository } from '../repositories/flash-sale.repository.js';
import type {
  FlashSale,
  FlashSaleEvaluationResult,
  ReserveFlashSaleInput,
} from '../types/flash-sale.type.js';

@Injectable()
export class FlashSaleService {
  constructor(private readonly repository: FlashSaleRepository) {}

  async evaluate(
    flashSaleId: string,
    skuId: string,
    now = new Date(),
  ): Promise<FlashSaleEvaluationResult> {
    const sale = await this.requireSale(flashSaleId);
    const item = sale.items.find((candidate) => candidate.skuId === skuId);
    if (!item)
      return this.result(sale, skuId, 'ineligible', 0, 'SKU_NOT_IN_FLASH_SALE');
    const lifecycle = this.lifecycleResult(sale, skuId, now);
    if (lifecycle) return lifecycle;
    const stock = await this.repository.findSkuAvailability(skuId);
    const availableQuantity = Math.min(
      item.allocationQuantity,
      stock?.flashSaleAllocation ?? 0,
      stock?.availableQuantity ?? 0,
    );
    if (availableQuantity < 1)
      return this.result(
        sale,
        skuId,
        'exhausted',
        0,
        'SOLD_OUT',
        item.specialPriceAmount,
      );
    return this.result(
      sale,
      skuId,
      'eligible',
      availableQuantity,
      undefined,
      item.specialPriceAmount,
    );
  }

  async reserve(input: ReserveFlashSaleInput): Promise<void> {
    if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0)
      throw new FlashSaleReservationError(
        'Quantity must be a positive integer',
      );
    const sale = await this.requireSale(input.flashSaleId);
    const item = sale.items.find(
      (candidate) => candidate.skuId === input.skuId,
    );
    if (!item)
      throw new FlashSaleReservationError(
        'SKU is not included in this flash sale',
      );
    const result = await this.repository.reserve(
      input,
      item.perUserLimit,
      input.now ?? new Date(),
    );
    if (result === 'RESERVED' || result === 'DUPLICATE') return;
    if (result === 'PER_USER_LIMIT_REACHED')
      throw new FlashSaleReservationError(
        'Flash sale per-user purchase limit has been reached',
      );
    if (result === 'SOLD_OUT')
      throw new FlashSaleReservationError('Flash sale allocation is sold out');
    throw new FlashSaleReservationError('Flash sale is not active');
  }

  async reserveInTransaction(
    transaction: Prisma.TransactionClient,
    input: ReserveFlashSaleInput,
  ): Promise<void> {
    if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0)
      throw new FlashSaleReservationError(
        'Quantity must be a positive integer',
      );
    const sale = await this.requireSale(input.flashSaleId);
    const item = sale.items.find(
      (candidate) => candidate.skuId === input.skuId,
    );
    if (!item)
      throw new FlashSaleReservationError(
        'SKU is not included in this flash sale',
      );
    const result = await this.repository.reserveInTransaction(
      transaction,
      input,
      item.perUserLimit,
      input.now ?? new Date(),
    );
    if (result === 'RESERVED' || result === 'DUPLICATE') return;
    if (result === 'PER_USER_LIMIT_REACHED')
      throw new FlashSaleReservationError(
        'Flash sale per-user purchase limit has been reached',
      );
    if (result === 'SOLD_OUT')
      throw new FlashSaleReservationError('Flash sale allocation is sold out');
    throw new FlashSaleReservationError('Flash sale is not active');
  }

  private async requireSale(id: string): Promise<FlashSale> {
    const sale = await this.repository.findById(id);
    if (!sale) throw new FlashSaleNotFoundError();
    return sale;
  }

  private lifecycleResult(
    sale: FlashSale,
    skuId: string,
    now: Date,
  ): FlashSaleEvaluationResult | null {
    if (sale.status === 'EXPIRED' || now >= sale.endsAt)
      return this.result(sale, skuId, 'expired', 0, 'FLASH_SALE_EXPIRED');
    if (sale.status === 'SCHEDULED' || now < sale.startsAt)
      return this.result(sale, skuId, 'upcoming', 0, 'FLASH_SALE_NOT_STARTED');
    if (sale.status !== 'ACTIVE')
      return this.result(sale, skuId, 'ineligible', 0, 'FLASH_SALE_INACTIVE');
    return null;
  }

  private result(
    sale: FlashSale,
    skuId: string,
    state: FlashSaleEvaluationResult['state'],
    availableQuantity: number,
    reason?: string,
    specialPriceAmount?: number,
  ): FlashSaleEvaluationResult {
    return {
      flashSaleId: sale.id,
      skuId,
      state,
      discountAmount: 0,
      applicableSubtotalAmount: 0,
      availableQuantity,
      specialPriceAmount,
      reason,
    };
  }
}
