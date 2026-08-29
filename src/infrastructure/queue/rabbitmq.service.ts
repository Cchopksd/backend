import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, type ChannelModel } from 'amqplib';

@Injectable()
export class RabbitMqService implements OnModuleDestroy {
  private connection?: ChannelModel;
  private readonly connectionTimeoutMs: number;
  private readonly url: string;

  constructor(configService: ConfigService) {
    this.url = configService.getOrThrow<string>('rabbitmq.url');
    this.connectionTimeoutMs = configService.getOrThrow<number>(
      'rabbitmq.connectionTimeoutMs',
    );
  }

  async getConnection(): Promise<ChannelModel> {
    if (this.connection) return this.connection;
    this.connection = await this.connectWithTimeout();
    this.connection.on('close', () => {
      this.connection = undefined;
    });
    return this.connection;
  }

  async checkConnection(): Promise<void> {
    await this.getConnection();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connection) await this.connection.close();
  }

  private async connectWithTimeout(): Promise<ChannelModel> {
    let timeout: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(
        () => reject(new Error('RabbitMQ connection timed out')),
        this.connectionTimeoutMs,
      );
    });
    try {
      return await Promise.race([connect(this.url), timeoutPromise]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}
