/** Raw wire models received from Omise. Do not export outside this integration. */
export type OmiseApiError = {
  object: 'error';
  code?: string;
  message?: string;
};

export type OmiseApiSource = {
  object: 'source';
  id: string;
  type: string;
  amount: number;
  currency: string;
  scannable_code?: string | null;
};

export type OmiseApiCharge = {
  object: 'charge';
  id: string;
  status: 'pending' | 'successful' | 'failed' | 'expired';
  amount: number;
  currency: string;
  source?: OmiseApiSource | null;
  expires_at?: string | null;
  failure_code?: string | null;
  failure_message?: string | null;
};
