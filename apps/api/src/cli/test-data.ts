import { schoolYearOf } from '@little-ants/shared';
import type { ContentActor, ContentService } from '../content/content.service.js';
import { today, type OrgService } from '../org/org.service.js';
import type { ReleaseBuilder } from '../releases/release-builder.service.js';

export const TEST_SCHOOL = 'Little Ants Test School';
export const TEST_CAMPUS = 'Mio Lingo';
export const TEST_CLASS = 'Unit 5';
const TEST_CLASS_UNIT = 'U05';
/** The unit the test class did before, so the student app has a studied unit besides the current one. */
const TEST_PREVIOUS_UNIT = 'U04';
const DAY = 24 * 60 * 60 * 1000;
const TEST_STUDENTS = ['An', 'Bình', 'Chi', 'Dũng', 'Hà', 'Khôi', 'Linh', 'Minh'];
const TEST_BIRTH_YEAR = 2021;

export interface TestDataResult {
  /** Items moved to APPROVED, per unit code. */
  approved: Record<string, number>;
  /** Release version published in this run, per unit code. */
  published: Record<string, number>;
  /** Units that could not be published, with the reasons. */
  blocked: Record<string, string[]>;
  classId: string;
  teachers: number;
  /** Test parent emails linked to the class's children (one child each, in name order). */
  parents: number;
}

/** The unit's latest release has Listening Time leaves (releases from before them are published again). */
async function hasListening(db: ContentService['db'], unitId: string): Promise<boolean> {
  const rows = await db.$queryRaw<{ ok: boolean }[]>`
    SELECT (payload->'listening') IS NOT NULL AS ok FROM "UnitRelease"
    WHERE "unitId" = ${unitId} ORDER BY version DESC LIMIT 1`;
  return rows[0]?.ok ?? false;
}

/**
 * Test data for trying the Teacher app. Every imported unit is approved as it is (its files made public)
 * and published when something changed; the test school's "Mio Lingo" campus gets a "Unit 5" class (on U04
 * before, U05 now) taught by every teacher of the school, with a few test children. Running it again only
 * approves and publishes what changed since, and keeps the class's lesson progress and children.
 */
export async function seedTestData(
  content: ContentService,
  releases: ReleaseBuilder,
  org: OrgService,
  actor: ContentActor,
  log: (message: string) => void = () => undefined,
  parentEmails: string[] = [],
): Promise<TestDataResult> {
  const db = content.db;
  const units = await db.unit.findMany({
    where: { lessons: { some: {} } },
    orderBy: { number: 'asc' },
    include: { _count: { select: { releases: true } } },
  });
  const classUnit = units.find((unit) => unit.code === TEST_CLASS_UNIT);
  if (!classUnit)
    throw new Error(`${TEST_CLASS_UNIT} has not been imported yet. Import the curriculum first.`);

  const result: TestDataResult = {
    approved: {},
    published: {},
    blocked: {},
    classId: '',
    teachers: 0,
    parents: 0,
  };
  for (const unit of units) {
    await content.setUnitStatus(actor, unit.id, 'DRAFT', 'REVIEW');
    const counts = await content.setUnitStatus(actor, unit.id, 'REVIEW', 'APPROVED');
    const approved = Object.values(counts).reduce((sum, count) => sum + count, 0);
    result.approved[unit.code] = approved;
    if (approved === 0 && unit._count.releases > 0 && (await hasListening(db, unit.id))) {
      log(`${unit.code}: nothing new to approve; release unchanged`);
      continue;
    }
    const release = await releases.publish(unit.id, actor.id, 'Test data: approved as imported from Drive');
    if ('blockers' in release) {
      result.blocked[unit.code] = release.blockers;
      log(`${unit.code}: approved ${approved} items, not published: ${release.blockers.join('; ')}`);
    } else {
      result.published[unit.code] = release.version;
      log(`${unit.code}: approved ${approved} items, published version ${release.version}`);
    }
  }

  const school = await db.school.upsert({
    where: { name: TEST_SCHOOL },
    update: { active: true },
    create: { name: TEST_SCHOOL },
  });
  const campus = await db.campus.upsert({
    where: { schoolId_name: { schoolId: school.id, name: TEST_CAMPUS } },
    update: { active: true },
    create: { schoolId: school.id, name: TEST_CAMPUS },
  });
  const schoolYear = schoolYearOf();
  let testClass = await db.class.findUnique({
    where: { campusId_name_schoolYear: { campusId: campus.id, name: TEST_CLASS, schoolYear } },
  });
  if (!testClass || testClass.status !== 'ACTIVE') {
    // A fresh class that finished U04 eight weeks of lessons ago and is on U05 now, with its children.
    const previous = await db.unit.findUnique({ where: { code: TEST_PREVIOUS_UNIT }, select: { id: true } });
    const start = today();
    const earlier = new Date(start.getTime() - 56 * DAY);
    if (testClass) {
      // An ended test class (merged or stopped while testing) is replaced, with its test children.
      await db.student.deleteMany({ where: { enrollments: { some: { classId: testClass.id } } } });
      await db.enrollment.deleteMany({ where: { classId: testClass.id } });
      await db.class.delete({ where: { id: testClass.id } });
    }
    testClass = await db.class.create({
      data: {
        campusId: campus.id,
        name: TEST_CLASS,
        levelId: classUnit.levelId,
        currentUnitId: classUnit.id,
        schoolYear,
        unitRuns: {
          create: [
            ...(previous ? [{ unitId: previous.id, startedOn: earlier, endedOn: start }] : []),
            { unitId: classUnit.id, startedOn: start },
          ],
        },
      },
    });
    for (const displayName of TEST_STUDENTS) {
      await db.student.create({
        data: {
          displayName,
          birthYear: TEST_BIRTH_YEAR,
          enrollments: { create: { classId: testClass.id, startedOn: previous ? earlier : start } },
        },
      });
    }
  } else if (testClass.currentUnitId !== classUnit.id) {
    await org.startUnit(testClass.id, classUnit.id);
  }
  result.classId = testClass.id;

  const teachers = await db.schoolStaff.findMany({
    where: { schoolId: school.id, role: 'TEACHER', user: { active: true } },
    select: { userId: true },
  });
  await db.teacherAssignment.createMany({
    data: teachers.map((teacher) => ({ userId: teacher.userId, classId: testClass.id })),
    skipDuplicates: true,
  });
  result.teachers = teachers.length;

  // Real Google accounts can sign in to the student app as the parents of the first children.
  const children = await db.enrollment.findMany({
    where: { classId: testClass.id, endedOn: null },
    orderBy: { student: { displayName: 'asc' } },
    select: { studentId: true },
  });
  for (const [index, email] of parentEmails.entries()) {
    const child = children[index % Math.max(children.length, 1)];
    if (!child) break;
    const parent = await db.parent.upsert({ where: { email }, update: {}, create: { email } });
    await db.studentParent.upsert({
      where: { studentId_parentId: { studentId: child.studentId, parentId: parent.id } },
      update: {},
      create: { studentId: child.studentId, parentId: parent.id, relationship: 'Test parent' },
    });
    result.parents += 1;
  }

  log(
    `${TEST_SCHOOL} / ${TEST_CAMPUS} / ${TEST_CLASS} (${schoolYear}) on ${TEST_CLASS_UNIT}, lesson ${testClass.nextLesson}; ${teachers.length} teachers assigned, ${result.parents} test parents`,
  );
  return result;
}
