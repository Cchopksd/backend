import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { OmiseService } from '../../../integrations/omise/omise.service.js';
import { OmiseWebhookSignatureError } from '../../../integrations/omise/errors/omise.error.js';
import { InventoryService } from '../../inventory/services/inventory.service.js';
import { PaymentAttemptConflictError } from '../errors/payment-attempt.error.js';
import { PaymentWebhookRepository } from '../repositories/payment-webhook.repository.js';
import type {
  OmiseChargeCompleteEvent,
  VerifiedCharge,
} from '../types/omise-webhook.type.js';

export type WebhookResult = { duplicate: boolean; ignored: boolean };

@Injectable()
export class OmiseWebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: PaymentWebhookRepository,
    private readonly omise: OmiseService,
    private readonly inventory: InventoryService,
  ) {}

  async handle(
    rawBody: Buffer,
    signature: string | undefined,
    timestamp: string | undefined,
  ): Promise<WebhookResult> {
    try {
      this.omise.verifyWebhookSignature(rawBody, signature, timestamp);
    } catch (error: unknown) {
      if (error instanceof OmiseWebhookSignatureError)
        throw new UnauthorizedException({
          error: 'OMISE_WEBHOOK_INVALID_SIGNATURE',
          message: 'Invalid Omise webhook signature',
        });
      throw error;
    }
    const event = this.parseChargeCompleteEvent(rawBody);
    if (!event) return { duplicate: false, ignored: true };
    if (await this.repository.eventExists(event.eventId))
      return { duplicate: true, ignored: false };

    const providerCharge = await this.omise.retrieveCharge(event.chargeId);
    if (providerCharge.chargeId !== event.chargeId)
      throw new BadRequestException({
        error: 'OMISE_WEBHOOK_INVALID_CHARGE',
        message: 'Webhook charge does not match the provider response',
      });
    const charge: VerifiedCharge = {
      chargeId: providerCharge.chargeId,
      status: this.status(providerCharge.status),
      amount: providerCharge.amount,
      currency: providerCharge.currency,
      failureCode: providerCharge.failureCode,
    };

    return this.prisma.$transaction(async (transaction) => {
      if (!(await this.repository.claimEvent(transaction, event)))
        return { duplicate: true, ignored: false };
      const attempt = await this.repository.findAttempt(
        transaction,
        charge.chargeId,
      );
      if (!attempt)
        throw new PaymentAttemptConflictError(
          'No payment attempt is associated with the Omise charge',
        );
      if (
        attempt.amount !== charge.amount ||
        attempt.currency !== charge.currency
      )
        throw new PaymentAttemptConflictError(
          'Omise charge amount or currency does not match the payment attempt',
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
      if (changed && charge.status === 'SUCCESS') {
        for (const item of attempt.items) {
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
        }
      }
      if (changed && charge.status !== 'PENDING')
        await this.repository.transitionOrder(
          transaction,
          attempt,
          charge.status,
        );
      await this.repository.markProcessed(transaction, event.eventId);
      return { duplicate: false, ignored: false };
    });
  }

  private parseChargeCompleteEvent(
    rawBody: Buffer,
  ): OmiseChargeCompleteEvent | null {
    let value: unknown;
    try {
      value = JSON.parse(rawBody.toString('utf8')) as unknown;
    } catch {
      throw new BadRequestException({
        error: 'OMISE_WEBHOOK_INVALID_PAYLOAD',
        message: 'Invalid Omise webhook payload',
      });
    }
    if (!isRecord(value))
      throw new BadRequestException({
        error: 'OMISE_WEBHOOK_INVALID_PAYLOAD',
        message: 'Invalid Omise webhook payload',
      });
    if (value.key !== 'charge.complete') return null;
    const data = value.data;
    if (
      !isRecord(data) ||
      typeof value.id !== 'string' ||
      typeof data.id !== 'string'
    )
      throw new BadRequestException({
        error: 'OMISE_WEBHOOK_INVALID_PAYLOAD',
        message: 'Invalid Omise charge.complete payload',
      });
    return { eventId: value.id, chargeId: data.id };
  }

  private status(status: string): VerifiedCharge['status'] {
    if (status === 'successful') return 'SUCCESS';
    if (status === 'failed') return 'FAILED';
    if (status === 'expired') return 'EXPIRED';
    return 'PENDING';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
