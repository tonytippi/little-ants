-- CreateEnum
CREATE TYPE "ImportRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL,
    "status" "ImportRunStatus" NOT NULL DEFAULT 'QUEUED',
    "requestedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "message" TEXT NOT NULL DEFAULT '',
    "report" TEXT,
    "archive" TEXT,

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportRun_status_createdAt_idx" ON "ImportRun"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ImportRun" ADD CONSTRAINT "ImportRun_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
