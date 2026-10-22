import { ConflictException, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/decorators.js';
import type { StaffUser } from '../auth/staff-access.js';
import { audit } from '../common/audit.js';
import { PrismaService } from '../prisma/prisma.service.js';

const SUMMARY = {
  id: true,
  status: true,
  createdAt: true,
  startedAt: true,
  finishedAt: true,
  message: true,
  archive: true,
  requestedBy: { select: { id: true, name: true } },
} as const;

/**
 * Curriculum syncs from Google Drive. The API only records requests;
 * the import worker (la-import --worker) carries them out and writes back the result.
 */
@Roles('ADMIN')
@Controller('imports')
export class ImportsController {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client;
  }

  @Get()
  list() {
    return this.db.importRun.findMany({ select: SUMMARY, orderBy: { createdAt: 'desc' }, take: 20 });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.db.importRun.findUniqueOrThrow({ where: { id }, select: { ...SUMMARY, report: true } });
  }

  /** Queue a sync. Only one can be waiting or running at a time. */
  @Post()
  request(@CurrentUser() user: StaffUser) {
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('import-run'))`;
      const active = await tx.importRun.findFirst({ where: { status: { in: ['QUEUED', 'RUNNING'] } } });
      if (active) throw new ConflictException('A sync is already waiting or running');
      const run = await tx.importRun.create({ data: { requestedById: user.id }, select: SUMMARY });
      await audit(tx, user.id, 'drive-sync', run.id);
      return run;
    });
  }
}
