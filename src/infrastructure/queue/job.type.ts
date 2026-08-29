export const JOB_QUEUES = {
  RESERVATION_EXPIRY: 'commerce.reservation-expiry',
  PAYMENT_RECONCILIATION: 'commerce.payment-reconciliation',
  NOTIFICATION: 'commerce.notification',
} as const;

export type JobQueue = (typeof JOB_QUEUES)[keyof typeof JOB_QUEUES];
export type ReservationExpiryJob = {
  id: string;
  type: 'reservation.expire';
  occurredAt: string;
  payload: { orderId: string };
};
export type PaymentReconciliationJob = {
  id: string;
  type: 'payment.reconcile';
  occurredAt: string;
  payload: { paymentAttemptId: string };
};
export type NotificationJob = {
  id: string;
  type: 'notification.send';
  occurredAt: string;
  payload: { notificationId: string };
};
export type WorkerJob =
  ReservationExpiryJob | PaymentReconciliationJob | NotificationJob;

export function parseJob(queue: JobQueue, value: unknown): WorkerJob | null {
  if (
    !isRecord(value) ||
    !isId(value.id) ||
    !isDate(value.occurredAt) ||
    !isRecord(value.payload)
  )
    return null;
  if (
    queue === JOB_QUEUES.RESERVATION_EXPIRY &&
    value.type === 'reservation.expire' &&
    isId(value.payload.orderId)
  )
    return {
      id: value.id,
      type: value.type,
      occurredAt: value.occurredAt,
      payload: { orderId: value.payload.orderId },
    };
  if (
    queue === JOB_QUEUES.PAYMENT_RECONCILIATION &&
    value.type === 'payment.reconcile' &&
    isId(value.payload.paymentAttemptId)
  )
    return {
      id: value.id,
      type: value.type,
      occurredAt: value.occurredAt,
      payload: { paymentAttemptId: value.payload.paymentAttemptId },
    };
  if (
    queue === JOB_QUEUES.NOTIFICATION &&
    value.type === 'notification.send' &&
    isId(value.payload.notificationId)
  )
    return {
      id: value.id,
      type: value.type,
      occurredAt: value.occurredAt,
      payload: { notificationId: value.payload.notificationId },
    };
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128;
}
function isDate(value: unknown): value is string {
  return (
    typeof value === 'string' && Number.isFinite(new Date(value).getTime())
  );
}
