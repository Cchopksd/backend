import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { AppConfigModule } from './config/app-config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { CacheModule } from './infrastructure/cache/cache.module.js';
import { LoggingModule } from './infrastructure/logging/logging.module.js';
import { RabbitMqModule } from './infrastructure/queue/rabbitmq.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { CartModule } from './modules/cart/cart.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { PromotionsModule } from './modules/promotions/promotions.module.js';
import { PricingModule } from './modules/pricing/pricing.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    DatabaseModule,
    CacheModule,
    RabbitMqModule,
    AuthModule,
    CatalogModule,
    CartModule,
    InventoryModule,
    PromotionsModule,
    PricingModule,
    OrdersModule,
    PaymentsModule,
    HealthModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
