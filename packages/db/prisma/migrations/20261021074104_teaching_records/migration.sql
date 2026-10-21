-- CreateEnum
CREATE TYPE "ObservationLevel" AS ENUM ('NOT_YET', 'WITH_HELP', 'ON_MY_OWN');

-- CreateTable
CREATE TABLE "LessonRun" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "unitCode" TEXT NOT NULL,
    "lessonNumber" INTEGER NOT NULL,
    "releaseVersion" INTEGER NOT NULL,
    "teacherId" TEXT NOT NULL,
    "taughtAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Observation" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "unitCode" TEXT NOT NULL,
    "goalOrder" INTEGER NOT NULL,
    "level" "ObservationLevel" NOT NULL,
    "lessonNumber" INTEGER,
    "teacherId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Observation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LessonRun_clientId_key" ON "LessonRun"("clientId");

-- CreateIndex
CREATE INDEX "LessonRun_classId_taughtAt_idx" ON "LessonRun"("classId", "taughtAt");

-- CreateIndex
CREATE UNIQUE INDEX "Observation_clientId_key" ON "Observation"("clientId");

-- CreateIndex
CREATE INDEX "Observation_classId_unitCode_idx" ON "Observation"("classId", "unitCode");

-- CreateIndex
CREATE INDEX "Observation_studentId_unitCode_goalOrder_observedAt_idx" ON "Observation"("studentId", "unitCode", "goalOrder", "observedAt");

-- AddForeignKey
ALTER TABLE "LessonRun" ADD CONSTRAINT "LessonRun_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonRun" ADD CONSTRAINT "LessonRun_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
