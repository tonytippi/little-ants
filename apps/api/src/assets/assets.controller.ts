import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { canChangeStatus, stateAfterEdit, writeRevision, type ContentStatus, type Prisma } from '@little-ants/db';
import { ASSET_MIME_TYPES, MAX_ASSET_BYTES, statusChange, uploadRequest } from '@little-ants/shared';
import { assetStorageKey, type ObjectStorage } from '@little-ants/storage';
import { z } from 'zod';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { hasRole, type StaffUser } from '../auth/staff-access.js';
import { ZodBody } from '../common/zod-body.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OBJECT_STORAGE } from '../storage/storage.tokens.js';
import { AssetUrls } from './asset-urls.service.js';

const bulkStatus = z.object({ ids: z.array(z.string().min(1)).min(1).max(500), status: z.enum(['REVIEW', 'APPROVED', 'ARCHIVED', 'DRAFT']) });

@Roles('AUTHOR', 'REVIEWER')
@Controller('assets')
export class AssetsController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly urls: AssetUrls,
  ) {}

  private get db() {
    return this.prisma.client;
  }

  private viewUrl(asset: { storageKey: string; status: ContentStatus }): Promise<string> {
    return this.urls.viewUrl(asset);
  }

  @Get()
  async list(
    @Query('unit') unitCode?: string,
    @Query('kind') kind?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('take') take = '60',
    @Query('skip') skip = '0',
  ) {
    const where: Prisma.AssetWhereInput = { next: null, uploaded: true }; // latest, fully uploaded versions only
    if (kind) where.kind = kind as Prisma.AssetWhereInput['kind'];
    if (status) where.status = status as ContentStatus;
    if (q) where.fileName = { contains: q, mode: 'insensitive' };
    if (unitCode) {
      const unit = { code: unitCode.toUpperCase() };
      where.OR = [
        { unitAssets: { some: { unit } } },
        { materialAssets: { some: { material: { unit } } } },
        { pageImages: { some: { material: { unit } } } },
        { pageAudio: { some: { material: { unit } } } },
        { words: { some: { unit } } },
      ];
    }
    const [total, rows] = await Promise.all([
      this.db.asset.count({ where }),
      this.db.asset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(Number(take) || 60, 200),
        skip: Number(skip) || 0,
        include: {
          uploadedBy: { select: { name: true } },
          materialAssets: { select: { role: true, material: { select: { id: true, code: true, unit: { select: { code: true } } } } } },
        },
      }),
    ]);
    const assets = await Promise.all(rows.map(async (asset) => ({ ...asset, url: await this.viewUrl(asset) })));
    return { total, assets };
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    const asset = await this.db.asset.findUnique({
      where: { id },
      include: { previous: { select: { id: true, version: true, createdAt: true } }, uploadedBy: { select: { name: true } } },
    });
    if (!asset) throw new NotFoundException();
    const versions: { id: string; version: number; status: ContentStatus; createdAt: Date }[] = [];
    let cursor: string | null = asset.previousId;
    while (cursor) {
      const older: { id: string; version: number; status: ContentStatus; createdAt: Date; previousId: string | null } | null =
        await this.db.asset.findUnique({ where: { id: cursor }, select: { id: true, version: true, status: true, createdAt: true, previousId: true } });
      if (!older) break;
      versions.push(older);
      cursor = older.previousId;
    }
    return { ...asset, url: await this.viewUrl(asset), olderVersions: versions };
  }

  /**
   * Step 1 of an upload: create the asset row and return a URL the browser PUTs the file to.
   * Uploading with `replacesId` creates a new version; the old version is kept.
   */
  @Roles('AUTHOR', 'REVIEWER')
  @Post('upload-url')
  async uploadUrl(@CurrentUser() user: StaffUser, @Body(new ZodBody(uploadRequest)) body: z.infer<typeof uploadRequest>) {
    let version = 1;
    if (body.replacesId) {
      const previous = await this.db.asset.findUnique({ where: { id: body.replacesId }, include: { next: { select: { id: true } } } });
      if (!previous) throw new NotFoundException('Asset to replace not found');
      if (previous.next) throw new BadRequestException('Only the latest version can be replaced');
      version = previous.version + 1;
    }
    const asset = await this.db.asset.create({
      data: {
        kind: ASSET_MIME_TYPES[body.mimeType]!,
        storageKey: `pending/${crypto.randomUUID()}`,
        fileName: body.fileName,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
        version,
        uploadedById: user.id,
        uploaded: false,
        // previousId is set when the upload completes, so a failed upload never hides the current version.
        pendingReplacesId: body.replacesId ?? null,
      },
    });
    const storageKey = assetStorageKey(asset.id, version, body.fileName);
    await this.db.asset.update({ where: { id: asset.id }, data: { storageKey } });
    return { assetId: asset.id, uploadUrl: await this.storage.signedUploadUrl(storageKey, body.mimeType, 900, body.sizeBytes), headers: { 'Content-Type': body.mimeType } };
  }

  /**
   * Step 2: confirm the file arrived. Safe to call again (a retry returns the finished asset).
   * A new version takes over the links of the one it replaces; content that pointed at the old file
   * gets a revision and goes back to draft, because what it shows has changed.
   */
  @Post(':id/complete')
  async complete(@CurrentUser() user: StaffUser, @Param('id') id: string) {
    const asset = await this.db.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException();
    if (asset.uploaded) return this.detail(id);
    const stored = await this.storage.head(asset.storageKey);
    if (!stored) throw new BadRequestException('The file has not been uploaded yet');
    if (stored.sizeBytes !== asset.sizeBytes || stored.sizeBytes > MAX_ASSET_BYTES) {
      await this.storage.delete(asset.storageKey);
      await this.db.asset.delete({ where: { id } });
      throw new BadRequestException('The uploaded file is not the size that was announced; please upload it again');
    }
    const replacesId = asset.pendingReplacesId;
    await this.db.$transaction(async (tx) => {
      if (replacesId && (await tx.asset.findFirst({ where: { previousId: replacesId }, select: { id: true } }))) {
        throw new ConflictException('Someone else has already uploaded a new version of this file');
      }
      await tx.asset.update({ where: { id }, data: { uploaded: true, pendingReplacesId: null, previousId: replacesId } });
      if (replacesId) await this.moveLinks(tx, replacesId, id, user.id);
    });
    return this.detail(id);
  }

  private async moveLinks(tx: Prisma.TransactionClient, fromId: string, toId: string, authorId: string): Promise<void> {
    const note = 'file replaced by a new version';
    const [unitPictures, links, imagePages, audioPages, words] = await Promise.all([
      tx.unitAsset.findMany({ where: { assetId: fromId }, select: { unitId: true } }),
      tx.materialAsset.findMany({ where: { assetId: fromId }, select: { materialId: true } }),
      tx.materialPage.findMany({ where: { imageAssetId: fromId }, select: { materialId: true } }),
      tx.materialPage.findMany({ where: { audioAssetId: fromId }, select: { materialId: true } }),
      tx.word.findMany({ where: { imageAssetId: fromId } }),
    ]);
    await tx.unitAsset.updateMany({ where: { assetId: fromId }, data: { assetId: toId } });
    await tx.materialAsset.updateMany({ where: { assetId: fromId }, data: { assetId: toId } });
    await tx.materialPage.updateMany({ where: { imageAssetId: fromId }, data: { imageAssetId: toId } });
    await tx.materialPage.updateMany({ where: { audioAssetId: fromId }, data: { audioAssetId: toId } });
    await tx.character.updateMany({ where: { artAssetId: fromId }, data: { artAssetId: toId } });
    const materialIds = new Set([...links, ...imagePages, ...audioPages].map((row) => row.materialId));
    for (const materialId of materialIds) {
      const current = await tx.material.findUniqueOrThrow({ where: { id: materialId } });
      const updated = await tx.material.update({ where: { id: materialId }, data: stateAfterEdit(current) });
      await writeRevision(tx, 'material', updated, { authorId, note });
    }
    for (const unitId of new Set(unitPictures.map((row) => row.unitId))) {
      const current = await tx.unit.findUniqueOrThrow({ where: { id: unitId } });
      const updated = await tx.unit.update({ where: { id: unitId }, data: stateAfterEdit(current) });
      await writeRevision(tx, 'unit', updated, { authorId, note });
    }
    for (const word of words) {
      const updated = await tx.word.update({ where: { id: word.id }, data: { imageAssetId: toId, ...stateAfterEdit(word) } });
      await writeRevision(tx, 'word', updated, { authorId, note });
    }
  }

  @Post(':id/status')
  async status(@CurrentUser() user: StaffUser, @Param('id') id: string, @Body(new ZodBody(statusChange)) body: z.infer<typeof statusChange>) {
    const asset = await this.db.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException();
    this.assertStatusChange(user, asset.status, body.status);
    if (body.status === 'APPROVED') await this.urls.publish([asset]);
    return this.db.asset.update({ where: { id }, data: { status: body.status } });
  }

  @Post('status')
  async bulkStatus(@CurrentUser() user: StaffUser, @Body(new ZodBody(bulkStatus)) body: z.infer<typeof bulkStatus>) {
    const assets = await this.db.asset.findMany({ where: { id: { in: body.ids }, uploaded: true }, select: { id: true, status: true, storageKey: true } });
    const allowed = assets.filter((asset) => canChangeStatus(asset.status, body.status));
    if (allowed.length) this.assertStatusChange(user, allowed[0]!.status, body.status);
    if (body.status === 'APPROVED') await this.urls.publish(allowed);
    const result = await this.db.asset.updateMany({ where: { id: { in: allowed.map((a) => a.id) } }, data: { status: body.status } });
    return { updated: result.count, skipped: body.ids.length - result.count };
  }

  private assertStatusChange(user: StaffUser, from: ContentStatus, to: ContentStatus): void {
    if (!canChangeStatus(from, to)) throw new BadRequestException(`Cannot change status from ${from} to ${to}`);
    if (to === 'APPROVED' && !hasRole(user, 'ADMIN', 'REVIEWER')) throw new ForbiddenException('Only reviewers can approve files');
  }
}
