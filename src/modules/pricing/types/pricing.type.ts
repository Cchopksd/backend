export type PricingRequest = {
  userId: string;
  items: Array<{ skuId: string; quantity: number; flashSaleId?: string }>;
  bundles?: Array<{ bundleId: string; quantity?: number }>;
  couponCode?: string;
  /** Must be computed by the shipping domain, never accepted from an HTTP client. */
  shippingAmount: number;
  now?: Date;
};

export type PricingBreakdown = {
  currency: string;
  baseSubtotalAmount: number;
  flashSaleDiscountAmount: number;
  subtotalAfterFlashSaleAmount: number;
  bundleDiscountAmount: number;
  subtotalAfterBundleAmount: number;
  couponDiscountAmount: number;
  subtotalAfterCouponAmount: number;
  shippingAmount: number;
  finalAmount: number;
  coupon?: {
    couponId?: string;
    couponCode: string;
    state: string;
    discountAmount: number;
  };
  items: Array<{
    skuId: string;
    productId: string;
    categoryId: string | null;
    quantity: number;
    baseUnitPriceAmount: number;
    flashSaleQuantity: number;
    amountAfterFlashSale: number;
    amountAfterBundle: number;
  }>;
};

export type PricedSku = {
  skuId: string;
  productId: string;
  categoryId: string | null;
  unitPriceAmount: number;
  currency: string;
};
