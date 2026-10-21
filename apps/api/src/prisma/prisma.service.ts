import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { createPrismaClient, type PrismaClient } from '@little-ants/db';
import { loadEnv } from '../config/env.js';

/** One shared Prisma client for the API process. */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: PrismaClient = createPrismaClient(loadEnv().DATABASE_URL);

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
