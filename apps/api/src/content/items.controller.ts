import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { editContent, stateAfterEdit, writeRevision, type ContentEntity, type Prisma } from '@little-ants/db';
import {
  lessonInput,
  materialAssetsInput,
  materialInput,
  materialUpdate,
  pagesInput,
  productionUpdate,
  statusChange,
  wordInput,
  wordUpdate,
} from '@little-ants/shared';
import type { z } from 'zod';
import { CurrentUser, Roles } from '../auth/decorators.js';
import type { StaffUser } from '../auth/staff-access.js';
import { ZodBody } from '../common/zod-body.js';
import { AssetUrls } from '../assets/asset-urls.service.js';
import { ContentService } from './content.service.js';

const ENTITIES = new Set<ContentEntity>(['unit', 'word', 'material', 'lesson']);

@Roles('AUTHOR', 'REVIEWER')
@Controller('content')
export class ItemsController {
  constructor(
    private readonly content: ContentService,
    private readonly urls: AssetUrls,
  ) {}

  private get db() {
    return this.content.db;
  }

  // Words -------------------------------------------------------------------

  @Roles('AUTHOR', 'REVIEWER')
  @Post('units/:code/words')
  async addWord(
    @CurrentUser() user: StaffUser,
    @Param('code') code: string,
    @Body(new ZodBody(wordInput)) body: z.infer<typeof wordInput>,
  ) {
    const unit = await this.content.unitByCode(code);
    const last = await this.db.word.aggregate({ where: { unitId: unit.id }, _max: { order: true } });
    return this.db.$transaction(async (tx) => {
      const word = await tx.word.create({
        data: { ...body, unitId: unit.id, order: (last._max.order ?? 0) + 1 },
      });
      await writeRevision(tx, 'word', word, { authorId: user.id, note: 'add word' });
      return word;
    });
  }

  @Roles('AUTHOR', 'REVIEWER')
  @Patch('words/:id')
  updateWord(
    @CurrentUser() user: StaffUser,
    @Param('id') id: string,
    @Body(new ZodBody(wordUpdate)) body: z.infer<typeof wordUpdate>,
  ) {
    const { note, ...data } = body;
    return editContent(this.db, 'word', id, data, { authorId: user.id, note: note ?? 'edit word' });
  }

  @Roles('AUTHOR', 'REVIEWER')
  @Post('words/:id/status')
  wordStatus(
    @CurrentUser() user: StaffUser,
    @Param('id') id: string,
    @Body(new ZodBody(statusChange)) body: z.infer<typeof statusChange>,
  ) {
    return this.content.setStatus(user, 'word', id, body.status, body.note);
  }

  // Materials ---------------------------------------------------------------

  @Get('materials/:id')
  async material(@Param('id') id: string) {
    const material = await this.db.material.findUnique({
      where: { id },
      include: {
        unit: { select: { id: true, code: true, title: true } },
        pages: { orderBy: { number: 'asc' }, include: { imageAsset: true, audioAsset: true } },
        assets: { orderBy: [{ role: 'asc' }, { order: 'asc' }], include: { asset: true } },
        production: true,
        steps: {
          select: { lesson: { select: { id: true, number: true } } },
          orderBy: { lesson: { number: 'asc' } },
        },
      },
    });
    if (!material) throw new NotFoundException();
    const lessons = [...new Map(material.steps.map((step) => [step.lesson.id, step.lesson])).values()];
    const { steps: _steps, ...rest } = material;
    // Each file carries a URL Admin can show directly.
    const pages = await Promise.all(
      material.pages.map(async (page) => ({
        ...page,
        imageAsset: await this.urls.withUrl(page.imageAsset),
        audioAsset: await this.urls.withUrl(page.audioAsset),
      })),
    );
    const assets = await Promise.all(
      material.assets.map(async (link) => ({ ...link, asset: await this.urls.withUrl(link.asset) })),
    );
    return { ...rest, pages, assets, usedInLessons: lessons };
  }

  @Roles('AUTHOR', 'REVIEWER')
  @Post('units/:code/materials')
  async addMaterial(
    @CurrentUser() user: StaffUser,
    @Param('code') code: string,
    @Body(new ZodBody(materialInput)) body: z.infer<typeof materialInput>,
  ) {
    const unit = await this.content.unitByCode(code);
    return this.db.$transaction(async (tx) => {
      const material = await tx.material.create({ data: { ...body, unitId: unit.id } });
      await writeRevision(tx, 'material', material, { authorId: user.id, note: 'add material' });
      return material;
    });
  }

  @Roles('AUTHOR', 'REVIEWER')
  @Patch('materials/:id')
  updateMaterial(
    @CurrentUser() user: StaffUser,
    @Param('id') id: string,
    @Body(new ZodBody(materialUpdate)) body: z.infer<typeof materialUpdate>,
  ) {
    const { note, ...data } = body;
    return editContent(this.db, 'material', id, data, { authorId: user.id, note: note ?? 'edit material' });
  }

  @Roles('AUTHOR', 'REVIEWER')
  @Post('materials/:id/status')
  materialStatus(
    @CurrentUser() user: StaffUser,
    @Param('id') id: string,
    @Body(new ZodBody(statusChange)) body: z.infer<typeof statusChange>,
  ) {
    return this.content.setStatus(user, 'material', id, body.status, body.note);
  }

  /** Replace all pages of a material (stories, books, cards). Recorded as one material revision. */
  @Roles('AUTHOR', 'REVIEWER')
  @Put('materials/:id/pages')
  async setPages(
    @CurrentUser() user: StaffUser,
    @Param('id') id: string,
    @Body(new ZodBody(pagesInput)) body: z.infer<typeof pagesInput>,
  ) {
    return this.db.$transaction(async (tx) => {
      const current = await tx.material.findUnique({ where: { id } });
      if (!current) throw new NotFoundException();
      await tx.materialPage.deleteMany({ where: { materialId: id } });
      await tx.materialPage.createMany({
        data: body.pages.map((page, index) => ({ ...page, materialId: id, number: index + 1 })),
      });
      const updated = await tx.material.update({ where: { id }, data: stateAfterEdit(current) });
      await writeRevision(tx, 'material', { ...updated, pages: body.pages } as typeof updated, {
        authorId: user.id,
        note: body.note ?? 'edit pages',
      });
      return tx.material.findUniqueOrThrow({
        where: { id },
        include: { pages: { orderBy: { number: 'asc' } } },
      });
    });
  }

  /** Set the files for one role of a material, e.g. the poster images or the song audio. */
  @Roles('AUTHOR', 'REVIEWER')
  @Put('materials/:id/assets')
  async setMaterialAssets(
    @CurrentUser() user: StaffUser,
    @Param('id') id: string,
    @Body(new ZodBody(materialAssetsInput)) body: z.infer<typeof materialAssetsInput>,
  ) {
    return this.db.$transaction(async (tx) => {
      const current = await tx.material.findUnique({ where: { id } });
      if (!current) throw new NotFoundException();
      await tx.materialAsset.deleteMany({ where: { materialId: id, role: body.role } });
      await tx.materialAsset.createMany({
        data: body.assetIds.map((assetId, order) => ({ materialId: id, assetId, role: body.role, order })),
      });
      const updated = await tx.material.update({ where: { id }, data: stateAfterEdit(current) });
      await writeRevision(tx, 'material', updated, { authorId: user.id, note: `set ${body.role} files` });
      return tx.materialAsset.findMany({
        where: { materialId: id },
        include: { asset: true },
        orderBy: [{ role: 'asc' }, { order: 'asc' }],
      });
    });
  }

  // Lessons -----------------------------------------------------------------

  @Get('lessons/:id')
  async lesson(@Param('id') id: string) {
    const lesson = await this.db.lesson.findUnique({
      where: { id },
      include: {
        unit: {
          select: { id: true, code: true, title: true, level: { select: { number: true, name: true } } },
        },
        steps: {
          orderBy: { order: 'asc' },
          include: { material: { select: { id: true, code: true, title: true, type: true } } },
        },
        prepItems: { orderBy: { order: 'asc' }, include: { material: { select: { id: true, code: true } } } },
      },
    });
    if (!lesson) throw new NotFoundException();
    const [previous, next] = await Promise.all([
      this.db.lesson.findUnique({
        where: { unitId_number: { unitId: lesson.unitId, number: lesson.number - 1 } },
        select: { id: true },
      }),
      this.db.lesson.findUnique({
        where: { unitId_number: { unitId: lesson.unitId, number: lesson.number + 1 } },
        select: { id: true },
      }),
    ]);
    return { ...lesson, previousId: previous?.id ?? null, nextId: next?.id ?? null };
  }

  @Get('units/:code/lessons/:number')
  async lessonByNumber(@Param('code') code: string, @Param('number') number: string) {
    const unit = await this.content.unitByCode(code);
    const lesson = await this.db.lesson.findUnique({
      where: { unitId_number: { unitId: unit.id, number: Number(number) } },
      select: { id: true },
    });
    if (!lesson) throw new NotFoundException();
    return this.lesson(lesson.id);
  }

  /** Save a whole lesson (fields, steps and prep list) as one revision. */
  @Roles('AUTHOR', 'REVIEWER')
  @Put('lessons/:id')
  async saveLesson(
    @CurrentUser() user: StaffUser,
    @Param('id') id: string,
    @Body(new ZodBody(lessonInput)) body: z.infer<typeof lessonInput>,
  ) {
    const { steps, prep, note, ...fields } = body;
    await this.db.$transaction(async (tx) => {
      const current = await tx.lesson.findUnique({ where: { id } });
      if (!current) throw new NotFoundException();
      const materialIds = [...steps.map((s) => s.materialId), ...prep.map((p) => p.materialId)].filter(
        (v): v is string => !!v,
      );
      if (materialIds.length) {
        const found = await tx.material.count({ where: { id: { in: materialIds }, unitId: current.unitId } });
        if (found !== new Set(materialIds).size)
          throw new BadRequestException('Steps may only use materials from this unit');
      }
      await tx.lessonStep.deleteMany({ where: { lessonId: id } });
      await tx.lessonStep.createMany({
        data: steps.map((step, index) => ({ ...step, lessonId: id, order: index + 1 })),
      });
      await tx.prepItem.deleteMany({ where: { lessonId: id } });
      await tx.prepItem.createMany({
        data: prep.map((item, index) => ({ ...item, lessonId: id, order: index + 1 })),
      });
      const updated = await tx.lesson.update({
        where: { id },
        data: { ...fields, ...stateAfterEdit(current) },
      });
      await writeRevision(tx, 'lesson', { ...updated, steps, prep } as typeof updated, {
        authorId: user.id,
        note: note ?? 'edit lesson',
      });
    });
    return this.lesson(id);
  }

  @Roles('AUTHOR', 'REVIEWER')
  @Post('lessons/:id/status')
  lessonStatus(
    @CurrentUser() user: StaffUser,
    @Param('id') id: string,
    @Body(new ZodBody(statusChange)) body: z.infer<typeof statusChange>,
  ) {
    return this.content.setStatus(user, 'lesson', id, body.status, body.note);
  }

  // Production --------------------------------------------------------------

  @Get('units/:code/production')
  async production(@Param('code') code: string) {
    const unit = await this.content.unitByCode(code);
    return this.db.material.findMany({
      where: { unitId: unit.id },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, title: true, type: true, production: { orderBy: { stage: 'asc' } } },
    });
  }

  @Roles('AUTHOR', 'REVIEWER')
  @Patch('production/:id')
  async updateProduction(
    @Param('id') id: string,
    @Body(new ZodBody(productionUpdate)) body: z.infer<typeof productionUpdate>,
  ) {
    return this.db.productionStatus.update({ where: { id }, data: body });
  }

  // History -----------------------------------------------------------------

  @Get('revisions')
  async revisions(@Query('entityType') entityType: string, @Query('entityId') entityId: string) {
    if (!ENTITIES.has(entityType as ContentEntity) || !entityId)
      throw new BadRequestException('entityType and entityId are required');
    return this.db.revision.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { author: { select: { name: true } } },
    });
  }

  /** Bring back an older version as a new draft (the history is kept). */
  @Roles('AUTHOR', 'REVIEWER')
  @Post('revisions/:id/restore')
  async restore(@CurrentUser() user: StaffUser, @Param('id') id: string) {
    const revision = await this.db.revision.findUnique({ where: { id } });
    if (!revision) throw new NotFoundException();
    const entity = revision.entityType as ContentEntity;
    const snapshot = revision.snapshot as Record<string, unknown>;
    const restorable = RESTORABLE_FIELDS[entity];
    const data = Object.fromEntries(Object.entries(snapshot).filter(([key]) => restorable.includes(key)));
    if (entity === 'lesson' && Array.isArray(snapshot.steps)) {
      const lesson = await this.lesson(revision.entityId);
      const materials = await this.db.material.findMany({
        where: { unitId: lesson.unitId },
        select: { id: true, code: true },
      });
      const idForCode = new Map(materials.map((material) => [material.code, material.id]));
      type SnapshotStep = z.infer<typeof lessonInput>['steps'][number] & { materialCode?: string | null };
      // Import snapshots name materials by code; Admin snapshots store the id.
      const steps = (snapshot.steps as SnapshotStep[]).map(({ materialCode, ...step }) => ({
        ...step,
        materialId: step.materialId ?? (materialCode ? (idForCode.get(materialCode) ?? null) : null),
      }));
      const prep = Array.isArray(snapshot.prep)
        ? (snapshot.prep as z.infer<typeof lessonInput>['prep'])
        : lesson.prepItems.map((item) => ({ text: item.text, materialId: item.materialId }));
      const merged = lessonInput.parse({
        ...lesson,
        ...data,
        steps,
        prep,
        note: `restore version ${revision.version}`,
      });
      return this.saveLesson(user, revision.entityId, merged);
    }
    return editContent(this.db, entity, revision.entityId, data as Prisma.InputJsonObject, {
      authorId: user.id,
      note: `restore version ${revision.version}`,
    });
  }

  @Roles('AUTHOR', 'REVIEWER')
  @Delete('words/:id')
  @HttpCode(204)
  async archiveWord(@CurrentUser() user: StaffUser, @Param('id') id: string): Promise<void> {
    await this.content.setStatus(user, 'word', id, 'ARCHIVED', 'remove word');
  }
}

const RESTORABLE_FIELDS: Record<ContentEntity, string[]> = {
  unit: [
    'title',
    'leadCharacterId',
    'leadCharacterNote',
    'circle',
    'vnLink',
    'bigQuestion',
    'value',
    'party',
    'sounds',
    'soundDetails',
    'keyLanguage',
    'parentMessage',
    'levelRulesNote',
    'links',
  ],
  word: [
    'text',
    'partOfSpeech',
    'kind',
    'group',
    'fromUnit',
    'pictureBrief',
    'notes',
    'imageAssetId',
    'order',
  ],
  material: [
    'type',
    'title',
    'format',
    'targetLanguage',
    'fullText',
    'actions',
    'teacherNotes',
    'firstLesson',
  ],
  lesson: [
    'week',
    'stage',
    'minutes',
    'newToday',
    'goals',
    'keyLanguage',
    'support',
    'challenge',
    'lookFor',
    'homeLink',
    'prepMinutes',
    'notes',
  ],
};
