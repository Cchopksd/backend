import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  OmiseConfigurationError,
  OmiseRequestError,
  OmiseResponseError,
  OmiseWebhookSignatureError,
} from './errors/omise.error.js';
import { toOmiseCharge, toOmiseSource } from './omise.mapper.js';
import type { OmiseApiError } from './types/omise-api.type.js';
import type {
  OmiseCardChargeInput,
  OmiseCharge,
  OmisePromptPayChargeInput,
} from './types/omise.type.js';

@Injectable()
export class OmiseService {
  constructor(private readonly config: ConfigService) {}

  async createCardCharge(input: OmiseCardChargeInput): Promise<OmiseCharge> {
    this.assertChargeInput(input.amount, input.currency);
    if (!input.token.trim()) throw new OmiseResponseError();
    return toOmiseCharge(
      await this.post(
        '/charges',
        this.chargeForm(input.amount, input.currency, input.description, {
          card: input.token,
        }),
      ),
    );
  }

  async createPromptPayCharge(
    input: OmisePromptPayChargeInput,
  ): Promise<OmiseCharge> {
    this.assertChargeInput(input.amount, input.currency);
    this.assertPromptPayExpiry(input.expiresAt);
    const source = toOmiseSource(
      await this.post(
        '/sources',
        this.form({
          amount: input.amount,
          currency: input.currency,
          type: 'promptpay',
        }),
      ),
    );
    return toOmiseCharge(
      await this.post(
        '/charges',
        this.chargeForm(input.amount, input.currency, input.description, {
          source: source.id,
          expires_at: input.expiresAt?.toISOString(),
        }),
      ),
    );
  }

  async retrieveCharge(chargeId: string): Promise<OmiseCharge> {
    if (!chargeId.trim()) throw new OmiseResponseError();
    return toOmiseCharge(
      await this.request(`/charges/${encodeURIComponent(chargeId)}`, 'GET'),
    );
  }

  verifyWebhookSignature(
    rawBody: Buffer,
    signatureHeader: string | undefined,
    timestampHeader: string | undefined,
  ): void {
    const secret = this.config.get<string>('omise.webhookSecret');
    if (
      !secret ||
      !signatureHeader ||
      !timestampHeader ||
      !/^\d+$/.test(timestampHeader)
    )
      throw new OmiseWebhookSignatureError();
    const timestamp = Number(timestampHeader);
    if (
      !Number.isSafeInteger(timestamp) ||
      Math.abs(Date.now() - timestamp * 1000) > 5 * 60 * 1000
    )
      throw new OmiseWebhookSignatureError();
    const expected = createHmac('sha256', Buffer.from(secret, 'base64'))
      .update(`${timestampHeader}.`)
      .update(rawBody)
      .digest();
    const matches = signatureHeader.split(',').some((signature) => {
      if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
      return timingSafeEqual(Buffer.from(signature, 'hex'), expected);
    });
    if (!matches) throw new OmiseWebhookSignatureError();
  }

  private async post(path: string, body: URLSearchParams): Promise<unknown> {
    return this.request(path, 'POST', body);
  }

  private async request(
    path: string,
    method: 'GET' | 'POST',
    body?: URLSearchParams,
  ): Promise<unknown> {
    const secretKey = this.config.get<string>('omise.secretKey');
    if (!secretKey) throw new OmiseConfigurationError();
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.get<number>('omise.timeoutMs') ?? 10000,
    );
    try {
      const options: RequestInit = {
        method,
        headers: {
          Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
          ...(body
            ? { 'Content-Type': 'application/x-www-form-urlencoded' }
            : {}),
        },
        signal: controller.signal,
      };
      if (body) options.body = body;
      const response = await fetch(
        `${this.config.get<string>('omise.apiUrl') ?? 'https://api.omise.co'}${path}`,
        options,
      );
      const payload: unknown = await response.json().catch(() => undefined);
      if (!response.ok)
        throw new OmiseRequestError(this.errorCode(payload), response.status);
      return payload;
    } catch (error: unknown) {
      if (
        error instanceof OmiseConfigurationError ||
        error instanceof OmiseRequestError ||
        error instanceof OmiseResponseError
      )
        throw error;
      throw new OmiseRequestError(undefined, 502);
    } finally {
      clearTimeout(timeout);
    }
  }

  private chargeForm(
    amount: number,
    currency: string,
    description: string | undefined,
    extra: Record<string, string | undefined>,
  ): URLSearchParams {
    return this.form({ amount, currency, description, ...extra });
  }
  private form(
    values: Record<string, string | number | undefined>,
  ): URLSearchParams {
    const form = new URLSearchParams();
    for (const [key, value] of Object.entries(values))
      if (value !== undefined) form.set(key, String(value));
    return form;
  }
  private assertChargeInput(amount: number, currency: string): void {
    if (
      !Number.isSafeInteger(amount) ||
      amount <= 0 ||
      !/^[A-Z]{3}$/.test(currency)
    )
      throw new OmiseResponseError();
  }
  private assertPromptPayExpiry(expiresAt: Date | undefined): void {
    if (!expiresAt) return;
    const milliseconds = expiresAt.getTime() - Date.now();
    if (
      !Number.isFinite(expiresAt.getTime()) ||
      milliseconds <= 0 ||
      milliseconds > 24 * 60 * 60 * 1000
    )
      throw new OmiseResponseError();
  }
  private errorCode(value: unknown): string | undefined {
    return typeof value === 'object' &&
      value !== null &&
      (value as OmiseApiError).object === 'error' &&
      typeof (value as OmiseApiError).code === 'string'
      ? (value as OmiseApiError).code
      : undefined;
  }
}
