import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { CacheModule } from '../infrastructure/cache/cache.module.js';
import { RabbitMqModule } from '../infrastructure/queue/rabbitmq.module.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

@Module({
  imports: [DatabaseModule, CacheModule, RabbitMqModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
