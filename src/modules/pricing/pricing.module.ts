import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { PromotionsModule } from '../promotions/promotions.module.js';
import { PricingRepository } from './repositories/pricing.repository.js';
import { PricingService } from './services/pricing.service.js';

@Module({
  imports: [DatabaseModule, PromotionsModule],
  providers: [PricingRepository, PricingService],
  exports: [PricingService],
})
export class PricingModule {}
