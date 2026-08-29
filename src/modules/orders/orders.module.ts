import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { PricingModule } from '../pricing/pricing.module.js';
import { CouponsModule } from '../promotions/coupons/coupons.module.js';
import { FlashSalesModule } from '../promotions/flash-sales/flash-sales.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { OrdersController } from './controllers/orders.controller.js';
import { OrdersRepository } from './repositories/orders.repository.js';
import { CheckoutService } from './services/checkout.service.js';
import { ReservationExpiryService } from './services/reservation-expiry.service.js';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    InventoryModule,
    PricingModule,
    CouponsModule,
    FlashSalesModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersRepository, CheckoutService, ReservationExpiryService],
  exports: [ReservationExpiryService],
})
export class OrdersModule {}
