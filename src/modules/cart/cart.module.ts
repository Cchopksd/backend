import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { PricingModule } from '../pricing/pricing.module.js';
import { BundlesModule } from '../promotions/bundles/bundles.module.js';
import { CartController } from './controllers/cart.controller.js';
import { CartRepository } from './repositories/cart.repository.js';
import { CartService } from './services/cart.service.js';

@Module({
  imports: [DatabaseModule, AuthModule, PricingModule, BundlesModule],
  controllers: [CartController],
  providers: [CartRepository, CartService],
  exports: [CartService],
})
export class CartModule {}
