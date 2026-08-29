CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CHECKED_OUT', 'ABANDONED');

CREATE TABLE "Cart" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
  "currency" CHAR(3) NOT NULL DEFAULT 'THB',
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Cart_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Cart_userId_key" UNIQUE ("userId"),
  CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX "Cart_status_updatedAt_idx" ON "Cart"("status", "updatedAt");

CREATE TABLE "CartItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "cartId" UUID NOT NULL,
  "skuId" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "selected" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CartItem_cartId_skuId_key" UNIQUE ("cartId", "skuId"),
  CONSTRAINT "CartItem_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE,
  CONSTRAINT "CartItem_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "SKU"("id") ON DELETE RESTRICT
);

CREATE INDEX "CartItem_skuId_idx" ON "CartItem"("skuId");
