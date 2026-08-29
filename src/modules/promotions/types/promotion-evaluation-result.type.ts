export type PromotionEvaluationState =
  'eligible' | 'ineligible' | 'upcoming' | 'active' | 'exhausted' | 'expired';

/** A transport-independent result that checkout and promotion types can share. */
export type PromotionEvaluationResult = {
  state: PromotionEvaluationState;
  discountAmount: number;
  applicableSubtotalAmount: number;
  reason?: string;
};
