import { Module } from '@nestjs/common';
import { BundlesModule } from './bundles/bundles.module.js';
import { CouponsModule } from './coupons/coupons.module.js';
import { FlashSalesModule } from './flash-sales/flash-sales.module.js';

@Module({
  imports: [BundlesModule, CouponsModule, FlashSalesModule],
  exports: [BundlesModule, CouponsModule, FlashSalesModule],
})
export class PromotionsModule {}
