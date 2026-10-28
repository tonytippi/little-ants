import 'reflect-metadata';
import { Injectable, type INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { PrismaClient, Role, SchoolRole } from '@little-ants/db';
import { AppModule } from '../src/app.module.js';
import type { AuthedRequest } from '../src/auth/decorators.js';
import { SessionResolver } from '../src/auth/session-resolver.js';
import { loadStaffUser, type StaffUser } from '../src/auth/staff-access.js';
import { configureApp } from '../src/bootstrap.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

export const TEST_USER_HEADER = 'x-test-user';

/** Signs requests in as the user id in the x-test-user header, so role rules can be tested without Google. */
@Injectable()
class HeaderSessionResolver extends SessionResolver {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async resolve(request: AuthedRequest): Promise<StaffUser | null> {
    const id = request.headers[TEST_USER_HEADER];
    if (typeof id !== 'string') return null;
    return loadStaffUser(this.prisma.client, id);
  }
}

export interface TestApp {
  app: INestApplication;
  prisma: PrismaClient;
}

export async function createTestApp(
  options: { headerAuth?: boolean; providers?: [token: unknown, value: unknown][] } = {},
): Promise<TestApp> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (options.headerAuth) builder.overrideProvider(SessionResolver).useClass(HeaderSessionResolver);
  for (const [token, value] of options.providers ?? []) builder.overrideProvider(token).useValue(value);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService).client };
}

let counter = 0;

/** A staff account with HQ roles and, optionally, roles at schools. */
export async function createStaff(
  prisma: PrismaClient,
  roles: Role[],
  name = 'Test user',
  schools: { schoolId: string; role: SchoolRole }[] = [],
): Promise<StaffUser> {
  counter += 1;
  const user = await prisma.user.create({
    data: {
      name,
      email: `staff${counter}-${Date.now()}@example.com`,
      roles,
      schools: { create: schools },
    },
  });
  return (await loadStaffUser(prisma, user.id))!;
}

/** A school with one campus, for tests that need classes. */
export async function createSchool(
  prisma: PrismaClient,
  name = 'Test school',
): Promise<{ schoolId: string; campusId: string }> {
  counter += 1;
  const school = await prisma.school.create({
    data: {
      name: `${name} ${counter}-${Date.now()}`,
      campuses: { create: { name: 'Main campus' } },
    },
    include: { campuses: true },
  });
  return { schoolId: school.id, campusId: school.campuses[0]!.id };
}
