import { Controller, Get } from '@nestjs/common';
import { loadEnv } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CurrentUser, Public } from './decorators.js';
import { teachableClasses, type StaffUser } from './staff-access.js';

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

  /** The signed-in person, the schools they work at and the classes they teach. */
  @Get('me')
  async me(@CurrentUser() user: StaffUser) {
    const db = this.prisma.client;
    const [schools, classes] = await Promise.all([
      db.school.findMany({
        where: { id: { in: user.schools.map((school) => school.schoolId) } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      db.class.findMany({
        where: { status: 'ACTIVE', ...teachableClasses(user) },
        select: { id: true, name: true, schoolYear: true, campus: { select: { name: true } } },
        orderBy: { name: 'asc' },
      }),
    ]);
    const roleAt = new Map(user.schools.map((school) => [school.schoolId, school.role]));
    return {
      user,
      schools: schools.map((school) => ({ ...school, role: roleAt.get(school.id)! })),
      classes,
    };
  }
}
