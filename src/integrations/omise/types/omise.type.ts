export type OmiseChargeStatus = 'pending' | 'successful' | 'failed' | 'expired';

export type OmiseCardChargeInput = {
  amount: number;
  currency: string;
  token: string;
  description?: string;
  idempotencyKey?: string;
};

export type OmisePromptPayChargeInput = {
  amount: number;
  currency: 'THB';
  expiresAt?: Date;
  description?: string;
  idempotencyKey?: string;
};

export type OmiseCharge = {
  chargeId: string;
  sourceId?: string;
  status: OmiseChargeStatus;
  amount: number;
  currency: string;
  promptPayQrPayload?: string;
  expiresAt?: Date;
  failureCode?: string;
};
