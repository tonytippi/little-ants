-- Schools above campuses, classes with a unit history, children enrolled in classes over time, and teaching as
-- a school role. Existing campuses, classes, children and teachers move into one "Little Ants Test School".

-- CreateEnum
CREATE TYPE "SchoolRole" AS ENUM ('SCHOOL_ADMIN', 'TEACHER');
CREATE TYPE "ClassStatus" AS ENUM ('ACTIVE', 'MERGED', 'STOPPED');
CREATE TYPE "EnrollmentEnd" AS ENUM ('LEFT', 'MOVED', 'MERGED', 'CLASS_STOPPED');

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SchoolStaff" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "role" "SchoolRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolStaff_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClassUnitRun" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "startedOn" DATE NOT NULL,
    "endedOn" DATE,

    CONSTRAINT "ClassUnitRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "startedOn" DATE NOT NULL,
    "endedOn" DATE,
    "endReason" "EnrollmentEnd",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- The school that receives existing data (only created when there is something to move).
INSERT INTO "School" ("id", "name")
SELECT 'school-test', 'Little Ants Test School'
WHERE EXISTS (SELECT 1 FROM "Campus")
   OR EXISTS (SELECT 1 FROM "user" WHERE 'TEACHER' = ANY ("roles"))
   OR EXISTS (SELECT 1 FROM "StaffInvite" WHERE 'TEACHER' = ANY ("roles"));

-- Teachers become teachers of that school; pending teacher invites carry the school role.
INSERT INTO "SchoolStaff" ("id", "userId", "schoolId", "role")
SELECT 'staff-' || "id", "id", 'school-test', 'TEACHER' FROM "user" WHERE 'TEACHER' = ANY ("roles");

ALTER TABLE "StaffInvite" ADD COLUMN "schoolId" TEXT,
ADD COLUMN "schoolRole" "SchoolRole";
UPDATE "StaffInvite" SET "schoolId" = 'school-test', "schoolRole" = 'TEACHER' WHERE 'TEACHER' = ANY ("roles");

UPDATE "user" SET "roles" = array_remove("roles", 'TEACHER') WHERE 'TEACHER' = ANY ("roles");
UPDATE "StaffInvite" SET "roles" = array_remove("roles", 'TEACHER') WHERE 'TEACHER' = ANY ("roles");

-- AlterEnum: Role loses TEACHER
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'AUTHOR', 'REVIEWER');
ALTER TABLE "user" ALTER COLUMN "roles" DROP DEFAULT;
ALTER TABLE "user" ALTER COLUMN "roles" TYPE "Role_new"[] USING ("roles"::text::"Role_new"[]);
ALTER TABLE "StaffInvite" ALTER COLUMN "roles" TYPE "Role_new"[] USING ("roles"::text::"Role_new"[]);
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "user" ALTER COLUMN "roles" SET DEFAULT ARRAY[]::"Role"[];
COMMIT;
ALTER TABLE "StaffInvite" ALTER COLUMN "roles" SET DEFAULT ARRAY[]::"Role"[];

-- Campuses belong to a school; names are unique within it.
ALTER TABLE "Campus" ADD COLUMN "schoolId" TEXT;
UPDATE "Campus" SET "schoolId" = 'school-test';
ALTER TABLE "Campus" ALTER COLUMN "schoolId" SET NOT NULL;
DROP INDEX "Campus_name_key";

-- Classes: status instead of active, and the current unit becomes the first unit run.
ALTER TABLE "Class" ADD COLUMN "endedAt" TIMESTAMP(3),
ADD COLUMN "mergedIntoId" TEXT,
ADD COLUMN "status" "ClassStatus" NOT NULL DEFAULT 'ACTIVE';
UPDATE "Class" SET "status" = 'STOPPED', "endedAt" = "updatedAt" WHERE NOT "active";
ALTER TABLE "Class" DROP COLUMN "active";

-- Dates are Vietnam calendar days (timestamps are stored in UTC).
INSERT INTO "ClassUnitRun" ("id", "classId", "unitId", "startedOn", "endedOn")
SELECT 'run-' || "id", "id", "currentUnitId",
       ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
       CASE WHEN "status" = 'ACTIVE' THEN NULL
            ELSE (COALESCE("endedAt", "updatedAt") AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date END
FROM "Class" WHERE "currentUnitId" IS NOT NULL;

-- Children: their class becomes an enrollment.
-- Children of a class that ended leave it with the class; children marked as left leave on that day.
INSERT INTO "Enrollment" ("id", "studentId", "classId", "startedOn", "endedOn", "endReason")
SELECT 'enrol-' || s."id", s."id", s."classId",
       (s."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
       CASE WHEN s."status" = 'LEFT'
              THEN (s."updatedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
            WHEN c."status" <> 'ACTIVE'
              THEN (COALESCE(c."endedAt", c."updatedAt") AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
       END,
       CASE WHEN s."status" = 'LEFT' THEN 'LEFT'::"EnrollmentEnd"
            WHEN c."status" <> 'ACTIVE' THEN 'CLASS_STOPPED'::"EnrollmentEnd"
       END
FROM "Student" s JOIN "Class" c ON c."id" = s."classId";

ALTER TABLE "Student" DROP CONSTRAINT "Student_classId_fkey";
ALTER TABLE "Student" DROP COLUMN "classId",
DROP COLUMN "status";
DROP TYPE "StudentStatus";

-- CreateIndex
CREATE UNIQUE INDEX "School_name_key" ON "School"("name");
CREATE INDEX "SchoolStaff_schoolId_idx" ON "SchoolStaff"("schoolId");
CREATE UNIQUE INDEX "SchoolStaff_userId_schoolId_key" ON "SchoolStaff"("userId", "schoolId");
CREATE INDEX "ClassUnitRun_classId_idx" ON "ClassUnitRun"("classId");
CREATE INDEX "Enrollment_classId_idx" ON "Enrollment"("classId");
CREATE INDEX "Enrollment_studentId_idx" ON "Enrollment"("studentId");
CREATE UNIQUE INDEX "Campus_schoolId_name_key" ON "Campus"("schoolId", "name");
-- One open unit run per class and one open enrollment per child (not expressible in the Prisma schema).
CREATE UNIQUE INDEX "ClassUnitRun_one_open_per_class" ON "ClassUnitRun"("classId") WHERE "endedOn" IS NULL;
CREATE UNIQUE INDEX "Enrollment_one_open_per_student" ON "Enrollment"("studentId") WHERE "endedOn" IS NULL;

-- AddForeignKey
ALTER TABLE "StaffInvite" ADD CONSTRAINT "StaffInvite_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchoolStaff" ADD CONSTRAINT "SchoolStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchoolStaff" ADD CONSTRAINT "SchoolStaff_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Campus" ADD CONSTRAINT "Campus_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Class" ADD CONSTRAINT "Class_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClassUnitRun" ADD CONSTRAINT "ClassUnitRun_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassUnitRun" ADD CONSTRAINT "ClassUnitRun_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
