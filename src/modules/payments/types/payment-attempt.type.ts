export type PaymentAttemptStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
export type PaymentMethod = 'CARD' | 'PROMPTPAY';

export type PaymentAttempt = {
  id: string;
  orderId: string;
  customerId: string;
  attemptNumber: number;
  method: PaymentMethod;
  status: PaymentAttemptStatus;
  amount: number;
  currency: string;
  providerChargeId: string | null;
  providerSourceId: string | null;
  failureCode: string | null;
  expiresAt: Date | null;
  completedAt: Date | null;
};

export type CreatePaymentAttemptInput = {
  orderId: string;
  customerId: string;
  method: PaymentMethod;
  amount: number;
  currency: string;
  idempotencyKey: string;
};

export type ProviderChargeDetails = {
  chargeId: string;
  sourceId?: string;
  expiresAt?: Date;
};
