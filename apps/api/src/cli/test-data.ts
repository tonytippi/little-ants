import { schoolYearOf } from '@little-ants/shared';
import type { ContentActor, ContentService } from '../content/content.service.js';
import type { ReleaseBuilder } from '../releases/release-builder.service.js';

export const TEST_CAMPUS = 'Mio Lingo';
export const TEST_CLASS = 'Unit 5';
const TEST_CLASS_UNIT = 'U05';
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
}

/**
 * Test data for trying the Teacher app. Every imported unit is approved as it is (its files made public)
 * and published when something changed; the "Mio Lingo" campus gets a "Unit 5" class taught by every teacher,
 * with a few test children. Running it again only approves and publishes what changed since, and keeps the
 * class's lesson progress and children.
 */
export async function seedTestData(
  content: ContentService,
  releases: ReleaseBuilder,
  actor: ContentActor,
  log: (message: string) => void = () => undefined,
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

  const result: TestDataResult = { approved: {}, published: {}, blocked: {}, classId: '', teachers: 0 };
  for (const unit of units) {
    await content.setUnitStatus(actor, unit.id, 'DRAFT', 'REVIEW');
    const counts = await content.setUnitStatus(actor, unit.id, 'REVIEW', 'APPROVED');
    const approved = Object.values(counts).reduce((sum, count) => sum + count, 0);
    result.approved[unit.code] = approved;
    if (approved === 0 && unit._count.releases > 0) {
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

  const campus = await db.campus.upsert({
    where: { name: TEST_CAMPUS },
    update: { active: true },
    create: { name: TEST_CAMPUS },
  });
  const schoolYear = schoolYearOf();
  const testClass = await db.class.upsert({
    where: { campusId_name_schoolYear: { campusId: campus.id, name: TEST_CLASS, schoolYear } },
    update: { currentUnitId: classUnit.id, levelId: classUnit.levelId, active: true },
    create: {
      campusId: campus.id,
      name: TEST_CLASS,
      levelId: classUnit.levelId,
      currentUnitId: classUnit.id,
      schoolYear,
    },
  });
  result.classId = testClass.id;

  const teachers = await db.user.findMany({
    where: { active: true, roles: { has: 'TEACHER' } },
    select: { id: true },
  });
  await db.teacherAssignment.createMany({
    data: teachers.map((teacher) => ({ userId: teacher.id, classId: testClass.id })),
    skipDuplicates: true,
  });
  result.teachers = teachers.length;

  if ((await db.student.count({ where: { classId: testClass.id } })) === 0) {
    await db.student.createMany({
      data: TEST_STUDENTS.map((displayName) => ({
        classId: testClass.id,
        displayName,
        birthYear: TEST_BIRTH_YEAR,
      })),
    });
  }
  log(
    `${TEST_CAMPUS} / ${TEST_CLASS} (${schoolYear}) on ${TEST_CLASS_UNIT}, lesson ${testClass.nextLesson}; ${teachers.length} teachers assigned`,
  );
  return result;
}
