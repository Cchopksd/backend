import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { OmiseService } from '../../../integrations/omise/omise.service.js';
import { InventoryService } from '../../inventory/services/inventory.service.js';
import {
  PaymentAttemptConflictError,
  PaymentAttemptNotFoundError,
} from '../errors/payment-attempt.error.js';
import { PaymentWebhookRepository } from '../repositories/payment-webhook.repository.js';
import type { VerifiedCharge } from '../types/omise-webhook.type.js';

@Injectable()
export class PaymentReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: PaymentWebhookRepository,
    private readonly omise: OmiseService,
    private readonly inventory: InventoryService,
  ) {}

  async reconcile(paymentAttemptId: string): Promise<void> {
    const stored = await this.repository.findAttemptById(paymentAttemptId);
    if (!stored) throw new PaymentAttemptNotFoundError();
    if (!stored.providerChargeId) return;
    const provider = await this.omise.retrieveCharge(stored.providerChargeId);
    const charge: VerifiedCharge = {
      chargeId: provider.chargeId,
      status:
        provider.status === 'successful'
          ? 'SUCCESS'
          : provider.status === 'failed'
            ? 'FAILED'
            : provider.status === 'expired'
              ? 'EXPIRED'
              : 'PENDING',
      amount: provider.amount,
      currency: provider.currency,
      failureCode: provider.failureCode,
    };
    await this.prisma.$transaction(async (transaction) => {
      const attempt = await this.repository.findAttempt(
        transaction,
        charge.chargeId,
      );
      if (!attempt) throw new PaymentAttemptNotFoundError();
      if (
        attempt.amount !== charge.amount ||
        attempt.currency !== charge.currency
      )
        throw new PaymentAttemptConflictError(
          'Omise charge does not match the payment attempt',
        );
      if (attempt.status === 'PENDING' && charge.status !== 'PENDING') {
        const order = await this.repository.lockOrder(
          transaction,
          attempt.orderId,
        );
        if (!order || order.status !== 'PENDING_PAYMENT')
          throw new PaymentAttemptConflictError(
            'Order is not awaiting payment',
          );
      }
      const changed = await this.repository.transitionAttempt(
        transaction,
        attempt,
        charge,
      );
      if (changed && charge.status === 'SUCCESS')
        for (const item of attempt.items)
          await this.inventory.commitInTransaction(
            transaction,
            item.skuId,
            item.quantity,
            {
              referenceType: 'PAYMENT_ATTEMPT',
              referenceId: attempt.id,
              idempotencyKey: `${attempt.id}:commit:${item.skuId}`,
            },
          );
      if (changed && charge.status !== 'PENDING')
        await this.repository.transitionOrder(
          transaction,
          attempt,
          charge.status,
        );
    });
  }
}
