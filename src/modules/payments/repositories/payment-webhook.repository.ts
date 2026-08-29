import { Injectable } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import type { Prisma as PrismaNamespace } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service.js';
import type { PaymentAttemptStatus } from '../types/payment-attempt.type.js';
import type {
  OmiseChargeCompleteEvent,
  VerifiedCharge,
} from '../types/omise-webhook.type.js';

export type WebhookAttempt = {
  id: string;
  orderId: string;
  customerId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  items: Array<{ skuId: string; quantity: number }>;
};

@Injectable()
export class PaymentWebhookRepository {
  constructor(private readonly prisma: PrismaService) {}

  async eventExists(eventId: string): Promise<boolean> {
    return Boolean(
      await this.prisma.paymentWebhookEvent.findUnique({
        where: { providerEventId: eventId },
        select: { id: true },
      }),
    );
  }

  async claimEvent(
    transaction: PrismaNamespace.TransactionClient,
    event: OmiseChargeCompleteEvent,
  ): Promise<boolean> {
    const existing = await transaction.paymentWebhookEvent.findUnique({
      where: { providerEventId: event.eventId },
      select: { id: true },
    });
    if (existing) return false;
    try {
      await transaction.paymentWebhookEvent.create({
        data: {
          providerEventId: event.eventId,
          eventType: 'charge.complete',
          providerChargeId: event.chargeId,
          payload: { eventId: event.eventId, chargeId: event.chargeId },
        },
      });
      return true;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        return false;
      throw error;
    }
  }

  async findAttempt(
    transaction: PrismaNamespace.TransactionClient,
    chargeId: string,
  ): Promise<WebhookAttempt | null> {
    const attempt = await transaction.paymentAttempt.findUnique({
      where: { providerChargeId: chargeId },
      include: {
        order: {
          include: { items: { select: { skuId: true, quantity: true } } },
        },
      },
    });
    return attempt
      ? {
          id: attempt.id,
          orderId: attempt.orderId,
          customerId: attempt.customerId,
          status: attempt.status,
          amount: attempt.amount,
          currency: attempt.currency,
          items: attempt.order.items,
        }
      : null;
  }

  async findAttemptById(
    paymentAttemptId: string,
  ): Promise<{ id: string; providerChargeId: string | null } | null> {
    return this.prisma.paymentAttempt.findUnique({
      where: { id: paymentAttemptId },
      select: { id: true, providerChargeId: true },
    });
  }

  async lockOrder(
    transaction: PrismaNamespace.TransactionClient,
    orderId: string,
  ): Promise<{ status: string } | null> {
    const rows = await transaction.$queryRaw<{ status: string }[]>`
      SELECT "status" FROM "Order" WHERE "id" = ${orderId}::uuid FOR UPDATE`;
    return rows[0] ?? null;
  }

  async transitionAttempt(
    transaction: PrismaNamespace.TransactionClient,
    attempt: WebhookAttempt,
    charge: VerifiedCharge,
  ): Promise<boolean> {
    const status = this.storedStatus(charge.status);
    if (attempt.status === status) return false;
    if (attempt.status !== PaymentStatus.PENDING) return false;
    const result = await transaction.paymentAttempt.updateMany({
      where: { id: attempt.id, status: PaymentStatus.PENDING },
      data: {
        status,
        failureCode: charge.failureCode ?? null,
        completedAt: charge.status === 'PENDING' ? null : new Date(),
        version: { increment: 1 },
      },
    });
    return result.count === 1;
  }

  async transitionOrder(
    transaction: PrismaNamespace.TransactionClient,
    attempt: WebhookAttempt,
    status: PaymentAttemptStatus,
  ): Promise<void> {
    if (status === 'SUCCESS') {
      await transaction.order.updateMany({
        where: {
          id: attempt.orderId,
          status: 'PENDING_PAYMENT',
          paymentStatus: PaymentStatus.PENDING,
        },
        data: {
          status: 'PAID',
          paymentStatus: PaymentStatus.SUCCESSFUL,
          paidAt: new Date(),
          statusVersion: { increment: 1 },
        },
      });
      return;
    }
    await transaction.order.updateMany({
      where: { id: attempt.orderId, status: 'PENDING_PAYMENT' },
      data: { paymentStatus: this.storedStatus(status) },
    });
  }

  async markProcessed(
    transaction: PrismaNamespace.TransactionClient,
    eventId: string,
  ): Promise<void> {
    await transaction.paymentWebhookEvent.update({
      where: { providerEventId: eventId },
      data: { processedAt: new Date() },
    });
  }

  private storedStatus(status: PaymentAttemptStatus): PaymentStatus {
    return status === 'SUCCESS' ? PaymentStatus.SUCCESSFUL : status;
  }
}
