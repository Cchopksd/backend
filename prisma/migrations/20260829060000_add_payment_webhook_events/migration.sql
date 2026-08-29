CREATE TABLE "PaymentWebhookEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "providerEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "providerChargeId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "processedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentWebhookEvent_providerEventId_key" ON "PaymentWebhookEvent"("providerEventId");
CREATE INDEX "PaymentWebhookEvent_providerChargeId_createdAt_idx" ON "PaymentWebhookEvent"("providerChargeId", "createdAt");
