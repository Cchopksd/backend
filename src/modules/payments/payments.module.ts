import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { OmiseModule } from '../../integrations/omise/omise.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { OmiseWebhookController } from './controllers/omise-webhook.controller.js';
import { CustomerPaymentsController } from './controllers/customer-payments.controller.js';
import { PaymentAttemptRepository } from './repositories/payment-attempt.repository.js';
import { PaymentWebhookRepository } from './repositories/payment-webhook.repository.js';
import { OmiseWebhookService } from './services/omise-webhook.service.js';
import { PaymentAttemptService } from './services/payment-attempt.service.js';
import { PaymentReconciliationService } from './services/payment-reconciliation.service.js';
import { CustomerPaymentService } from './services/customer-payment.service.js';

@Module({
  imports: [DatabaseModule, OmiseModule, InventoryModule],
  controllers: [OmiseWebhookController, CustomerPaymentsController],
  providers: [
    PaymentAttemptRepository,
    PaymentAttemptService,
    PaymentWebhookRepository,
    OmiseWebhookService,
    PaymentReconciliationService,
    CustomerPaymentService,
  ],
  exports: [PaymentAttemptService, PaymentReconciliationService],
})
export class PaymentsModule {}
