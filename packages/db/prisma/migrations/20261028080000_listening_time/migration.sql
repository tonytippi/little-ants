-- CreateTable
CREATE TABLE "ListeningLog" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "unitCode" TEXT NOT NULL,
    "leaf" INTEGER NOT NULL,
    "playedOn" DATE NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "itemsHeard" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListeningLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassListeningRun" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "unitCode" TEXT NOT NULL,
    "leaf" INTEGER NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL,
    "teacherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassListeningRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListeningLog_clientId_key" ON "ListeningLog"("clientId");

-- CreateIndex
CREATE INDEX "ListeningLog_studentId_unitCode_idx" ON "ListeningLog"("studentId", "unitCode");

-- CreateIndex
CREATE INDEX "ListeningLog_studentId_playedOn_idx" ON "ListeningLog"("studentId", "playedOn");

-- CreateIndex
CREATE UNIQUE INDEX "ClassListeningRun_clientId_key" ON "ClassListeningRun"("clientId");

-- CreateIndex
CREATE INDEX "ClassListeningRun_classId_unitCode_idx" ON "ClassListeningRun"("classId", "unitCode");

-- AddForeignKey
ALTER TABLE "ListeningLog" ADD CONSTRAINT "ListeningLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassListeningRun" ADD CONSTRAINT "ClassListeningRun_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassListeningRun" ADD CONSTRAINT "ClassListeningRun_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

