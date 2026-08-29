import { OmiseWebhookService } from '../services/omise-webhook.service.js';

describe('OmiseWebhookService', () => {
  const rawBody = Buffer.from(
    JSON.stringify({
      object: 'event',
      id: 'evnt_complete_1',
      key: 'charge.complete',
      data: { object: 'charge', id: 'chrg_1' },
    }),
  );
  const transaction = {};
  const prisma = {
    $transaction: vi.fn(
      async (operation: (client: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    ),
  };
  const repository = {
    eventExists: vi.fn(),
    claimEvent: vi.fn(),
    findAttempt: vi.fn(),
    lockOrder: vi.fn(),
    transitionAttempt: vi.fn(),
    transitionOrder: vi.fn(),
    markProcessed: vi.fn(),
  };
  const omise = { verifyWebhookSignature: vi.fn(), retrieveCharge: vi.fn() };
  const inventory = { commitInTransaction: vi.fn() };
  const service = new OmiseWebhookService(prisma, repository, omise, inventory);

  beforeEach(() => {
    vi.clearAllMocks();
    repository.eventExists.mockResolvedValue(false);
    repository.claimEvent.mockResolvedValue(true);
    repository.findAttempt.mockResolvedValue({
      id: 'attempt-1',
      orderId: 'order-1',
      customerId: 'customer-1',
      status: 'PENDING',
      amount: 1200,
      currency: 'THB',
      items: [{ skuId: 'sku-1', quantity: 2 }],
    });
    repository.lockOrder.mockResolvedValue({ status: 'PENDING_PAYMENT' });
    repository.transitionAttempt.mockResolvedValue(true);
    omise.retrieveCharge.mockResolvedValue({
      chargeId: 'chrg_1',
      status: 'successful',
      amount: 1200,
      currency: 'THB',
    });
  });

  it('returns success for a previously processed event without provider or inventory side effects', async () => {
    repository.eventExists.mockResolvedValue(true);

    await expect(
      service.handle(rawBody, 'signature', 'timestamp'),
    ).resolves.toEqual({ duplicate: true, ignored: false });

    expect(omise.verifyWebhookSignature).toHaveBeenCalledWith(
      rawBody,
      'signature',
      'timestamp',
    );
    expect(omise.retrieveCharge).not.toHaveBeenCalled();
    expect(inventory.commitInTransaction).not.toHaveBeenCalled();
  });

  it('claims concurrent duplicate deliveries so inventory is committed exactly once', async () => {
    repository.claimEvent
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const [first, second] = await Promise.all([
      service.handle(rawBody, 'signature', 'timestamp'),
      service.handle(rawBody, 'signature', 'timestamp'),
    ]);

    expect([first, second]).toContainEqual({
      duplicate: false,
      ignored: false,
    });
    expect([first, second]).toContainEqual({ duplicate: true, ignored: false });
    expect(inventory.commitInTransaction).toHaveBeenCalledTimes(1);
    expect(repository.transitionOrder).toHaveBeenCalledTimes(1);
    expect(repository.markProcessed).toHaveBeenCalledTimes(1);
  });
});
