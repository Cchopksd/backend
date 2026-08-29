import { JOB_QUEUES, parseJob } from './job.type.js';

describe('worker job validation', () => {
  it('accepts only the matching typed payload for a queue', () => {
    expect(
      parseJob(JOB_QUEUES.RESERVATION_EXPIRY, {
        id: 'reservation-expiry:order-1',
        type: 'reservation.expire',
        occurredAt: '2026-08-29T00:00:00.000Z',
        payload: { orderId: 'order-1' },
      }),
    ).toMatchObject({ type: 'reservation.expire' });
    expect(
      parseJob(JOB_QUEUES.RESERVATION_EXPIRY, {
        id: 'wrong',
        type: 'payment.reconcile',
        occurredAt: '2026-08-29T00:00:00.000Z',
        payload: { paymentAttemptId: 'attempt-1' },
      }),
    ).toBeNull();
  });

  it('rejects malformed job envelopes before a processor sees them', () => {
    expect(
      parseJob(JOB_QUEUES.PAYMENT_RECONCILIATION, {
        id: '',
        type: 'payment.reconcile',
        occurredAt: 'not-a-date',
        payload: {},
      }),
    ).toBeNull();
  });
});
