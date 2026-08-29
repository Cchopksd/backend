import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module.js';
import { FlashSaleRepository } from './repositories/flash-sale.repository.js';
import { FlashSaleService } from './services/flash-sale.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [FlashSaleRepository, FlashSaleService],
  exports: [FlashSaleService],
})
export class FlashSalesModule {}
