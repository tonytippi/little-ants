import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { listeningSyncInput, parentLinkInput, replaceDeviceInput } from '@little-ants/shared';
import type { z } from 'zod';
import { CurrentUser, Public } from '../auth/decorators.js';
import type { StaffUser } from '../auth/staff-access.js';
import { audit } from '../common/audit.js';
import { ZodBody } from '../common/zod-body.js';
import { loadEnv } from '../config/env.js';
import { OPEN_ENROLLMENT, OrgService, dayOrToday } from '../org/org.service.js';
import { requireSchool, schoolOfStudent } from '../org/school-access.js';
import { releasePictures } from '../releases/release-pictures.js';
import { PARENT_COOKIE, ParentAuthService, SIGN_IN_COOKIE, SignInRefused } from './parent-auth.service.js';
import { ListeningService } from './listening.service.js';
import { CurrentParent, ParentGuard, readCookie, type SignedInParent } from './parent-session.js';

/**
 * Parent cookies stay on the API host (no shared domain): only the API reads them, and the student app on a
 * sibling host still sends them with its credentialed requests because both are the same site.
 */
function cookieOptions(maxAge: number, path = '/'): CookieOptions {
  return { httpOnly: true, secure: loadEnv().NODE_ENV === 'production', sameSite: 'lax', path, maxAge };
}

/** Back to the student app's sign-in screen with a reason it can explain. */
function signInPage(query: Record<string, string>): string {
  const url = new URL('/signin', loadEnv().STUDENT_APP_URL);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.toString();
}

/** Parent sign-in with Google, the device limit, and sign-out. */
@Public()
@Controller('parent/auth')
export class ParentAuthController {
  constructor(private readonly auth: ParentAuthService) {}

  @Get('google/start')
  async start(
    @Res() response: Response,
    @Query('return') returnPath?: string,
    @Query('hint') hint?: string,
  ): Promise<void> {
    const { url, correlation } = await this.auth.start(returnPath, hint);
    response.cookie(SIGN_IN_COOKIE, correlation, cookieOptions(10 * 60 * 1000, '/api/parent/auth'));
    response.redirect(url);
  }

  @Get('google/callback')
  async callback(
    @Req() request: Request,
    @Res() response: Response,
    @Query('state') state = '',
    @Query('code') code = '',
    @Query('error') error?: string,
  ): Promise<void> {
    response.clearCookie(SIGN_IN_COOKIE, { ...cookieOptions(0, '/api/parent/auth'), maxAge: undefined });
    if (error || !code) {
      response.redirect(signInPage({ error: 'cancelled' }));
      return;
    }
    try {
      const result = await this.auth.finish(
        state,
        readCookie(request, SIGN_IN_COOKIE),
        code,
        request.headers['user-agent'],
        readCookie(request, PARENT_COOKIE),
      );
      if (result.kind === 'choose-device') {
        response.redirect(signInPage({ devices: result.pendingToken }));
        return;
      }
      response.cookie(PARENT_COOKIE, result.token, cookieOptions(result.maxAgeMs));
      response.redirect(result.redirect);
    } catch (caught) {
      if (caught instanceof SignInRefused) {
        response.redirect(signInPage({ error: caught.reason }));
        return;
      }
      throw caught;
    }
  }

  /** The devices to choose from when two are already signed in. */
  @Get('pending/:token')
  async pending(@Param('token') token: string) {
    try {
      return await this.auth.pendingDevices(token);
    } catch (caught) {
      if (caught instanceof SignInRefused)
        throw new NotFoundException('This sign-in has expired. Sign in again.');
      throw caught;
    }
  }

  @Post('pending/:token')
  @HttpCode(200)
  async replace(
    @Param('token') token: string,
    @Body(new ZodBody(replaceDeviceInput)) body: z.infer<typeof replaceDeviceInput>,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const session = await this.auth.replaceDevice(token, body.signOutSessionId);
      response.cookie(PARENT_COOKIE, session.token, cookieOptions(session.maxAgeMs));
      return { ok: true };
    } catch (caught) {
      if (caught instanceof SignInRefused)
        throw new NotFoundException('This sign-in has expired. Sign in again.');
      throw caught;
    }
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const session = await this.auth.resolve(readCookie(request, PARENT_COOKIE));
    if (session) await this.auth.signOut(session.parentId, session.sessionId);
    response.clearCookie(PARENT_COOKIE, { ...cookieOptions(0), maxAge: undefined });
    return { ok: true };
  }
}

/** What a signed-in parent sees: their children, the units each may open, and their devices. */
@Public()
@UseGuards(ParentGuard)
@Controller('parent')
export class ParentController {
  constructor(
    private readonly auth: ParentAuthService,
    private readonly org: OrgService,
    private readonly listening: ListeningService,
  ) {}

  @Get('me')
  async me(@CurrentParent() signedIn: SignedInParent) {
    const db = this.org.db;
    const parent = await db.parent.findUniqueOrThrow({
      where: { id: signedIn.parentId },
      select: {
        name: true,
        email: true,
        children: {
          orderBy: { student: { displayName: 'asc' } },
          select: { student: { select: { id: true, displayName: true } } },
        },
      },
    });
    const pictures = await releasePictures(db);
    const children = [];
    for (const { student } of parent.children) {
      const access = await this.org.studentAccess(student.id);
      if (!access.active) continue;
      const current = await db.enrollment.findFirst({
        where: { studentId: student.id, endedOn: null },
        select: {
          class: {
            select: {
              name: true,
              currentUnitId: true,
              nextLesson: true,
              level: { select: { number: true } },
            },
          },
        },
      });
      const units = await db.unit.findMany({
        where: { id: { in: access.unitIds }, releases: { some: {} } },
        orderBy: { number: 'asc' },
        select: { id: true, code: true, number: true, title: true },
      });
      children.push({
        ...student,
        className: current?.class.name ?? null,
        level: current?.class.level.number ?? null,
        nextLesson: current?.class.nextLesson ?? null,
        units: units.map(({ id, ...unit }) => ({
          ...unit,
          current: id === current?.class.currentUnitId,
          picture: pictures.get(unit.code) ?? null,
        })),
      });
    }
    return { parent: { name: parent.name, email: parent.email }, children };
  }

  /** What the student app plays for a unit (download it once to listen offline). */
  @Get('students/:id/units/:code/listening')
  unitListening(
    @CurrentParent() signedIn: SignedInParent,
    @Param('id') studentId: string,
    @Param('code') code: string,
  ) {
    return this.listening.payload(signedIn.parentId, studentId, code);
  }

  @Post('students/:id/listening/sync')
  sync(
    @CurrentParent() signedIn: SignedInParent,
    @Param('id') studentId: string,
    @Body(new ZodBody(listeningSyncInput)) body: z.infer<typeof listeningSyncInput>,
  ) {
    return this.listening.sync(signedIn.parentId, signedIn.sessionId, studentId, body);
  }

  /** `today` is the device's date (YYYY-MM-DD), so "new leaves today" matches what the child sees. */
  @Get('students/:id/listening/summary')
  summary(
    @CurrentParent() signedIn: SignedInParent,
    @Param('id') studentId: string,
    @Query('unit') unit = '',
    @Query('today') day?: string,
  ) {
    const date = dayOrToday(day);
    return this.listening.summary(signedIn.parentId, studentId, unit, date);
  }

  @Get('devices')
  async devices(@CurrentParent() signedIn: SignedInParent) {
    const devices = await this.auth.devices(signedIn.parentId);
    return devices.map((device) => ({ ...device, current: device.id === signedIn.sessionId }));
  }

  @Delete('devices/:id')
  @HttpCode(204)
  async signOutDevice(@CurrentParent() signedIn: SignedInParent, @Param('id') id: string): Promise<void> {
    await this.auth.signOut(signedIn.parentId, id);
  }
}

/** Staff: the parents (by email) who may sign in for a child. */
@Controller('students/:id/parents')
export class StudentParentsController {
  constructor(private readonly org: OrgService) {}

  private async manage(user: StaffUser, studentId: string): Promise<void> {
    requireSchool(user, await schoolOfStudent(this.org.db, studentId), true);
  }

  @Get()
  async list(@CurrentUser() user: StaffUser, @Param('id') studentId: string) {
    await this.manage(user, studentId);
    return this.org.db.studentParent.findMany({
      where: { studentId },
      orderBy: { createdAt: 'asc' },
      select: {
        relationship: true,
        parent: { select: { id: true, email: true, name: true, lastSignInAt: true } },
      },
    });
  }

  @Post()
  async add(
    @CurrentUser() user: StaffUser,
    @Param('id') studentId: string,
    @Body(new ZodBody(parentLinkInput)) body: z.infer<typeof parentLinkInput>,
  ) {
    await this.manage(user, studentId);
    const db = this.org.db;
    const parent = await db.parent.upsert({
      where: { email: body.email },
      update: {},
      create: { email: body.email },
    });
    const link = await db.studentParent.upsert({
      where: { studentId_parentId: { studentId, parentId: parent.id } },
      update: { relationship: body.relationship },
      create: { studentId, parentId: parent.id, relationship: body.relationship },
    });
    await audit(db, user.id, 'parent-link', studentId, { parentId: parent.id });
    return { ...link, parent };
  }

  /** Unlink a parent; one with no other child in a class is signed out on every device. */
  @Delete(':parentId')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: StaffUser,
    @Param('id') studentId: string,
    @Param('parentId') parentId: string,
  ): Promise<void> {
    await this.manage(user, studentId);
    const db = this.org.db;
    await db.studentParent.delete({ where: { studentId_parentId: { studentId, parentId } } });
    const stillActive = await db.studentParent.count({
      where: { parentId, student: { enrollments: { some: OPEN_ENROLLMENT } } },
    });
    if (stillActive === 0) await db.parentSession.deleteMany({ where: { parentId } });
    await audit(db, user.id, 'parent-unlink', studentId, { parentId });
  }
}
