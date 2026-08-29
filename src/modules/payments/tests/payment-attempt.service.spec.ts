import {
  PaymentAttemptConflictError,
  PaymentAttemptInvalidInputError,
} from '../errors/payment-attempt.error.js';
import { PaymentAttemptService } from '../services/payment-attempt.service.js';

describe('PaymentAttemptService', () => {
  const input = {
    orderId: 'order-id',
    customerId: 'customer-id',
    method: 'CARD' as const,
    amount: 1200,
    currency: 'THB',
    idempotencyKey: 'attempt-key',
  };
  const attempt = {
    id: 'attempt-id',
    orderId: input.orderId,
    customerId: input.customerId,
    attemptNumber: 2,
    method: input.method,
    status: 'PENDING' as const,
    amount: input.amount,
    currency: input.currency,
    providerChargeId: null,
    providerSourceId: null,
    failureCode: null,
    expiresAt: null,
    completedAt: null,
  };
  const repository = {
    create: vi.fn(),
    attachProviderCharge: vi.fn(),
    finalize: vi.fn(),
  };
  const service = new PaymentAttemptService(repository);

  beforeEach(() => {
    vi.clearAllMocks();
    repository.create.mockResolvedValue(attempt);
  });

  it('creates a new, numbered payment attempt instead of mutating prior attempts', async () => {
    await expect(service.create(input)).resolves.toMatchObject({
      id: 'attempt-id',
      attemptNumber: 2,
      status: 'PENDING',
    });
    expect(repository.create).toHaveBeenCalledWith(input);
  });

  it('does not expose another attempt through a reused idempotency key', async () => {
    repository.create.mockResolvedValue({
      ...attempt,
      customerId: 'another-customer',
    });
    await expect(service.create(input)).rejects.toBeInstanceOf(
      PaymentAttemptConflictError,
    );
  });

  it('allows only an idempotent terminal-state replay, never a terminal-state rewrite', async () => {
    repository.finalize.mockResolvedValue({ ...attempt, status: 'FAILED' });
    await expect(
      service.finalize('attempt-id', 'customer-id', 'FAILED', 'declined'),
    ).resolves.toMatchObject({ status: 'FAILED' });

    repository.finalize.mockResolvedValue({ ...attempt, status: 'SUCCESS' });
    await expect(
      service.finalize('attempt-id', 'customer-id', 'FAILED'),
    ).rejects.toBeInstanceOf(PaymentAttemptConflictError);
  });

  it('rejects amounts that do not use currency subunits', async () => {
    await expect(
      service.create({ ...input, amount: 0 }),
    ).rejects.toBeInstanceOf(PaymentAttemptInvalidInputError);
  });
});
