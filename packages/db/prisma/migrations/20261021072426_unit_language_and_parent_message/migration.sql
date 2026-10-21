-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "keyLanguage" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "parentMessage" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "soundDetails" JSONB NOT NULL DEFAULT '[]';
