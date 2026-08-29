CREATE TABLE "WorkerJobExecution" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "jobId" TEXT NOT NULL,
  "jobType" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkerJobExecution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkerJobExecution_jobId_key" ON "WorkerJobExecution"("jobId");
