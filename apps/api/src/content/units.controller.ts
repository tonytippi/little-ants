import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Put } from '@nestjs/common';
import { editContent } from '@little-ants/db';
import { canDoGoalsInput, gateCheckUpdate, statusChange, unitUpdate } from '@little-ants/shared';
import type { z } from 'zod';
import { CurrentUser, Roles } from '../auth/decorators.js';
import type { StaffUser } from '../auth/staff-access.js';
import { ZodBody } from '../common/zod-body.js';
import { ContentService } from './content.service.js';

@Roles('AUTHOR', 'REVIEWER')
@Controller('content/units')
export class UnitsController {
  constructor(private readonly content: ContentService) {}

  private get db() {
    return this.content.db;
  }

  @Get()
  async list() {
    const units = await this.db.unit.findMany({
      orderBy: { number: 'asc' },
      include: {
        level: { select: { number: true, name: true } },
        leadCharacter: { select: { name: true } },
        _count: { select: { words: true, materials: true, lessons: true } },
        releases: { orderBy: { version: 'desc' }, take: 1, select: { version: true, publishedAt: true } },
      },
    });
    const production = await this.db.productionStatus.groupBy({
      by: ['state'],
      _count: true,
      where: { material: { unitId: { in: units.map((unit) => unit.id) } } },
    });
    const perUnit = await this.db.$queryRaw<{ unitId: string; done: bigint; total: bigint }[]>`
      SELECT m."unitId" AS "unitId",
             COUNT(*) FILTER (WHERE p.state IN ('DONE', 'NOT_APPLICABLE')) AS done,
             COUNT(*) AS total
      FROM "ProductionStatus" p JOIN "Material" m ON m.id = p."materialId"
      GROUP BY m."unitId"`;
    const statusCounts = await Promise.all(
      units.map(async (unit) => {
        const [words, materials, lessons] = await Promise.all([
          this.db.word.groupBy({ by: ['status'], _count: true, where: { unitId: unit.id } }),
          this.db.material.groupBy({ by: ['status'], _count: true, where: { unitId: unit.id } }),
          this.db.lesson.groupBy({ by: ['status'], _count: true, where: { unitId: unit.id } }),
        ]);
        const merged: Record<string, number> = {};
        for (const row of [...words, ...materials, ...lessons]) merged[row.status] = (merged[row.status] ?? 0) + row._count;
        return merged;
      }),
    );
    return {
      units: units.map((unit, index) => {
        const progress = perUnit.find((row) => row.unitId === unit.id);
        return {
          id: unit.id,
          code: unit.code,
          number: unit.number,
          title: unit.title,
          status: unit.status,
          version: unit.version,
          level: unit.level,
          leadCharacter: unit.leadCharacter?.name ?? unit.leadCharacterNote,
          counts: unit._count,
          contentStatus: statusCounts[index],
          production: progress ? { done: Number(progress.done), total: Number(progress.total) } : { done: 0, total: 0 },
          latestRelease: unit.releases[0] ?? null,
        };
      }),
      productionTotals: Object.fromEntries(production.map((row) => [row.state, row._count])),
    };
  }

  @Get(':code')
  async detail(@Param('code') code: string) {
    const unit = await this.content.unitByCode(code);
    return this.db.unit.findUniqueOrThrow({
      where: { id: unit.id },
      include: {
        level: true,
        leadCharacter: { select: { id: true, name: true, artAssetId: true } },
        words: { orderBy: [{ kind: 'asc' }, { order: 'asc' }] },
        materials: {
          orderBy: { code: 'asc' },
          include: { _count: { select: { pages: true, assets: true } }, production: true },
        },
        lessons: {
          orderBy: { number: 'asc' },
          select: { id: true, number: true, week: true, stage: true, minutes: true, newToday: true, status: true, version: true },
        },
        canDoGoals: { orderBy: { order: 'asc' } },
        gateChecks: { orderBy: [{ gate: 'asc' }, { order: 'asc' }] },
        releases: { orderBy: { version: 'desc' }, select: { id: true, version: true, note: true, publishedAt: true, publishedBy: { select: { name: true } } } },
      },
    });
  }

  @Roles('AUTHOR', 'REVIEWER')
  @Patch(':code')
  async update(@CurrentUser() user: StaffUser, @Param('code') code: string, @Body(new ZodBody(unitUpdate)) body: z.infer<typeof unitUpdate>) {
    const unit = await this.content.unitByCode(code);
    const { note, ...data } = body;
    return editContent(this.db, 'unit', unit.id, data, { authorId: user.id, note: note ?? 'edit unit' });
  }

  @Roles('AUTHOR', 'REVIEWER')
  @Post(':code/status')
  async status(@CurrentUser() user: StaffUser, @Param('code') code: string, @Body(new ZodBody(statusChange)) body: z.infer<typeof statusChange>) {
    const unit = await this.content.unitByCode(code);
    return this.content.setStatus(user, 'unit', unit.id, body.status, body.note);
  }

  /** Send every draft item in the unit for review. */
  @Roles('AUTHOR', 'REVIEWER')
  @Post(':code/submit-all')
  async submitAll(@CurrentUser() user: StaffUser, @Param('code') code: string) {
    const unit = await this.content.unitByCode(code);
    return this.content.setUnitStatus(user, unit.id, 'DRAFT', 'REVIEW');
  }

  /** Approve every item in review (reviewers only). */
  @Roles('REVIEWER')
  @Post(':code/approve-all')
  async approveAll(@CurrentUser() user: StaffUser, @Param('code') code: string) {
    const unit = await this.content.unitByCode(code);
    return this.content.setUnitStatus(user, unit.id, 'REVIEW', 'APPROVED');
  }

  @Get(':code/validation')
  async validation(@Param('code') code: string) {
    const unit = await this.content.unitByCode(code);
    return this.content.validateUnit(unit.id);
  }

  @Roles('AUTHOR', 'REVIEWER')
  @Put(':code/can-do-goals')
  async setGoals(@CurrentUser() user: StaffUser, @Param('code') code: string, @Body(new ZodBody(canDoGoalsInput)) body: z.infer<typeof canDoGoalsInput>) {
    const unit = await this.content.unitByCode(code);
    await this.db.$transaction([
      this.db.canDoGoal.deleteMany({ where: { unitId: unit.id } }),
      this.db.canDoGoal.createMany({ data: body.goals.map((text, index) => ({ unitId: unit.id, order: index + 1, text })) }),
    ]);
    // Goals belong to the unit, so the change is recorded (and re-opens review) on the unit.
    await editContent(this.db, 'unit', unit.id, {}, { authorId: user.id, note: 'edit can-do goals' });
    return this.db.canDoGoal.findMany({ where: { unitId: unit.id }, orderBy: { order: 'asc' } });
  }

  @Roles('AUTHOR', 'REVIEWER')
  @Patch('gate-checks/:id')
  async updateGate(@CurrentUser() user: StaffUser, @Param('id') id: string, @Body(new ZodBody(gateCheckUpdate)) body: z.infer<typeof gateCheckUpdate>) {
    const gate = await this.db.gateCheck.findUnique({ where: { id } });
    if (!gate) throw new NotFoundException();
    return this.db.gateCheck.update({
      where: { id },
      data: {
        ...body,
        ...(body.done === undefined ? {} : { doneAt: body.done ? new Date() : null, signer: body.signer ?? (body.done ? user.name : gate.signer) }),
      },
    });
  }
}
