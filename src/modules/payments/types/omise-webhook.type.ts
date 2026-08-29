export type OmiseChargeCompleteEvent = {
  eventId: string;
  chargeId: string;
};

export type VerifiedCharge = {
  chargeId: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
  amount: number;
  currency: string;
  failureCode?: string;
};
