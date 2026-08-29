import { registerAs } from '@nestjs/config';

export default registerAs('rabbitmq', () => ({
  url: process.env.RABBITMQ_URL ?? 'amqp://localhost:5672',
  connectionTimeoutMs: Number(
    process.env.RABBITMQ_CONNECTION_TIMEOUT_MS ?? 5000,
  ),
}));
