import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { staffInviteInput, staffUpdate } from '@little-ants/shared';
import type { z } from 'zod';
import { CurrentUser, Roles } from '../auth/decorators.js';
import type { StaffUser } from '../auth/staff-access.js';
import { audit } from '../common/audit.js';
import { ZodBody } from '../common/zod-body.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Roles('ADMIN')
@Controller('staff')
export class StaffController {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client;
  }

  @Get()
  async list() {
    const [users, invites] = await Promise.all([
      this.db.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          roles: true,
          active: true,
          createdAt: true,
          assignments: { select: { class: { select: { id: true, name: true } } } },
        },
        orderBy: { name: 'asc' },
      }),
      this.db.staffInvite.findMany({ where: { acceptedAt: null }, orderBy: { createdAt: 'desc' } }),
    ]);
    return { users, invites };
  }

  @Post('invites')
  async invite(@CurrentUser() user: StaffUser, @Body(new ZodBody(staffInviteInput)) body: z.infer<typeof staffInviteInput>) {
    if (await this.db.user.findUnique({ where: { email: body.email } })) {
      throw new ConflictException('This person already has an account');
    }
    const invite = await this.db.staffInvite.upsert({
      where: { email: body.email },
      update: { roles: body.roles, invitedById: user.id },
      create: { email: body.email, roles: body.roles, invitedById: user.id },
    });
    await audit(this.db, user.id, 'invite', body.email, { roles: body.roles });
    return invite;
  }

  @Delete('invites/:id')
  @HttpCode(204)
  async cancelInvite(@CurrentUser() user: StaffUser, @Param('id') id: string): Promise<void> {
    const invite = await this.db.staffInvite.delete({ where: { id } });
    await audit(this.db, user.id, 'invite-cancel', invite.email);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: StaffUser,
    @Param('id') id: string,
    @Body(new ZodBody(staffUpdate)) body: z.infer<typeof staffUpdate>,
  ) {
    if (id === user.id && (body.active === false || (body.roles && !body.roles.includes('ADMIN')))) {
      throw new BadRequestException('You cannot remove your own admin access');
    }
    const updated = await this.db.$transaction(async (tx) => {
      const row = await tx.user.update({
        where: { id },
        data: body,
        select: { id: true, name: true, email: true, roles: true, active: true },
      });
      // Deactivating signs the person out everywhere.
      if (body.active === false) await tx.session.deleteMany({ where: { userId: id } });
      if (body.roles) await audit(tx, user.id, 'role-change', id, { roles: body.roles });
      if (body.active !== undefined) await audit(tx, user.id, body.active ? 'activate' : 'deactivate', id);
      return row;
    });
    return updated;
  }
}
