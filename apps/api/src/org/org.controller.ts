import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import type { ClassStatus } from '@little-ants/db';
import {
  campusInput,
  campusUpdate,
  classInput,
  classUpdate,
  mergeClassInput,
  moveStudentInput,
  nextUnitInput,
  studentInput,
  studentUpdate,
  teacherAssignmentInput,
} from '@little-ants/shared';
import type { z } from 'zod';
import { CurrentUser } from '../auth/decorators.js';
import { schoolRole, type StaffUser } from '../auth/staff-access.js';
import { audit } from '../common/audit.js';
import { linkParent } from '../parents/parent-link.js';
import { ZodBody } from '../common/zod-body.js';
import { OrgService } from './org.service.js';
import { requireClassAccess, requireSchool, schoolOfClass, schoolOfStudent } from './school-access.js';

const CLASS_STATUSES: ClassStatus[] = ['ACTIVE', 'MERGED', 'STOPPED'];

/** Campuses, classes and children of a school. */
@Controller()
export class OrgController {
  constructor(private readonly org: OrgService) {}

  private get db() {
    return this.org.db;
  }

  private async manageClass(user: StaffUser, classId: string): Promise<string> {
    const schoolId = await schoolOfClass(this.db, classId);
    requireSchool(user, schoolId, true);
    return schoolId;
  }

  private async manageStudent(user: StaffUser, studentId: string): Promise<string> {
    const schoolId = await schoolOfStudent(this.db, studentId);
    requireSchool(user, schoolId, true);
    return schoolId;
  }

  // Campuses ---------------------------------------------------------------

  @Get('schools/:schoolId/campuses')
  listCampuses(@CurrentUser() user: StaffUser, @Param('schoolId') schoolId: string) {
    requireSchool(user, schoolId);
    return this.db.campus.findMany({ where: { schoolId }, orderBy: { name: 'asc' } });
  }

  @Post('schools/:schoolId/campuses')
  async createCampus(
    @CurrentUser() user: StaffUser,
    @Param('schoolId') schoolId: string,
    @Body(new ZodBody(campusInput)) body: z.infer<typeof campusInput>,
  ) {
    requireSchool(user, schoolId, true);
    const campus = await this.db.campus.create({ data: { ...body, schoolId } });
    await audit(this.db, user.id, 'campus-create', campus.id, body);
    return campus;
  }

  @Patch('schools/:schoolId/campuses/:id')
  async updateCampus(
    @CurrentUser() user: StaffUser,
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
    @Body(new ZodBody(campusUpdate)) body: z.infer<typeof campusUpdate>,
  ) {
    requireSchool(user, schoolId, true);
    const { count } = await this.db.campus.updateMany({ where: { id, schoolId }, data: body });
    if (count === 0) throw new NotFoundException('Campus not found');
    return this.db.campus.findUniqueOrThrow({ where: { id } });
  }

  // Levels and units (for class forms) ---------------------------------------

  @Get('levels')
  listLevels() {
    return this.db.level.findMany({
      orderBy: { number: 'asc' },
      select: {
        id: true,
        number: true,
        name: true,
        ageBand: true,
        units: { select: { id: true, code: true, title: true }, orderBy: { number: 'asc' } },
      },
    });
  }

  // Classes -----------------------------------------------------------------

  /** A school's classes; teachers see only theirs. `status` defaults to ACTIVE, `all` lists every class. */
  @Get('schools/:schoolId/classes')
  listClasses(
    @CurrentUser() user: StaffUser,
    @Param('schoolId') schoolId: string,
    @Query('campusId') campusId?: string,
    @Query('status') status?: string,
  ) {
    requireSchool(user, schoolId);
    const statusFilter =
      status === 'all' ? {} : { status: CLASS_STATUSES.find((value) => value === status) ?? 'ACTIVE' };
    return this.db.class.findMany({
      where: {
        campus: { schoolId },
        ...(campusId ? { campusId } : {}),
        ...statusFilter,
        ...(schoolRole(user, schoolId) === 'SCHOOL_ADMIN' ? {} : { teachers: { some: { userId: user.id } } }),
      },
      include: {
        campus: { select: { id: true, name: true } },
        level: { select: { id: true, number: true, name: true } },
        currentUnit: { select: { id: true, code: true, title: true } },
        teachers: { select: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { enrollments: { where: { endedOn: null } } } },
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
  }

  @Get('classes/:id')
  async getClass(@CurrentUser() user: StaffUser, @Param('id') id: string) {
    await requireClassAccess(this.db, user, id);
    return this.db.class.findUniqueOrThrow({
      where: { id },
      include: {
        campus: { select: { id: true, name: true, school: { select: { id: true, name: true } } } },
        level: { select: { id: true, number: true, name: true } },
        currentUnit: { select: { id: true, code: true, title: true } },
        mergedInto: { select: { id: true, name: true } },
        unitRuns: {
          orderBy: { startedOn: 'desc' },
          select: { id: true, startedOn: true, endedOn: true, unit: { select: { code: true, title: true } } },
        },
        teachers: { select: { user: { select: { id: true, name: true, email: true } } } },
        enrollments: {
          orderBy: [{ endedOn: { sort: 'desc', nulls: 'first' } }, { student: { displayName: 'asc' } }],
          select: { id: true, startedOn: true, endedOn: true, endReason: true, student: true },
        },
      },
    });
  }

  @Post('schools/:schoolId/classes')
  async createClass(
    @CurrentUser() user: StaffUser,
    @Param('schoolId') schoolId: string,
    @Body(new ZodBody(classInput)) body: z.infer<typeof classInput>,
  ) {
    requireSchool(user, schoolId, true);
    const campus = await this.db.campus.findFirst({ where: { id: body.campusId, schoolId } });
    if (!campus) throw new BadRequestException('Choose a campus of this school');
    const { unitId, ...data } = body;
    const created = await this.db.$transaction(async (tx) => {
      const klass = await tx.class.create({ data });
      if (unitId) {
        await this.org.startUnit(klass.id, unitId, tx);
        // A class set up mid-unit keeps the lesson it is at.
        await tx.class.update({ where: { id: klass.id }, data: { nextLesson: data.nextLesson } });
      }
      return klass;
    });
    await audit(this.db, user.id, 'class-create', created.id, { name: body.name });
    return this.db.class.findUniqueOrThrow({ where: { id: created.id } });
  }

  @Patch('classes/:id')
  async updateClass(
    @CurrentUser() user: StaffUser,
    @Param('id') id: string,
    @Body(new ZodBody(classUpdate)) body: z.infer<typeof classUpdate>,
  ) {
    await this.manageClass(user, id);
    return this.db.class.update({ where: { id }, data: body });
  }

  /** Teachers of a class; they must work at the class's school. */
  @Put('classes/:id/teachers')
  async setTeachers(
    @CurrentUser() user: StaffUser,
    @Param('id') id: string,
    @Body(new ZodBody(teacherAssignmentInput)) body: z.infer<typeof teacherAssignmentInput>,
  ) {
    const schoolId = await this.manageClass(user, id);
    const members = await this.db.schoolStaff.count({ where: { schoolId, userId: { in: body.userIds } } });
    if (members !== new Set(body.userIds).size)
      throw new BadRequestException('Teachers must work at this school');
    await this.db.$transaction([
      this.db.teacherAssignment.deleteMany({ where: { classId: id, userId: { notIn: body.userIds } } }),
      ...body.userIds.map((userId) =>
        this.db.teacherAssignment.upsert({
          where: { userId_classId: { userId, classId: id } },
          update: {},
          create: { userId, classId: id },
        }),
      ),
    ]);
    await audit(this.db, user.id, 'class-teachers', id, { userIds: body.userIds });
    return this.db.teacherAssignment.findMany({ where: { classId: id }, select: { userId: true } });
  }

  /** Finish the current unit and start the next one (lesson 1). */
  @Post('classes/:id/next-unit')
  @HttpCode(200)
  async nextUnit(
    @CurrentUser() user: StaffUser,
    @Param('id') id: string,
    @Body(new ZodBody(nextUnitInput)) body: z.infer<typeof nextUnitInput>,
  ) {
    await this.manageClass(user, id);
    await this.org.startUnit(id, body.unitId);
    await audit(this.db, user.id, 'class-next-unit', id, { unitId: body.unitId });
    return { ok: true };
  }

  @Post('classes/:id/merge')
  @HttpCode(200)
  async merge(
    @CurrentUser() user: StaffUser,
    @Param('id') id: string,
    @Body(new ZodBody(mergeClassInput)) body: z.infer<typeof mergeClassInput>,
  ) {
    await this.manageClass(user, id);
    const result = await this.org.merge(id, body.targetClassId);
    await audit(this.db, user.id, 'class-merge', id, { into: body.targetClassId, moved: result.moved });
    return result;
  }

  @Post('classes/:id/stop')
  @HttpCode(200)
  async stop(@CurrentUser() user: StaffUser, @Param('id') id: string) {
    await this.manageClass(user, id);
    const result = await this.org.stop(id);
    await audit(this.db, user.id, 'class-stop', id, result);
    return result;
  }

  // Children ----------------------------------------------------------------

  /** A new child, in this class from today, with the parents who may sign in for them. */
  @Post('classes/:id/students')
  async addStudent(
    @CurrentUser() user: StaffUser,
    @Param('id') classId: string,
    @Body(new ZodBody(studentInput)) body: z.infer<typeof studentInput>,
  ) {
    await this.manageClass(user, classId);
    const { parents, ...data } = body;
    const student = await this.db.$transaction(async (tx) => {
      const created = await tx.student.create({ data });
      await this.org.enroll(tx, created.id, classId);
      for (const parent of parents) await linkParent(tx, created.id, parent);
      return created;
    });
    await audit(this.db, user.id, 'student-create', student.id, { classId, parents: parents.length });
    return student;
  }

  @Patch('students/:id')
  async updateStudent(
    @CurrentUser() user: StaffUser,
    @Param('id') id: string,
    @Body(new ZodBody(studentUpdate)) body: z.infer<typeof studentUpdate>,
  ) {
    await this.manageStudent(user, id);
    const student = await this.db.student.update({ where: { id }, data: body });
    await audit(this.db, user.id, 'student-update', id, { fields: Object.keys(body) });
    return student;
  }

  /** Move a child to another class; a class at another school needs admin rights there too. */
  @Post('students/:id/move')
  @HttpCode(200)
  async moveStudent(
    @CurrentUser() user: StaffUser,
    @Param('id') id: string,
    @Body(new ZodBody(moveStudentInput)) body: z.infer<typeof moveStudentInput>,
  ) {
    await this.manageStudent(user, id);
    await this.manageClass(user, body.classId);
    await this.org.moveStudent(id, body.classId);
    await audit(this.db, user.id, 'student-move', id, { classId: body.classId });
    return { ok: true };
  }

  /** A child who left comes back to a class. Refused while the child is in a class (move them instead). */
  @Post('students/:id/rejoin')
  @HttpCode(200)
  async rejoin(
    @CurrentUser() user: StaffUser,
    @Param('id') id: string,
    @Body(new ZodBody(moveStudentInput)) body: z.infer<typeof moveStudentInput>,
  ) {
    await this.manageStudent(user, id);
    await this.manageClass(user, body.classId);
    await this.db.$transaction((tx) => this.org.enroll(tx, id, body.classId));
    await audit(this.db, user.id, 'student-rejoin', id, { classId: body.classId });
    return { ok: true };
  }

  @Post('students/:id/leave')
  @HttpCode(200)
  async leave(@CurrentUser() user: StaffUser, @Param('id') id: string) {
    await this.manageStudent(user, id);
    await this.org.leave(id);
    await audit(this.db, user.id, 'student-leave', id);
    return { ok: true };
  }

  @Delete('students/:id')
  @HttpCode(204)
  async removeStudent(@CurrentUser() user: StaffUser, @Param('id') id: string): Promise<void> {
    await this.manageStudent(user, id);
    // Children's records are deleted, not just hidden, when a parent asks (Decree 13/2023).
    await this.db.student.delete({ where: { id } });
    await audit(this.db, user.id, 'student-delete', id);
  }
}
