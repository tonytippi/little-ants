-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('ROUTINE', 'SONG', 'CHANT', 'RHYME', 'STORY', 'BOOK', 'MOVE_AND_DO', 'TALK_SCENE', 'SOUND_TRAIL', 'TINY_TRACKS', 'HOME_HILL', 'OTHER');

-- CreateEnum
CREATE TYPE "WordKind" AS ENUM ('CORE', 'EXTRA', 'REVIEW');

-- CreateEnum
CREATE TYPE "LessonStage" AS ENUM ('HEAR_IT', 'JOIN_IN', 'SAY_IT_MYSELF', 'PARTY', 'SHOW_AND_SHARE');

-- CreateEnum
CREATE TYPE "StepKind" AS ENUM ('HELLO_CIRCLE', 'SONG', 'CHANT', 'SOUND_TRAIL', 'RHYME', 'ANT_WIGGLE', 'STORY', 'BOOK', 'MOVE_AND_DO', 'TALK_SCENE', 'TINY_TRACKS', 'CHECKPOINT', 'SHOW_AND_SHARE', 'PARTY', 'GOODBYE', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('IMAGE', 'AUDIO', 'VIDEO', 'PDF');

-- CreateEnum
CREATE TYPE "ProductionStage" AS ENUM ('TEXT', 'ENGLISH_CHECK', 'ILLUSTRATION', 'LAYOUT', 'AUDIO_VIDEO', 'TEACHER_TEST', 'PRINT_READY');

-- CreateEnum
CREATE TYPE "ProductionState" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'REVIEW', 'DONE', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Level" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "ageBand" TEXT NOT NULL,
    "lessonMinutes" TEXT NOT NULL,
    "maxClassSize" INTEGER,
    "rules" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Level_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "artAssetId" TEXT,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "leadCharacterId" TEXT,
    "leadCharacterNote" TEXT NOT NULL DEFAULT '',
    "circle" TEXT NOT NULL DEFAULT '',
    "vnLink" TEXT NOT NULL DEFAULT '',
    "bigQuestion" TEXT NOT NULL DEFAULT '',
    "value" TEXT NOT NULL DEFAULT '',
    "party" TEXT NOT NULL DEFAULT '',
    "sounds" TEXT NOT NULL DEFAULT '',
    "levelRulesNote" TEXT NOT NULL DEFAULT '',
    "links" JSONB NOT NULL DEFAULT '[]',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Word" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "partOfSpeech" TEXT NOT NULL DEFAULT '',
    "kind" "WordKind" NOT NULL DEFAULT 'CORE',
    "group" TEXT NOT NULL DEFAULT '',
    "fromUnit" TEXT NOT NULL DEFAULT '',
    "pictureBrief" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "imageAssetId" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Word_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "MaterialType" NOT NULL,
    "title" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT '',
    "targetLanguage" TEXT NOT NULL DEFAULT '',
    "fullText" TEXT NOT NULL DEFAULT '',
    "actions" TEXT NOT NULL DEFAULT '',
    "teacherNotes" TEXT NOT NULL DEFAULT '',
    "firstLesson" INTEGER,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialPage" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "imageAssetId" TEXT,
    "audioAssetId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialAsset" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MaterialAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "stage" "LessonStage" NOT NULL,
    "minutes" INTEGER NOT NULL,
    "newToday" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "goals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keyLanguage" TEXT NOT NULL DEFAULT '',
    "support" TEXT NOT NULL DEFAULT '',
    "challenge" TEXT NOT NULL DEFAULT '',
    "lookFor" TEXT NOT NULL DEFAULT '',
    "homeLink" TEXT NOT NULL DEFAULT '',
    "prepMinutes" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonStep" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "minutes" INTEGER NOT NULL,
    "kind" "StepKind" NOT NULL,
    "title" TEXT NOT NULL,
    "materialId" TEXT,
    "teacherText" TEXT NOT NULL DEFAULT '',
    "childrenText" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "LessonStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrepItem" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "materialId" TEXT,

    CONSTRAINT "PrepItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanDoGoal" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "CanDoGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GateCheck" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "gate" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "signer" TEXT NOT NULL DEFAULT '',
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "GateCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL DEFAULT '',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "previousId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'upload',
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionStatus" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "stage" "ProductionStage" NOT NULL,
    "state" "ProductionState" NOT NULL DEFAULT 'NOT_STARTED',
    "owner" TEXT NOT NULL DEFAULT '',
    "dueDate" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Revision" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitRelease" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnitRelease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Program_code_key" ON "Program"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Level_programId_number_key" ON "Level"("programId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Character_code_key" ON "Character"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_code_key" ON "Unit"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Word_cardId_key" ON "Word"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "Material_unitId_code_key" ON "Material"("unitId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialPage_materialId_number_key" ON "MaterialPage"("materialId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialAsset_materialId_assetId_role_key" ON "MaterialAsset"("materialId", "assetId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_unitId_number_key" ON "Lesson"("unitId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "LessonStep_lessonId_order_key" ON "LessonStep"("lessonId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "PrepItem_lessonId_order_key" ON "PrepItem"("lessonId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "CanDoGoal_unitId_order_key" ON "CanDoGoal"("unitId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "GateCheck_unitId_gate_order_key" ON "GateCheck"("unitId", "gate", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_storageKey_key" ON "Asset"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_previousId_key" ON "Asset"("previousId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionStatus_materialId_stage_key" ON "ProductionStatus"("materialId", "stage");

-- CreateIndex
CREATE INDEX "Revision_entityType_entityId_createdAt_idx" ON "Revision"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UnitRelease_unitId_version_key" ON "UnitRelease"("unitId", "version");

-- AddForeignKey
ALTER TABLE "Level" ADD CONSTRAINT "Level_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_artAssetId_fkey" FOREIGN KEY ("artAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_leadCharacterId_fkey" FOREIGN KEY ("leadCharacterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Word" ADD CONSTRAINT "Word_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Word" ADD CONSTRAINT "Word_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialPage" ADD CONSTRAINT "MaterialPage_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialPage" ADD CONSTRAINT "MaterialPage_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialPage" ADD CONSTRAINT "MaterialPage_audioAssetId_fkey" FOREIGN KEY ("audioAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialAsset" ADD CONSTRAINT "MaterialAsset_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialAsset" ADD CONSTRAINT "MaterialAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonStep" ADD CONSTRAINT "LessonStep_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonStep" ADD CONSTRAINT "LessonStep_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepItem" ADD CONSTRAINT "PrepItem_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepItem" ADD CONSTRAINT "PrepItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanDoGoal" ADD CONSTRAINT "CanDoGoal_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateCheck" ADD CONSTRAINT "GateCheck_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_previousId_fkey" FOREIGN KEY ("previousId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionStatus" ADD CONSTRAINT "ProductionStatus_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitRelease" ADD CONSTRAINT "UnitRelease_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitRelease" ADD CONSTRAINT "UnitRelease_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
