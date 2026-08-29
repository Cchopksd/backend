CREATE TABLE "CouponUsage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "couponId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponUsage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CouponUsage_couponId_userId_key" UNIQUE ("couponId", "userId"),
  CONSTRAINT "CouponUsage_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE,
  CONSTRAINT "CouponUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "CouponUsage_usageCount_check" CHECK ("usageCount" >= 0)
);

CREATE INDEX "CouponUsage_userId_idx" ON "CouponUsage"("userId");

CREATE TABLE "CouponRedemption" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "couponId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "referenceId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CouponRedemption_couponId_referenceId_key" UNIQUE ("couponId", "referenceId"),
  CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT,
  CONSTRAINT "CouponRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT
);

CREATE INDEX "CouponRedemption_userId_createdAt_idx" ON "CouponRedemption"("userId", "createdAt");
