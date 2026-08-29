CREATE TABLE "EmailOtpChallenge" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "usedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailOtpChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailOtpChallenge_email_createdAt_idx" ON "EmailOtpChallenge"("email", "createdAt");
CREATE INDEX "EmailOtpChallenge_expiresAt_idx" ON "EmailOtpChallenge"("expiresAt");
