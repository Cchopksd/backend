import { Injectable } from '@nestjs/common';
import { RabbitMqService } from './rabbitmq.service.js';
import {
  JOB_QUEUES,
  type NotificationJob,
  type PaymentReconciliationJob,
  type ReservationExpiryJob,
} from './job.type.js';

@Injectable()
export class JobPublisherService {
  constructor(private readonly rabbitMq: RabbitMqService) {}

  enqueueReservationExpiry(orderId: string): Promise<void> {
    return this.rabbitMq.publish(JOB_QUEUES.RESERVATION_EXPIRY, {
      id: `reservation-expiry:${orderId}`,
      type: 'reservation.expire',
      occurredAt: new Date().toISOString(),
      payload: { orderId } satisfies ReservationExpiryJob['payload'],
    });
  }

  enqueuePaymentReconciliation(paymentAttemptId: string): Promise<void> {
    return this.rabbitMq.publish(JOB_QUEUES.PAYMENT_RECONCILIATION, {
      id: `payment-reconciliation:${paymentAttemptId}`,
      type: 'payment.reconcile',
      occurredAt: new Date().toISOString(),
      payload: {
        paymentAttemptId,
      } satisfies PaymentReconciliationJob['payload'],
    });
  }

  enqueueNotification(notificationId: string): Promise<void> {
    return this.rabbitMq.publish(JOB_QUEUES.NOTIFICATION, {
      id: `notification:${notificationId}`,
      type: 'notification.send',
      occurredAt: new Date().toISOString(),
      payload: { notificationId } satisfies NotificationJob['payload'],
    });
  }
}
