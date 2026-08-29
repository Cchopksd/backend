import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { AppConfigModule } from './config/app-config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { CacheModule } from './infrastructure/cache/cache.module.js';
import { LoggingModule } from './infrastructure/logging/logging.module.js';
import { RabbitMqModule } from './infrastructure/queue/rabbitmq.module.js';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    DatabaseModule,
    CacheModule,
    RabbitMqModule,
    HealthModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
