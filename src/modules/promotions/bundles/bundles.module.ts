import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module.js';
import { BundleRepository } from './repositories/bundle.repository.js';
import { BundleService } from './services/bundle.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [BundleRepository, BundleService],
  exports: [BundleService],
})
export class BundlesModule {}
