import { Controller, Get } from '@nestjs/common';
import { loadEnv } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CurrentUser, Public } from './decorators.js';
import { hasRole, type StaffUser } from './staff-access.js';

@Controller()
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  /** Which sign-in methods the apps should show. */
  @Public()
  @Get('auth-config')
  authConfig(): { google: boolean; devPassword: boolean } {
    const env = loadEnv();
    return { google: env.googleEnabled, devPassword: env.AUTH_DEV_PASSWORD_LOGIN };
  }

  @Get('me')
  async me(@CurrentUser() user: StaffUser) {
    const classes = await this.prisma.client.class.findMany({
      where: hasRole(user, 'ADMIN') ? { active: true } : { active: true, teachers: { some: { userId: user.id } } },
      select: { id: true, name: true, schoolYear: true, campus: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
    return { user, classes };
  }
}
