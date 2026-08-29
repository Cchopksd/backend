import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { InventoryRepository } from './repositories/inventory.repository.js';
import { InventoryService } from './services/inventory.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [InventoryRepository, InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
