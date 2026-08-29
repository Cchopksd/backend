import { OmiseResponseError } from './errors/omise.error.js';
import type { OmiseApiCharge, OmiseApiSource } from './types/omise-api.type.js';
import type { OmiseCharge, OmiseChargeStatus } from './types/omise.type.js';

export function toOmiseCharge(value: unknown): OmiseCharge {
  if (!isCharge(value)) throw new OmiseResponseError();
  const expiresAt = toDate(value.expires_at);
  return {
    chargeId: value.id,
    sourceId: isSource(value.source) ? value.source.id : undefined,
    status: value.status,
    amount: value.amount,
    currency: value.currency,
    promptPayQrPayload: isSource(value.source)
      ? (value.source.scannable_code ?? undefined)
      : undefined,
    expiresAt,
    failureCode: stringOrUndefined(value.failure_code),
  };
}

export function toOmiseSource(value: unknown): OmiseApiSource {
  if (!isSource(value)) throw new OmiseResponseError();
  return value;
}

function isCharge(value: unknown): value is OmiseApiCharge {
  if (!isRecord(value)) return false;
  return (
    value.object === 'charge' &&
    isString(value.id) &&
    isChargeStatus(value.status) &&
    isNonNegativeInteger(value.amount) &&
    isString(value.currency) &&
    (value.source === null ||
      value.source === undefined ||
      isSource(value.source))
  );
}

function isSource(value: unknown): value is OmiseApiSource {
  if (!isRecord(value)) return false;
  return (
    value.object === 'source' &&
    isString(value.id) &&
    isString(value.type) &&
    isNonNegativeInteger(value.amount) &&
    isString(value.currency) &&
    (value.scannable_code === undefined ||
      value.scannable_code === null ||
      isString(value.scannable_code))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isString(value: unknown): value is string {
  return typeof value === 'string';
}
function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function isChargeStatus(value: unknown): value is OmiseChargeStatus {
  return (
    value === 'pending' ||
    value === 'successful' ||
    value === 'failed' ||
    value === 'expired'
  );
}
function stringOrUndefined(value: unknown): string | undefined {
  return isString(value) ? value : undefined;
}
function toDate(value: unknown): Date | undefined {
  if (!isString(value)) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
