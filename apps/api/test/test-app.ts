import 'reflect-metadata';
import { Injectable, type INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { PrismaClient, Role } from '@little-ants/db';
import { AppModule } from '../src/app.module.js';
import type { AuthedRequest } from '../src/auth/decorators.js';
import { SessionResolver } from '../src/auth/session-resolver.js';
import type { StaffUser } from '../src/auth/staff-access.js';
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
    const user = await this.prisma.client.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, image: true, roles: true, active: true },
    });
    if (!user?.active) return null;
    const { active: _active, ...staff } = user;
    return staff;
  }
}

export interface TestApp {
  app: INestApplication;
  prisma: PrismaClient;
}

export async function createTestApp(options: { headerAuth?: boolean } = {}): Promise<TestApp> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (options.headerAuth) builder.overrideProvider(SessionResolver).useClass(HeaderSessionResolver);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService).client };
}

let counter = 0;

export async function createStaff(
  prisma: PrismaClient,
  roles: Role[],
  name = 'Test user',
): Promise<StaffUser> {
  counter += 1;
  return prisma.user.create({
    data: { name, email: `staff${counter}-${Date.now()}@example.com`, roles },
    select: { id: true, email: true, name: true, image: true, roles: true },
  });
}
