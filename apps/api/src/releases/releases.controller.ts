import { Body, ConflictException, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { releaseInput } from '@little-ants/shared';
import type { z } from 'zod';
import { CurrentUser, Roles } from '../auth/decorators.js';
import type { StaffUser } from '../auth/staff-access.js';
import { ZodBody } from '../common/zod-body.js';
import { ContentService } from '../content/content.service.js';
import { ReleaseBuilder } from './release-builder.service.js';

@Roles('AUTHOR', 'REVIEWER')
@Controller('content/units/:code')
export class ReleasesController {
  constructor(
    private readonly content: ContentService,
    private readonly builder: ReleaseBuilder,
  ) {}

  @Get('release-check')
  async check(@Param('code') code: string) {
    const unit = await this.content.unitByCode(code);
    return this.builder.check(unit.id);
  }

  /** Publish the unit for teachers (reviewers only). Fails with the list of blockers if anything is not ready. */
  @Roles('REVIEWER')
  @Post('releases')
  async publish(@CurrentUser() user: StaffUser, @Param('code') code: string, @Body(new ZodBody(releaseInput)) body: z.infer<typeof releaseInput>) {
    const unit = await this.content.unitByCode(code);
    const result = await this.builder.publish(unit.id, user.id, body.note);
    if ('blockers' in result) throw new ConflictException({ message: 'The unit is not ready to publish', ...result });
    return result;
  }

  /** The current draft as a release bundle, for previewing lessons before publishing. */
  @Roles('AUTHOR', 'REVIEWER')
  @Get('preview')
  async preview(@Param('code') code: string) {
    const unit = await this.content.unitByCode(code);
    return this.builder.build(unit.id, 0, new Date(), { preview: true });
  }

  @Get('releases/:version')
  async release(@Param('code') code: string, @Param('version') version: string) {
    const unit = await this.content.unitByCode(code);
    const release = await this.content.db.unitRelease.findUnique({ where: { unitId_version: { unitId: unit.id, version: Number(version) } } });
    if (!release) throw new NotFoundException();
    return release.payload;
  }
}
