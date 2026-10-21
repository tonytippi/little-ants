import { Inject, Injectable } from '@nestjs/common';
import type { Asset, Prisma } from '@little-ants/db';
import {
  RELEASE_FORMAT,
  type ReleaseMedia,
  type UnitReleasePayload,
} from '@little-ants/shared';
import type { ObjectStorage } from '@little-ants/storage';
import { ContentService, type Db } from '../content/content.service.js';
import { OBJECT_STORAGE } from '../storage/storage.tokens.js';

export interface ReleaseCheck {
  blockers: string[];
  warnings: string[];
}

const NOT_ARCHIVED = { not: 'ARCHIVED' as const };

@Injectable()
export class ReleaseBuilder {
  constructor(
    private readonly content: ContentService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  private loadUnit(unitId: string, db: Db = this.content.db) {
    return db.unit.findUniqueOrThrow({
      where: { id: unitId },
      include: {
        level: true,
        leadCharacter: { include: { artAsset: true } },
        canDoGoals: { orderBy: { order: 'asc' } },
        words: { where: { status: NOT_ARCHIVED }, orderBy: [{ kind: 'asc' }, { order: 'asc' }], include: { imageAsset: true } },
        materials: {
          where: { status: NOT_ARCHIVED },
          orderBy: { code: 'asc' },
          include: {
            pages: { orderBy: { number: 'asc' }, include: { imageAsset: true, audioAsset: true } },
            assets: { orderBy: [{ role: 'asc' }, { order: 'asc' }], include: { asset: true } },
          },
        },
        lessons: {
          where: { status: NOT_ARCHIVED },
          orderBy: { number: 'asc' },
          include: {
            steps: { orderBy: { order: 'asc' }, include: { material: { select: { code: true } } } },
            prepItems: { orderBy: { order: 'asc' }, include: { material: { select: { code: true } } } },
          },
        },
      },
    });
  }

  /** What stops a unit from being published, and what will be left out. */
  async check(unitId: string, db: Db = this.content.db): Promise<ReleaseCheck> {
    const unit = await this.loadUnit(unitId, db);
    const blockers: string[] = [];
    const warnings: string[] = [];
    const notApproved = (label: string, rows: { status: string }[]): void => {
      const count = rows.filter((row) => row.status !== 'APPROVED').length;
      if (count) blockers.push(`${count} ${label} not approved yet`);
    };
    notApproved('unit overview', [unit]);
    notApproved('words', unit.words);
    notApproved('materials', unit.materials);
    notApproved('lessons', unit.lessons);
    if (unit.lessons.length === 0) blockers.push('The unit has no lessons');

    const findings = await this.content.validateUnit(unitId, db);
    for (const finding of findings.filter((f) => f.severity === 'error')) blockers.push(`${finding.where}: ${finding.message}`);
    const ruleWarnings = findings.filter((f) => f.severity === 'warning').length;
    if (ruleWarnings) warnings.push(`${ruleWarnings} content rule warnings (see the validation tab)`);

    const unapproved = new Set<string>();
    const note = (asset: Asset | null): void => {
      if (asset && asset.status !== 'APPROVED') unapproved.add(asset.fileName);
    };
    note(unit.leadCharacter?.artAsset ?? null);
    unit.words.forEach((word) => note(word.imageAsset));
    for (const material of unit.materials) {
      material.assets.forEach((link) => note(link.asset));
      material.pages.forEach((page) => {
        note(page.imageAsset);
        note(page.audioAsset);
      });
    }
    if (unapproved.size) warnings.push(`${unapproved.size} files are not approved and will be left out`);
    return { blockers, warnings };
  }

  /**
   * Build the bundle. A preview (for Admin) also includes draft files through short-lived signed links;
   * a real release includes approved files only, at their permanent public URLs.
   */
  async build(
    unitId: string,
    version: number,
    publishedAt: Date,
    options: { preview?: boolean } = {},
    db: Db = this.content.db,
  ): Promise<UnitReleasePayload> {
    const unit = await this.loadUnit(unitId, db);
    const urls = new Map<string, string>();
    if (options.preview) {
      const draftAssets = await this.content.db.asset.findMany({
        where: { id: { in: await this.content.unitAssetIds(this.content.db, unitId) }, status: { not: 'APPROVED' } },
        select: { id: true, storageKey: true },
      });
      for (const asset of draftAssets) urls.set(asset.id, await this.storage.signedReadUrl(asset.storageKey, 4 * 3600));
    }
    const media = (asset: Asset | null): ReleaseMedia | null => {
      if (!asset || asset.status === 'ARCHIVED') return null;
      const url = asset.status === 'APPROVED' ? this.storage.publicUrl(asset.storageKey) : urls.get(asset.id);
      if (!url) return null;
      return { id: asset.id, kind: asset.kind, mimeType: asset.mimeType, url, sizeBytes: asset.sizeBytes, fileName: asset.fileName };
    };

    return {
      format: RELEASE_FORMAT,
      version,
      publishedAt: publishedAt.toISOString(),
      unit: {
        code: unit.code,
        number: unit.number,
        title: unit.title,
        level: { number: unit.level.number, name: unit.level.name, ageBand: unit.level.ageBand, lessonMinutes: unit.level.lessonMinutes },
        leadCharacter: unit.leadCharacter
          ? { code: unit.leadCharacter.code, name: unit.leadCharacter.name, image: media(unit.leadCharacter.artAsset) }
          : null,
        bigQuestion: unit.bigQuestion,
        value: unit.value,
        party: unit.party,
        sounds: unit.soundDetails as { sound: string; words: string }[],
        keyLanguage: unit.keyLanguage,
        parentMessage: unit.parentMessage,
      },
      canDoGoals: unit.canDoGoals.map((goal) => ({ order: goal.order, text: goal.text })),
      words: unit.words.map((word) => ({ cardId: word.cardId, text: word.text, kind: word.kind, group: word.group, image: media(word.imageAsset) })),
      materials: unit.materials.map((material) => ({
        code: material.code,
        type: material.type,
        title: material.title,
        format: material.format,
        targetLanguage: material.targetLanguage,
        fullText: material.fullText,
        actions: material.actions,
        teacherNotes: material.teacherNotes,
        pages: material.pages.map((page) => ({
          number: page.number,
          text: page.text,
          image: media(page.imageAsset),
          audio: media(page.audioAsset),
        })),
        media: material.assets
          .map((link) => {
            const item = media(link.asset);
            return item ? { ...item, role: link.role } : null;
          })
          .filter((item): item is ReleaseMedia & { role: string } => item !== null),
      })),
      lessons: unit.lessons.map((lesson) => ({
        number: lesson.number,
        week: lesson.week,
        stage: lesson.stage,
        minutes: lesson.minutes,
        newToday: lesson.newToday,
        goals: lesson.goals,
        keyLanguage: lesson.keyLanguage,
        prepMinutes: lesson.prepMinutes,
        prep: lesson.prepItems.map((item) => ({ text: item.text, materialCode: item.material?.code ?? null })),
        steps: lesson.steps.map((step) => ({
          order: step.order,
          minutes: step.minutes,
          kind: step.kind,
          title: step.title,
          materialCode: step.material?.code ?? null,
          teacherText: step.teacherText,
          childrenText: step.childrenText,
        })),
        support: lesson.support,
        challenge: lesson.challenge,
        lookFor: lesson.lookFor,
        homeLink: lesson.homeLink,
      })),
    };
  }

  /**
   * Check, build and store the next release version in one transaction.
   * An advisory lock serialises publishes of the same unit; FOR SHARE row locks make any edit
   * of the unit's content wait until the release is stored, so a release never mixes in draft text.
   */
  async publish(unitId: string, publishedById: string, note: string): Promise<{ version: number } | ReleaseCheck> {
    return this.content.db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'publish:' + unitId}))`;
        await tx.$queryRaw`SELECT id FROM "Unit" WHERE id = ${unitId} FOR SHARE`;
        await tx.$queryRaw`SELECT id FROM "Word" WHERE "unitId" = ${unitId} FOR SHARE`;
        await tx.$queryRaw`SELECT id FROM "Material" WHERE "unitId" = ${unitId} FOR SHARE`;
        await tx.$queryRaw`SELECT id FROM "Lesson" WHERE "unitId" = ${unitId} FOR SHARE`;
        const check = await this.check(unitId, tx);
        if (check.blockers.length) return check;
        const last = await tx.unitRelease.findFirst({ where: { unitId }, orderBy: { version: 'desc' }, select: { version: true } });
        const version = (last?.version ?? 0) + 1;
        const publishedAt = new Date();
        const payload = await this.build(unitId, version, publishedAt, {}, tx);
        await tx.unitRelease.create({
          data: { unitId, version, payload: payload as unknown as Prisma.InputJsonValue, note, publishedById, publishedAt },
        });
        return { version };
      },
      { timeout: 120_000, maxWait: 30_000 },
    );
  }
}
