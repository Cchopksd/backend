CREATE TABLE "FlashSalePurchase" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "flashSaleId" UUID NOT NULL, "skuId" UUID NOT NULL, "userId" UUID NOT NULL, "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FlashSalePurchase_pkey" PRIMARY KEY ("id"), CONSTRAINT "FlashSalePurchase_flashSaleId_skuId_userId_key" UNIQUE ("flashSaleId", "skuId", "userId"),
  CONSTRAINT "FlashSalePurchase_flashSaleId_fkey" FOREIGN KEY ("flashSaleId") REFERENCES "FlashSale"("id") ON DELETE CASCADE,
  CONSTRAINT "FlashSalePurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "FlashSalePurchase_quantity_check" CHECK ("quantity" > 0)
);
CREATE TABLE "FlashSaleReservation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "flashSaleId" UUID NOT NULL, "skuId" UUID NOT NULL, "userId" UUID NOT NULL, "quantity" INTEGER NOT NULL,
  "referenceId" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FlashSaleReservation_pkey" PRIMARY KEY ("id"), CONSTRAINT "FlashSaleReservation_idempotencyKey_key" UNIQUE ("idempotencyKey"),
  CONSTRAINT "FlashSaleReservation_flashSaleId_fkey" FOREIGN KEY ("flashSaleId") REFERENCES "FlashSale"("id") ON DELETE RESTRICT,
  CONSTRAINT "FlashSaleReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT,
  CONSTRAINT "FlashSaleReservation_quantity_check" CHECK ("quantity" > 0)
);
CREATE INDEX "FlashSaleReservation_flashSaleId_skuId_userId_idx" ON "FlashSaleReservation"("flashSaleId", "skuId", "userId");
