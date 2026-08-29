import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { RedisService } from '../infrastructure/cache/redis.service.js';
import { RabbitMqService } from '../infrastructure/queue/rabbitmq.service.js';

type DependencyStatus = 'up' | 'down';

export type ReadinessStatus = {
  status: 'ok';
  dependencies: {
    database: DependencyStatus;
    redis: DependencyStatus;
    rabbitmq: DependencyStatus;
  };
};

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rabbitMq: RabbitMqService,
  ) {}

  async getReadiness(): Promise<ReadinessStatus> {
    const [database, redis, rabbitmq] = await Promise.all([
      this.check(() => this.prisma.checkConnection()),
      this.check(() => this.redis.ping()),
      this.check(() => this.rabbitMq.checkConnection()),
    ]);
    const dependencies = { database, redis, rabbitmq };

    if (Object.values(dependencies).some((status) => status === 'down')) {
      throw new ServiceUnavailableException({
        error: 'Service Unavailable',
        message: 'Infrastructure dependencies are unavailable',
        dependencies,
      });
    }

    return { status: 'ok', dependencies };
  }

  private async check(
    operation: () => Promise<void>,
  ): Promise<DependencyStatus> {
    try {
      await operation();
      return 'up';
    } catch {
      return 'down';
    }
  }
}
