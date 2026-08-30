import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/types/auth-user.type.js';
import { OmiseService } from '../../../integrations/omise/omise.service.js';
import type { CreateCustomerPaymentDto, CustomerPaymentResponseDto } from '../dto/customer-payment.dto.js';
import { PaymentAttemptConflictError, PaymentAttemptInvalidInputError, PaymentAttemptNotFoundError } from '../errors/payment-attempt.error.js';
import { PaymentAttemptRepository } from '../repositories/payment-attempt.repository.js';
import { PaymentAttemptService } from './payment-attempt.service.js';
import { PaymentReconciliationService } from './payment-reconciliation.service.js';

@Injectable()
export class CustomerPaymentService {
  constructor(private readonly attempts: PaymentAttemptService, private readonly repository: PaymentAttemptRepository, private readonly omise: OmiseService, private readonly reconciliation: PaymentReconciliationService) {}
  async get(user: AuthenticatedUser, orderId: string): Promise<CustomerPaymentResponseDto> {
    const state = await this.repository.findCustomerPaymentState(orderId, user.id);
    if (!state) throw new PaymentAttemptNotFoundError();
    if (state.attempt?.providerChargeId && state.attempt.status === 'PENDING') await this.reconciliation.reconcile(state.attempt.id);
    return this.response((await this.repository.findCustomerPaymentState(orderId, user.id))!);
  }
  async create(user: AuthenticatedUser, orderId: string, idempotencyHeader: string | undefined, dto: CreateCustomerPaymentDto): Promise<CustomerPaymentResponseDto> {
    const before = await this.repository.findCustomerPaymentState(orderId, user.id);
    if (!before) throw new PaymentAttemptNotFoundError();
    if (before.orderStatus !== 'PENDING_PAYMENT') throw new PaymentAttemptConflictError('Order is not eligible for payment');
    if (dto.method === 'CARD' && !dto.omiseToken?.trim()) throw new PaymentAttemptConflictError('An Omise card token is required');
    const idempotencyKey = this.idempotencyKey(user.id, orderId, idempotencyHeader);
    const attempt = await this.attempts.create({ orderId, customerId: user.id, method: dto.method, amount: before.amount, currency: before.currency, idempotencyKey });
    if (!attempt.providerChargeId) {
      const charge = dto.method === 'PROMPTPAY'
        ? await this.omise.createPromptPayCharge({ amount: attempt.amount, currency: 'THB', expiresAt: new Date(Date.now() + 15 * 60 * 1000), description: `Order ${before.orderNumber}`, idempotencyKey: attempt.id })
        : await this.omise.createCardCharge({ amount: attempt.amount, currency: attempt.currency, token: dto.omiseToken!.trim(), description: `Order ${before.orderNumber}`, idempotencyKey: attempt.id });
      await this.attempts.attachProviderCharge(attempt.id, user.id, { chargeId: charge.chargeId, sourceId: charge.sourceId, expiresAt: charge.expiresAt, promptPayQrPayload: charge.promptPayQrPayload });
      await this.reconciliation.reconcile(attempt.id);
    }
    return this.get(user, orderId);
  }
  private idempotencyKey(customerId: string, orderId: string, value: string | undefined): string {
    const key = value?.trim();
    if (!key || key.length > 48) throw new PaymentAttemptInvalidInputError('Idempotency-Key header is required and must be at most 48 characters');
    return `customer-payment:${customerId}:${orderId}:${key}`;
  }
  private response(state: Awaited<ReturnType<PaymentAttemptRepository['findCustomerPaymentState']>> & {}): CustomerPaymentResponseDto {
    if (!state) throw new PaymentAttemptNotFoundError(); const attempt = state.attempt;
    return { orderId: state.orderId, orderNumber: state.orderNumber, orderStatus: state.orderStatus, amount: state.amount, currency: state.currency, ...(attempt ? { attemptId: attempt.id, method: attempt.method, status: attempt.status, expiresAt: attempt.expiresAt?.toISOString(), promptPayQrPayload: attempt.promptPayQrPayload, failureCode: attempt.failureCode ?? undefined } : {}) };
  }
}
