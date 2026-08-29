import { registerAs } from '@nestjs/config';

export default registerAs('omise', () => ({
  secretKey: process.env.OMISE_SECRET_KEY,
  webhookSecret: process.env.OMISE_WEBHOOK_SECRET,
  apiUrl: process.env.OMISE_API_URL ?? 'https://api.omise.co',
  timeoutMs: Number(process.env.OMISE_TIMEOUT_MS ?? 10000),
}));
