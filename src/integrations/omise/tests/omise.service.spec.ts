import { OmiseService } from '../omise.service.js';
import type { ConfigService } from '@nestjs/config';

describe('OmiseService', () => {
  const config = {
    get: vi.fn(
      (key: string) =>
        ({
          'omise.secretKey': 'skey_test_secret',
          'omise.apiUrl': 'https://api.omise.co',
          'omise.timeoutMs': 1000,
        })[key],
    ),
  };
  const service = new OmiseService(config as ConfigService);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a card charge from an Omise token without accepting card details', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        object: 'charge',
        id: 'chrg_card',
        status: 'successful',
        amount: 1200,
        currency: 'THB',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      service.createCardCharge({
        amount: 1200,
        currency: 'THB',
        token: 'tokn_test',
      }),
    ).resolves.toMatchObject({ chargeId: 'chrg_card', status: 'successful' });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(options.body)).toContain('card=tokn_test');
    expect(String(options.body)).not.toContain('number=');
  });

  it('creates a PromptPay source and charge with QR data and expiry', async () => {
    const expiry = new Date(Date.now() + 5 * 60 * 1000);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          object: 'source',
          id: 'src_promptpay',
          type: 'promptpay',
          amount: 1200,
          currency: 'THB',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          object: 'charge',
          id: 'chrg_promptpay',
          status: 'pending',
          amount: 1200,
          currency: 'THB',
          expires_at: expiry.toISOString(),
          source: {
            object: 'source',
            id: 'src_promptpay',
            type: 'promptpay',
            amount: 1200,
            currency: 'THB',
            scannable_code: '000201',
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      service.createPromptPayCharge({
        amount: 1200,
        currency: 'THB',
        expiresAt: expiry,
      }),
    ).resolves.toMatchObject({
      chargeId: 'chrg_promptpay',
      sourceId: 'src_promptpay',
      promptPayQrPayload: '000201',
      expiresAt: expiry,
    });

    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.omise.co/sources');
    expect(String((fetchMock.mock.calls[0]![1] as RequestInit).body)).toContain(
      'type=promptpay',
    );
    expect(String((fetchMock.mock.calls[1]![1] as RequestInit).body)).toContain(
      'expires_at=',
    );
  });

  it('sends a stable provider idempotency key for concurrent card-charge retries', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: vi.fn().mockResolvedValue({ object: 'charge', id: 'chrg_card', status: 'pending', amount: 1200, currency: 'THB' }) });
    vi.stubGlobal('fetch', fetchMock);
    await Promise.all([service.createCardCharge({ amount: 1200, currency: 'THB', token: 'tokn_test', idempotencyKey: 'attempt-1' }), service.createCardCharge({ amount: 1200, currency: 'THB', token: 'tokn_test', idempotencyKey: 'attempt-1' })]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0]![1] as RequestInit).headers).toMatchObject({ 'Idempotency-Key': 'attempt-1' });
    expect((fetchMock.mock.calls[1]![1] as RequestInit).headers).toMatchObject({ 'Idempotency-Key': 'attempt-1' });
  });
});
