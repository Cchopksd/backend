import { Injectable } from '@nestjs/common';
import {
  PaymentAttemptConflictError,
  PaymentAttemptInvalidInputError,
  PaymentAttemptNotFoundError,
} from '../errors/payment-attempt.error.js';
import { PaymentAttemptRepository } from '../repositories/payment-attempt.repository.js';
import type {
  CreatePaymentAttemptInput,
  PaymentAttempt,
  PaymentAttemptStatus,
  ProviderChargeDetails,
} from '../types/payment-attempt.type.js';

@Injectable()
export class PaymentAttemptService {
  constructor(private readonly repository: PaymentAttemptRepository) {}

  async create(input: CreatePaymentAttemptInput): Promise<PaymentAttempt> {
    this.assertCreateInput(input);
    const attempt = await this.repository.create(input);
    if (!attempt) throw new PaymentAttemptNotFoundError();
    if (
      attempt.orderId !== input.orderId ||
      attempt.customerId !== input.customerId ||
      attempt.method !== input.method ||
      attempt.amount !== input.amount ||
      attempt.currency !== input.currency
    )
      throw new PaymentAttemptConflictError(
        'Idempotency key belongs to another payment attempt',
      );
    return attempt;
  }

  async attachProviderCharge(
    attemptId: string,
    customerId: string,
    charge: ProviderChargeDetails,
  ): Promise<PaymentAttempt> {
    if (!charge.chargeId.trim())
      throw new PaymentAttemptInvalidInputError(
        'Provider charge ID is required',
      );
    const attempt = await this.repository.attachProviderCharge(
      attemptId,
      customerId,
      charge,
    );
    if (!attempt) throw new PaymentAttemptNotFoundError();
    if (attempt.providerChargeId !== charge.chargeId)
      throw new PaymentAttemptConflictError(
        'Payment attempt is already associated with another provider charge',
      );
    return attempt;
  }

  async finalize(
    attemptId: string,
    customerId: string,
    status: Exclude<PaymentAttemptStatus, 'PENDING'>,
    failureCode?: string,
  ): Promise<PaymentAttempt> {
    const attempt = await this.repository.finalize(
      attemptId,
      customerId,
      status,
      failureCode,
    );
    if (!attempt) throw new PaymentAttemptNotFoundError();
    if (attempt.status !== status)
      throw new PaymentAttemptConflictError(
        'A completed payment attempt cannot change status',
      );
    return attempt;
  }

  private assertCreateInput(input: CreatePaymentAttemptInput): void {
    if (
      !input.orderId ||
      !input.customerId ||
      !input.idempotencyKey ||
      !Number.isSafeInteger(input.amount) ||
      input.amount <= 0 ||
      !/^[A-Z]{3}$/.test(input.currency)
    )
      throw new PaymentAttemptInvalidInputError(
        'Payment attempt input is invalid',
      );
  }
}
