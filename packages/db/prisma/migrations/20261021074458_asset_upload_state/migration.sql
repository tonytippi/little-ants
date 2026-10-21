-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "pendingReplacesId" TEXT,
ADD COLUMN     "uploaded" BOOLEAN NOT NULL DEFAULT true;
