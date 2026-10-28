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
} from '@nestjs/common';
import { schoolInput, schoolStaffInput, schoolStaffUpdate, schoolUpdate } from '@little-ants/shared';
import type { z } from 'zod';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { hasRole, schoolRole, type StaffUser } from '../auth/staff-access.js';
import { audit } from '../common/audit.js';
import { ZodBody } from '../common/zod-body.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { requireSchool } from './school-access.js';

/** Schools (HQ admins) and the people who work at each school (its school admins). */
@Controller('schools')
export class SchoolsController {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client;
  }

  /** HQ admins see every school; others the schools they work at, with their role there. */
  @Get()
  async list(@CurrentUser() user: StaffUser) {
    const schools = await this.db.school.findMany({
      where: hasRole(user, 'ADMIN') ? {} : { id: { in: user.schools.map((school) => school.schoolId) } },
      orderBy: { name: 'asc' },
      include: { _count: { select: { campuses: true, staff: true } } },
    });
    return schools.map((school) => ({ ...school, myRole: schoolRole(user, school.id) }));
  }

  @Roles('ADMIN')
  @Post()
  async create(
    @CurrentUser() user: StaffUser,
    @Body(new ZodBody(schoolInput)) body: z.infer<typeof schoolInput>,
  ) {
    const school = await this.db.school.create({ data: body });
    await audit(this.db, user.id, 'school-create', school.id, { name: body.name });
    return school;
  }

  @Roles('ADMIN')
  @Patch(':schoolId')
  async update(
    @CurrentUser() user: StaffUser,
    @Param('schoolId') schoolId: string,
    @Body(new ZodBody(schoolUpdate)) body: z.infer<typeof schoolUpdate>,
  ) {
    const school = await this.db.school.update({ where: { id: schoolId }, data: body });
    await audit(this.db, user.id, 'school-update', schoolId, body);
    return school;
  }

  @Get(':schoolId/staff')
  async staff(@CurrentUser() user: StaffUser, @Param('schoolId') schoolId: string) {
    requireSchool(user, schoolId, true);
    const [members, invites] = await Promise.all([
      this.db.schoolStaff.findMany({
        where: { schoolId },
        orderBy: { user: { name: 'asc' } },
        select: {
          role: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              active: true,
              assignments: {
                where: { class: { campus: { schoolId }, status: 'ACTIVE' } },
                select: { class: { select: { id: true, name: true } } },
              },
            },
          },
        },
      }),
      this.db.staffInvite.findMany({
        where: { schoolId, acceptedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, schoolRole: true, createdAt: true },
      }),
    ]);
    return { members, invites };
  }

  /** Add a teacher or school admin by email: an existing account joins at once, a new email is invited. */
  @Post(':schoolId/staff')
  async addStaff(
    @CurrentUser() user: StaffUser,
    @Param('schoolId') schoolId: string,
    @Body(new ZodBody(schoolStaffInput)) body: z.infer<typeof schoolStaffInput>,
  ) {
    requireSchool(user, schoolId, true);
    const existing = await this.db.user.findUnique({ where: { email: body.email }, select: { id: true } });
    if (existing) {
      const member = await this.db.schoolStaff.upsert({
        where: { userId_schoolId: { userId: existing.id, schoolId } },
        update: { role: body.role },
        create: { userId: existing.id, schoolId, role: body.role },
      });
      await audit(this.db, user.id, 'school-staff-add', existing.id, { schoolId, role: body.role });
      return { member };
    }
    const pending = await this.db.staffInvite.findUnique({ where: { email: body.email } });
    if (pending?.schoolId && pending.schoolId !== schoolId)
      throw new BadRequestException('This email already has an invite from another school');
    const invite = await this.db.staffInvite.upsert({
      where: { email: body.email },
      update: { schoolId, schoolRole: body.role, invitedById: user.id },
      create: { email: body.email, schoolId, schoolRole: body.role, invitedById: user.id },
    });
    await audit(this.db, user.id, 'invite', body.email, { schoolId, role: body.role });
    return { invite };
  }

  @Patch(':schoolId/staff/:userId')
  async updateStaff(
    @CurrentUser() user: StaffUser,
    @Param('schoolId') schoolId: string,
    @Param('userId') userId: string,
    @Body(new ZodBody(schoolStaffUpdate)) body: z.infer<typeof schoolStaffUpdate>,
  ) {
    requireSchool(user, schoolId, true);
    if (userId === user.id && body.role !== 'SCHOOL_ADMIN' && !hasRole(user, 'ADMIN'))
      throw new BadRequestException('You cannot remove your own school admin role');
    const member = await this.db.schoolStaff.update({
      where: { userId_schoolId: { userId, schoolId } },
      data: { role: body.role },
    });
    await audit(this.db, user.id, 'school-staff-role', userId, { schoolId, role: body.role });
    return member;
  }

  /** Remove someone from the school, with their class assignments there. */
  @Delete(':schoolId/staff/:userId')
  @HttpCode(204)
  async removeStaff(
    @CurrentUser() user: StaffUser,
    @Param('schoolId') schoolId: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    requireSchool(user, schoolId, true);
    if (userId === user.id && !hasRole(user, 'ADMIN'))
      throw new BadRequestException('You cannot remove yourself from the school');
    await this.db.$transaction([
      this.db.teacherAssignment.deleteMany({ where: { userId, class: { campus: { schoolId } } } }),
      this.db.schoolStaff.delete({ where: { userId_schoolId: { userId, schoolId } } }),
    ]);
    await audit(this.db, user.id, 'school-staff-remove', userId, { schoolId });
  }

  @Delete(':schoolId/invites/:id')
  @HttpCode(204)
  async cancelInvite(
    @CurrentUser() user: StaffUser,
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
  ): Promise<void> {
    requireSchool(user, schoolId, true);
    const invite = await this.db.staffInvite.findFirst({ where: { id, schoolId } });
    if (!invite) throw new NotFoundException('Invite not found');
    // An invite that also carries HQ roles keeps them; only the school part is withdrawn.
    if (invite.roles.length > 0)
      await this.db.staffInvite.update({ where: { id }, data: { schoolId: null, schoolRole: null } });
    else await this.db.staffInvite.delete({ where: { id } });
    await audit(this.db, user.id, 'invite-cancel', invite.email, { schoolId });
  }
}
