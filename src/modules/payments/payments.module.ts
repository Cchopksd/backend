import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { OmiseModule } from '../../integrations/omise/omise.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { OmiseWebhookController } from './controllers/omise-webhook.controller.js';
import { PaymentAttemptRepository } from './repositories/payment-attempt.repository.js';
import { PaymentWebhookRepository } from './repositories/payment-webhook.repository.js';
import { OmiseWebhookService } from './services/omise-webhook.service.js';
import { PaymentAttemptService } from './services/payment-attempt.service.js';
import { PaymentReconciliationService } from './services/payment-reconciliation.service.js';

@Module({
  imports: [DatabaseModule, OmiseModule, InventoryModule],
  controllers: [OmiseWebhookController],
  providers: [
    PaymentAttemptRepository,
    PaymentAttemptService,
    PaymentWebhookRepository,
    OmiseWebhookService,
    PaymentReconciliationService,
  ],
  exports: [PaymentAttemptService, PaymentReconciliationService],
})
export class PaymentsModule {}
