CREATE TYPE "LedgerType" AS ENUM ('RESTOCK', 'RESERVE', 'RELEASE', 'COMMIT', 'ADJUSTMENT');

CREATE TABLE "Inventory" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "skuId" UUID NOT NULL,
  "availableQuantity" INTEGER NOT NULL DEFAULT 0,
  "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
  "soldQuantity" INTEGER NOT NULL DEFAULT 0,
  "flashSaleAllocation" INTEGER NOT NULL DEFAULT 0,
  "incomingQuantity" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Inventory_skuId_key" UNIQUE ("skuId"),
  CONSTRAINT "Inventory_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "SKU"("id") ON DELETE CASCADE,
  CONSTRAINT "Inventory_availableQuantity_check" CHECK ("availableQuantity" >= 0),
  CONSTRAINT "Inventory_reservedQuantity_check" CHECK ("reservedQuantity" >= 0),
  CONSTRAINT "Inventory_soldQuantity_check" CHECK ("soldQuantity" >= 0),
  CONSTRAINT "Inventory_flashSaleAllocation_check" CHECK ("flashSaleAllocation" >= 0),
  CONSTRAINT "Inventory_incomingQuantity_check" CHECK ("incomingQuantity" >= 0),
  CONSTRAINT "Inventory_flashSaleAllocation_available_check" CHECK ("flashSaleAllocation" <= "availableQuantity")
);

CREATE INDEX "Inventory_updatedAt_idx" ON "Inventory"("updatedAt");

CREATE TABLE "InventoryLedger" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "skuId" UUID NOT NULL,
  "type" "LedgerType" NOT NULL,
  "quantityDelta" INTEGER NOT NULL,
  "availableDelta" INTEGER NOT NULL DEFAULT 0,
  "reservedDelta" INTEGER NOT NULL DEFAULT 0,
  "soldDelta" INTEGER NOT NULL DEFAULT 0,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "idempotencyKey" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryLedger_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryLedger_idempotencyKey_key" UNIQUE ("idempotencyKey"),
  CONSTRAINT "InventoryLedger_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "SKU"("id") ON DELETE RESTRICT
);

CREATE INDEX "InventoryLedger_skuId_createdAt_idx" ON "InventoryLedger"("skuId", "createdAt");
CREATE INDEX "InventoryLedger_referenceType_referenceId_idx" ON "InventoryLedger"("referenceType", "referenceId");
