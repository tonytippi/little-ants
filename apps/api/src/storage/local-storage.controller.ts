import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { MAX_ASSET_BYTES } from '@little-ants/shared';
import { LocalStorage, type ObjectStorage } from '@little-ants/storage';
import { Public } from '../auth/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OBJECT_STORAGE } from './storage.tokens.js';

/**
 * Development-only file routes that stand in for R2 when STORAGE_DRIVER=local.
 * Upload and read URLs carry an HMAC signature from the API, like presigned S3 URLs.
 */
@Public()
@Controller('storage')
export class LocalStorageController {
  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly prisma: PrismaService,
  ) {}

  private local(): LocalStorage {
    if (!(this.storage instanceof LocalStorage)) throw new NotFoundException();
    return this.storage;
  }

  @Put('upload/{*key}')
  @HttpCode(200)
  async upload(
    @Param('key') keyParts: string[],
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Req() request: Request,
  ): Promise<{ ok: true }> {
    const storage = this.local();
    const key = keyParts.join('/');
    const contentType = request.headers['content-type'] ?? '';
    if (!storage.verify('upload', key, Number(expires), signature ?? '', contentType)) {
      throw new ForbiddenException('Upload link is invalid or expired');
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
      size += (chunk as Buffer).length;
      if (size > MAX_ASSET_BYTES) throw new BadRequestException('File is too large');
      chunks.push(chunk as Buffer);
    }
    await storage.put(key, Buffer.concat(chunks), contentType);
    return { ok: true };
  }

  @Get('read/{*key}')
  async read(
    @Param('key') keyParts: string[],
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res() response: Response,
  ): Promise<void> {
    const storage = this.local();
    const key = keyParts.join('/');
    if (!storage.verify('read', key, Number(expires), signature ?? '')) {
      throw new ForbiddenException('Link is invalid or expired');
    }
    await this.send(storage, key, response, 'private, max-age=300');
  }

  /** Approved files only, like the public media domain in production. */
  @Get('public/{*key}')
  async publicFile(@Param('key') keyParts: string[], @Res() response: Response): Promise<void> {
    const storage = this.local();
    const key = keyParts.join('/');
    const asset = await this.prisma.client.asset.findUnique({ where: { storageKey: key }, select: { status: true } });
    if (asset?.status !== 'APPROVED') throw new NotFoundException();
    await this.send(storage, key, response, 'public, max-age=31536000, immutable');
  }

  private async send(storage: LocalStorage, key: string, response: Response, cacheControl: string): Promise<void> {
    if (!(await storage.head(key))) throw new NotFoundException();
    const asset = await this.prisma.client.asset.findUnique({ where: { storageKey: key }, select: { mimeType: true } });
    response.setHeader('Cache-Control', cacheControl);
    // Files are user uploads: never let the browser run them as pages on the API origin.
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    response.setHeader('Access-Control-Allow-Origin', '*');
    if (asset) response.type(asset.mimeType);
    response.sendFile(storage.filePath(key));
  }
}
