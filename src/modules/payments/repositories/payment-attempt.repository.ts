import { Injectable } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service.js';
import type {
  CreatePaymentAttemptInput,
  PaymentAttempt,
  PaymentAttemptStatus,
  ProviderChargeDetails,
} from '../types/payment-attempt.type.js';

type StoredAttempt = Omit<PaymentAttempt, 'status'> & { status: PaymentStatus };

@Injectable()
export class PaymentAttemptRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: CreatePaymentAttemptInput,
  ): Promise<PaymentAttempt | null> {
    return this.prisma.$transaction(async (transaction) => {
      const duplicate = await transaction.paymentAttempt.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (duplicate) return this.toAttempt(duplicate);
      const order = await transaction.$queryRaw<
        { id: string; totalAmount: number; currency: string }[]
      >`
        SELECT "id", "totalAmount", "currency" FROM "Order"
        WHERE "id" = ${input.orderId}::uuid AND "customerId" = ${input.customerId}::uuid FOR UPDATE`;
      if (!order[0]) return null;
      if (
        order[0].totalAmount !== input.amount ||
        order[0].currency !== input.currency
      )
        return null;
      const latest = await transaction.paymentAttempt.aggregate({
        where: { orderId: input.orderId },
        _max: { attemptNumber: true },
      });
      const attempt = await transaction.paymentAttempt.create({
        data: {
          orderId: input.orderId,
          customerId: input.customerId,
          attemptNumber: (latest._max.attemptNumber ?? 0) + 1,
          method: input.method,
          amount: input.amount,
          currency: input.currency,
          idempotencyKey: input.idempotencyKey,
        },
      });
      return this.toAttempt(attempt);
    });
  }

  async attachProviderCharge(
    attemptId: string,
    customerId: string,
    charge: ProviderChargeDetails,
  ): Promise<PaymentAttempt | null> {
    const updated = await this.prisma.paymentAttempt.updateMany({
      where: {
        id: attemptId,
        customerId,
        status: PaymentStatus.PENDING,
        providerChargeId: null,
      },
      data: {
        providerChargeId: charge.chargeId,
        providerSourceId: charge.sourceId,
        expiresAt: charge.expiresAt,
      },
    });
    if (updated.count === 1) return this.findById(attemptId, customerId);
    return this.findById(attemptId, customerId);
  }

  async finalize(
    attemptId: string,
    customerId: string,
    status: Exclude<PaymentAttemptStatus, 'PENDING'>,
    failureCode?: string,
  ): Promise<PaymentAttempt | null> {
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.paymentAttempt.findFirst({
        where: { id: attemptId, customerId },
      });
      if (!current) return null;
      const target = this.toStoredStatus(status);
      if (current.status === target) return this.toAttempt(current);
      if (current.status !== PaymentStatus.PENDING)
        return this.toAttempt(current);
      const result = await transaction.paymentAttempt.updateMany({
        where: {
          id: attemptId,
          status: PaymentStatus.PENDING,
          version: current.version,
        },
        data: {
          status: target,
          failureCode: failureCode ?? null,
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) return null;
      const updated = await transaction.paymentAttempt.findUnique({
        where: { id: attemptId },
      });
      return updated ? this.toAttempt(updated) : null;
    });
  }

  async findById(
    attemptId: string,
    customerId: string,
  ): Promise<PaymentAttempt | null> {
    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: { id: attemptId, customerId },
    });
    return attempt ? this.toAttempt(attempt) : null;
  }

  private toAttempt(attempt: StoredAttempt): PaymentAttempt {
    return {
      id: attempt.id,
      orderId: attempt.orderId,
      customerId: attempt.customerId,
      attemptNumber: attempt.attemptNumber,
      method: attempt.method,
      status:
        attempt.status === PaymentStatus.SUCCESSFUL
          ? 'SUCCESS'
          : attempt.status,
      amount: attempt.amount,
      currency: attempt.currency,
      providerChargeId: attempt.providerChargeId,
      providerSourceId: attempt.providerSourceId,
      failureCode: attempt.failureCode,
      expiresAt: attempt.expiresAt,
      completedAt: attempt.completedAt,
    };
  }

  private toStoredStatus(
    status: Exclude<PaymentAttemptStatus, 'PENDING'>,
  ): PaymentStatus {
    return status === 'SUCCESS' ? PaymentStatus.SUCCESSFUL : status;
  }
}
