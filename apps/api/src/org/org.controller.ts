import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  campusInput,
  campusUpdate,
  classInput,
  classUpdate,
  studentInput,
  studentUpdate,
  teacherAssignmentInput,
} from '@little-ants/shared';
import type { z } from 'zod';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { canAccessClass, hasRole, type StaffUser } from '../auth/staff-access.js';
import { audit } from '../common/audit.js';
import { ZodBody } from '../common/zod-body.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller()
export class OrgController {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client;
  }

  private async assertClassAccess(user: StaffUser, classId: string): Promise<void> {
    const exists = await this.db.class.findUnique({ where: { id: classId }, select: { id: true } });
    if (!exists) throw new NotFoundException('Class not found');
    if (!(await canAccessClass(this.db, user, classId))) throw new ForbiddenException('Not your class');
  }

  // Campuses ---------------------------------------------------------------

  @Get('campuses')
  listCampuses() {
    return this.db.campus.findMany({ orderBy: { name: 'asc' } });
  }

  @Roles('ADMIN')
  @Post('campuses')
  async createCampus(
    @CurrentUser() user: StaffUser,
    @Body(new ZodBody(campusInput)) body: z.infer<typeof campusInput>,
  ) {
    const campus = await this.db.campus.create({ data: body });
    await audit(this.db, user.id, 'campus-create', campus.id, body);
    return campus;
  }

  @Roles('ADMIN')
  @Patch('campuses/:id')
  updateCampus(@Param('id') id: string, @Body(new ZodBody(campusUpdate)) body: z.infer<typeof campusUpdate>) {
    return this.db.campus.update({ where: { id }, data: body });
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

  @Get('classes')
  listClasses(@CurrentUser() user: StaffUser, @Query('campusId') campusId?: string) {
    return this.db.class.findMany({
      where: {
        ...(campusId ? { campusId } : {}),
        ...(hasRole(user, 'ADMIN') ? {} : { teachers: { some: { userId: user.id } } }),
      },
      include: {
        campus: { select: { id: true, name: true } },
        level: { select: { id: true, number: true, name: true } },
        currentUnit: { select: { id: true, code: true, title: true } },
        teachers: { select: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { students: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  @Get('classes/:id')
  async getClass(@CurrentUser() user: StaffUser, @Param('id') id: string) {
    await this.assertClassAccess(user, id);
    return this.db.class.findUniqueOrThrow({
      where: { id },
      include: {
        campus: { select: { id: true, name: true } },
        level: { select: { id: true, number: true, name: true } },
        currentUnit: { select: { id: true, code: true, title: true } },
        teachers: { select: { user: { select: { id: true, name: true, email: true } } } },
        students: { orderBy: [{ status: 'asc' }, { displayName: 'asc' }] },
      },
    });
  }

  @Roles('ADMIN')
  @Post('classes')
  async createClass(
    @CurrentUser() user: StaffUser,
    @Body(new ZodBody(classInput)) body: z.infer<typeof classInput>,
  ) {
    const created = await this.db.class.create({ data: body });
    await audit(this.db, user.id, 'class-create', created.id, { name: body.name });
    return created;
  }

  @Roles('ADMIN')
  @Patch('classes/:id')
  updateClass(@Param('id') id: string, @Body(new ZodBody(classUpdate)) body: z.infer<typeof classUpdate>) {
    return this.db.class.update({ where: { id }, data: body });
  }

  @Roles('ADMIN')
  @Put('classes/:id/teachers')
  async setTeachers(
    @CurrentUser() user: StaffUser,
    @Param('id') id: string,
    @Body(new ZodBody(teacherAssignmentInput)) body: z.infer<typeof teacherAssignmentInput>,
  ) {
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

  // Students ----------------------------------------------------------------

  @Roles('ADMIN')
  @Post('classes/:id/students')
  async addStudent(
    @CurrentUser() user: StaffUser,
    @Param('id') classId: string,
    @Body(new ZodBody(studentInput)) body: z.infer<typeof studentInput>,
  ) {
    const student = await this.db.student.create({ data: { ...body, classId } });
    await audit(this.db, user.id, 'student-create', student.id, { classId });
    return student;
  }

  @Roles('ADMIN')
  @Patch('students/:id')
  async updateStudent(
    @CurrentUser() user: StaffUser,
    @Param('id') id: string,
    @Body(new ZodBody(studentUpdate)) body: z.infer<typeof studentUpdate>,
  ) {
    const student = await this.db.student.update({ where: { id }, data: body });
    await audit(this.db, user.id, 'student-update', id, { fields: Object.keys(body) });
    return student;
  }

  @Roles('ADMIN')
  @Delete('students/:id')
  @HttpCode(204)
  async removeStudent(@CurrentUser() user: StaffUser, @Param('id') id: string): Promise<void> {
    // Children's records are deleted, not just hidden, when a parent asks (Decree 13/2023).
    await this.db.student.delete({ where: { id } });
    await audit(this.db, user.id, 'student-delete', id);
  }
}
