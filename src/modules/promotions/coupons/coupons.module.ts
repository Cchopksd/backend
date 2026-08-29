import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module.js';
import { CouponRepository } from './repositories/coupon.repository.js';
import { CouponService } from './services/coupon.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [CouponRepository, CouponService],
  exports: [CouponService],
})
export class CouponsModule {}
