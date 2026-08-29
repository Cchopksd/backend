import { Module } from '@nestjs/common';
import { RabbitMqService } from './rabbitmq.service.js';
import { JobPublisherService } from './job-publisher.service.js';

@Module({
  providers: [RabbitMqService, JobPublisherService],
  exports: [RabbitMqService, JobPublisherService],
})
export class RabbitMqModule {}
