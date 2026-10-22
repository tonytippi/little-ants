import { Injectable, NotFoundException } from '@nestjs/common';
import {
  changeContentStatus,
  type ContentEntity,
  type ContentStatus,
  type Prisma,
  writeRevision,
} from '@little-ants/db';
import { checkUnitRules, type LevelRules, type RuleFinding } from '@little-ants/shared';
import type { StaffUser } from '../auth/staff-access.js';
import { AssetUrls } from '../assets/asset-urls.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertCanSetStatus } from './content-access.js';

const ACTIVE = { not: 'ARCHIVED' as const };

/** The Prisma client or an open transaction. */
export type Db = Prisma.TransactionClient;

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly urls: AssetUrls,
  ) {}

  get db() {
    return this.prisma.client;
  }

  async unitByCode(code: string) {
    const unit = await this.db.unit.findUnique({ where: { code: code.toUpperCase() } });
    if (!unit) throw new NotFoundException(`Unit ${code} not found`);
    return unit;
  }

  async setStatus(user: StaffUser, entity: ContentEntity, id: string, to: ContentStatus, note?: string) {
    const delegate = this.db[entity] as unknown as {
      findUnique(args: object): Promise<{ status: ContentStatus } | null>;
    };
    const current = await delegate.findUnique({ where: { id }, select: { status: true } });
    if (!current) throw new NotFoundException();
    assertCanSetStatus(user, current.status, to);
    return changeContentStatus(this.db, entity, id, to, { authorId: user.id, note: note ?? `status ${to}` });
  }

  /**
   * Move every item of a unit (unit, words, materials, lessons and their linked assets) from one status to the next.
   * Used for "submit unit for review" and "approve unit".
   */
  async setUnitStatus(
    user: StaffUser,
    unitId: string,
    from: ContentStatus,
    to: ContentStatus,
  ): Promise<Record<string, number>> {
    assertCanSetStatus(user, from, to);
    if (to === 'APPROVED') {
      // Files become public before they count as approved.
      const ids = await this.unitAssetIds(this.db, unitId);
      await this.urls.publish(
        await this.db.asset.findMany({
          where: { id: { in: ids }, status: from },
          select: { storageKey: true },
        }),
      );
    }
    return this.db.$transaction(
      async (tx) => {
        const counts: Record<string, number> = {};
        const unit = await tx.unit.findUniqueOrThrow({ where: { id: unitId } });
        const rows: { entity: ContentEntity; ids: string[] }[] = [
          { entity: 'unit', ids: unit.status === from ? [unit.id] : [] },
          {
            entity: 'word',
            ids: (await tx.word.findMany({ where: { unitId, status: from }, select: { id: true } })).map(
              (r) => r.id,
            ),
          },
          {
            entity: 'material',
            ids: (await tx.material.findMany({ where: { unitId, status: from }, select: { id: true } })).map(
              (r) => r.id,
            ),
          },
          {
            entity: 'lesson',
            ids: (await tx.lesson.findMany({ where: { unitId, status: from }, select: { id: true } })).map(
              (r) => r.id,
            ),
          },
        ];
        for (const { entity, ids } of rows) {
          counts[entity] = ids.length;
          for (const id of ids) {
            const delegate = tx[entity] as unknown as {
              update(args: object): Promise<{ id: string; version: number }>;
            };
            const updated = await delegate.update({ where: { id }, data: { status: to } });
            await writeRevision(tx, entity, updated, { authorId: user.id, note: `unit status ${to}` });
          }
        }
        const assets = await tx.asset.updateMany({
          where: { status: from, id: { in: await this.unitAssetIds(tx, unitId) } },
          data: { status: to },
        });
        counts.asset = assets.count;
        return counts;
      },
      { timeout: 60_000 },
    );
  }

  /** Assets used anywhere in a unit (unit pictures, material files, page images and audio, word pictures, lead character art). */
  async unitAssetIds(
    tx: Prisma.TransactionClient | PrismaService['client'],
    unitId: string,
  ): Promise<string[]> {
    const [unitPictures, materialAssets, pages, words, unit] = await Promise.all([
      tx.unitAsset.findMany({ where: { unitId }, select: { assetId: true } }),
      tx.materialAsset.findMany({ where: { material: { unitId } }, select: { assetId: true } }),
      tx.materialPage.findMany({
        where: { material: { unitId } },
        select: { imageAssetId: true, audioAssetId: true },
      }),
      tx.word.findMany({ where: { unitId }, select: { imageAssetId: true } }),
      tx.unit.findUniqueOrThrow({
        where: { id: unitId },
        select: { leadCharacter: { select: { artAssetId: true } } },
      }),
    ]);
    const ids = new Set<string>();
    unitPictures.forEach((row) => ids.add(row.assetId));
    materialAssets.forEach((row) => ids.add(row.assetId));
    for (const page of pages) {
      if (page.imageAssetId) ids.add(page.imageAssetId);
      if (page.audioAssetId) ids.add(page.audioAssetId);
    }
    words.forEach((word) => word.imageAssetId && ids.add(word.imageAssetId));
    if (unit.leadCharacter?.artAssetId) ids.add(unit.leadCharacter.artAssetId);
    return [...ids];
  }

  /** Machine-checkable content rules for one unit (same checks as the importer report). */
  async validateUnit(unitId: string, db: Db = this.db): Promise<RuleFinding[]> {
    const unit = await db.unit.findUniqueOrThrow({
      where: { id: unitId },
      include: {
        level: true,
        words: { where: { status: ACTIVE } },
        materials: { where: { status: ACTIVE }, include: { pages: { orderBy: { number: 'asc' } } } },
        lessons: {
          where: { status: ACTIVE },
          include: {
            steps: { orderBy: { order: 'asc' }, include: { material: { select: { code: true } } } },
          },
        },
      },
    });
    return checkUnitRules({
      unitCode: unit.code,
      isFirstUnit: unit.number === 1,
      rules: unit.level.rules as LevelRules,
      words: unit.words,
      materials: unit.materials.map((material) => ({
        code: material.code,
        type: material.type,
        title: material.title,
        fullText: material.fullText,
        pageTexts: material.pages.map((page) => page.text),
      })),
      lessons: unit.lessons.map((lesson) => ({
        number: lesson.number,
        minutes: lesson.minutes,
        newToday: lesson.newToday,
        steps: lesson.steps.map((step) => ({
          title: step.title,
          minutes: step.minutes,
          materialCode: step.material?.code ?? null,
        })),
      })),
    });
  }
}
