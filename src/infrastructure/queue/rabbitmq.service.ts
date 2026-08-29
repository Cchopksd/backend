import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  connect,
  type Channel,
  type ChannelModel,
  type ConsumeMessage,
} from 'amqplib';
import { parseJob, type JobQueue, type WorkerJob } from './job.type.js';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

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

  async publish(
    queue: JobQueue,
    job: WorkerJob,
    retryCount = 0,
  ): Promise<void> {
    const channel = await (await this.getConnection()).createConfirmChannel();
    try {
      await this.assertQueues(channel, queue);
      channel.sendToQueue(queue, Buffer.from(JSON.stringify(job)), {
        persistent: true,
        messageId: job.id,
        contentType: 'application/json',
        headers: { 'x-retry-count': retryCount },
      });
      await channel.waitForConfirms();
    } finally {
      await channel.close();
    }
  }

  async consume(
    queue: JobQueue,
    handler: (job: WorkerJob) => Promise<void>,
  ): Promise<void> {
    const channel = await (await this.getConnection()).createChannel();
    await this.assertQueues(channel, queue);
    await channel.prefetch(1);
    await channel.consume(
      queue,
      async (message) => this.handleMessage(channel, queue, message, handler),
      { noAck: false },
    );
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

  private async handleMessage(
    channel: Channel,
    queue: JobQueue,
    message: ConsumeMessage | null,
    handler: (job: WorkerJob) => Promise<void>,
  ): Promise<void> {
    if (!message) return;
    const job = this.parse(queue, message.content);
    if (!job) {
      channel.reject(message, false);
      return;
    }
    try {
      await handler(job);
      channel.ack(message);
    } catch {
      const retryCount = Number(
        message.properties.headers?.['x-retry-count'] ?? 0,
      );
      if (!Number.isSafeInteger(retryCount) || retryCount >= MAX_RETRIES) {
        channel.sendToQueue(`${queue}.dead`, message.content, {
          persistent: true,
          messageId: job.id,
          contentType: 'application/json',
          headers: message.properties.headers,
        });
        channel.ack(message);
        return;
      }
      channel.sendToQueue(`${queue}.retry`, message.content, {
        persistent: true,
        messageId: job.id,
        contentType: 'application/json',
        headers: {
          ...message.properties.headers,
          'x-retry-count': retryCount + 1,
        },
      });
      channel.ack(message);
    }
  }

  private parse(queue: JobQueue, content: Buffer): WorkerJob | null {
    try {
      return parseJob(queue, JSON.parse(content.toString('utf8')) as unknown);
    } catch {
      return null;
    }
  }

  private async assertQueues(channel: Channel, queue: JobQueue): Promise<void> {
    await channel.assertQueue(queue, { durable: true });
    await channel.assertQueue(`${queue}.retry`, {
      durable: true,
      arguments: {
        'x-message-ttl': RETRY_DELAY_MS,
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': queue,
      },
    });
    await channel.assertQueue(`${queue}.dead`, { durable: true });
  }
}
