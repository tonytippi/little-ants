import { Injectable } from '@nestjs/common';
import type { Prisma } from '@little-ants/db';
import { createHash, randomBytes } from 'node:crypto';
import { loadEnv } from '../config/env.js';
import { OPEN_ENROLLMENT } from '../org/org.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GoogleIdentityVerifier } from './google-identity.js';

/** A parent may be signed in on this many devices at once. */
export const MAX_PARENT_DEVICES = 2;
const SIGN_IN_TTL_MS = 10 * 60 * 1000;
/** A session ends after this long without use, and in any case this long after sign-in. */
const IDLE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const TOUCH_EVERY_MS = 60 * 60 * 1000;

export const PARENT_COOKIE = 'la_parent';
export const SIGN_IN_COOKIE = 'la_parent_signin';
export const CALLBACK_PATH = '/api/parent/auth/google/callback';

const hash = (value: string): string => createHash('sha256').update(value).digest('base64url');
const random = (): string => randomBytes(32).toString('base64url');

/** Why a sign-in was refused; the student app shows a message for each. */
export type SignInRefusal = 'expired' | 'not-registered' | 'other-account' | 'no-active-child' | 'google';

export class SignInRefused extends Error {
  constructor(readonly reason: SignInRefusal) {
    super(reason);
  }
}

export type SignInResult =
  | { kind: 'session'; token: string; maxAgeMs: number; redirect: string }
  | { kind: 'choose-device'; pendingToken: string; redirect: string };

/** "iPhone · Safari" from a user agent, for the device list. */
export function deviceLabel(userAgent: string | undefined): string {
  const ua = userAgent ?? '';
  const device = /iPad/.test(ua)
    ? 'iPad'
    : /iPhone/.test(ua)
      ? 'iPhone'
      : /Android/.test(ua)
        ? 'Android'
        : /Macintosh/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : 'Device';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /CriOS|Chrome\//.test(ua)
      ? 'Chrome'
      : /FxiOS|Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser';
  return `${device} · ${browser}`;
}

/**
 * Parent sign-in with Google (separate from staff accounts) and parent sessions stored in the database, so the
 * two-device limit holds and access ends at once when a child leaves.
 */
@Injectable()
export class ParentAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly google: GoogleIdentityVerifier,
  ) {}

  private get db() {
    return this.prisma.client;
  }

  /** The parent has a child who is in a class now. */
  async hasActiveChild(parentId: string): Promise<boolean> {
    const count = await this.db.studentParent.count({
      where: {
        parentId,
        student: { enrollments: { some: OPEN_ENROLLMENT } },
      },
    });
    return count > 0;
  }

  /**
   * Where to return in the student app (the app itself by default): a page on it, never another site. The URL is resolved first and its
   * origin compared, because the URL parser turns "/\evil.com" or "/\t/evil.com" into another host.
   */
  returnUrl(path: string | undefined): string {
    const home = new URL('/', loadEnv().STUDENT_APP_URL);
    try {
      const target = new URL(path || '/app', home);
      return target.origin === home.origin ? target.toString() : home.toString();
    } catch {
      return home.toString();
    }
  }

  /** Runs `work` while holding a lock on this parent, so two sign-ins at once cannot both pass the device limit. */
  private withParentLock<T>(
    parentId: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'parent:' + parentId}))`;
      return work(tx);
    });
  }

  /** Starts a Google sign-in. The correlation value goes in a short-lived cookie bound to this browser. */
  async start(returnPath?: string, loginHint?: string): Promise<{ url: string; correlation: string }> {
    const env = loadEnv();
    const state = random();
    const correlation = random();
    const nonce = random();
    // Sign-ins and sessions that ended a day ago are of no use any more.
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await this.db.parentSignIn.deleteMany({ where: { expiresAt: { lt: dayAgo } } });
    await this.db.parentSession.deleteMany({ where: { expiresAt: { lt: dayAgo } } });
    await this.db.parentSignIn.create({
      data: {
        stateHash: hash(state),
        correlationHash: hash(correlation),
        nonce,
        redirect: this.returnUrl(returnPath),
        expiresAt: new Date(Date.now() + SIGN_IN_TTL_MS),
      },
    });
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID ?? '');
    url.searchParams.set('redirect_uri', `${env.API_PUBLIC_URL}${CALLBACK_PATH}`);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('prompt', 'select_account');
    const hint = loginHint?.trim().toLowerCase();
    if (hint && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hint)) url.searchParams.set('login_hint', hint);
    return { url: url.toString(), correlation };
  }

  /**
   * Finishes a Google sign-in: checks the request, admits the parent, then signs the device in.
   * `currentToken` is this browser's existing parent session, if any: signing in again replaces it instead of
   * using up a second device.
   */
  async finish(
    state: string,
    correlation: string | undefined,
    code: string,
    userAgent: string | undefined,
    currentToken?: string,
  ): Promise<SignInResult> {
    const signIn = await this.db.parentSignIn.findUnique({ where: { stateHash: hash(state) } });
    if (
      !signIn ||
      signIn.consumedAt ||
      signIn.expiresAt < new Date() ||
      !correlation ||
      hash(correlation) !== signIn.correlationHash
    )
      throw new SignInRefused('expired');
    const used = await this.db.parentSignIn.updateMany({
      where: { id: signIn.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (used.count !== 1) throw new SignInRefused('expired');

    let identity;
    try {
      identity = await this.google.identify(
        code,
        `${loadEnv().API_PUBLIC_URL}${CALLBACK_PATH}`,
        signIn.nonce,
      );
    } catch {
      throw new SignInRefused('google');
    }
    const parent = await this.db.parent.findUnique({ where: { email: identity.email } });
    if (!parent) throw new SignInRefused('not-registered');
    if (parent.googleSub && parent.googleSub !== identity.sub) throw new SignInRefused('other-account');
    const subOwner = await this.db.parent.findUnique({
      where: { googleSub: identity.sub },
      select: { id: true },
    });
    if (subOwner && subOwner.id !== parent.id) throw new SignInRefused('other-account');
    if (!(await this.hasActiveChild(parent.id))) throw new SignInRefused('no-active-child');
    // The first sign-in binds the Google account; the condition keeps it from changing under a race.
    await this.db.parent.updateMany({
      where: { id: parent.id, OR: [{ googleSub: null }, { googleSub: identity.sub }] },
      data: {
        googleSub: identity.sub,
        lastSignInAt: new Date(),
        ...(parent.name ? {} : { name: identity.name }),
      },
    });

    const label = deviceLabel(userAgent);
    return this.withParentLock(parent.id, async (tx) => {
      if (currentToken)
        await tx.parentSession.deleteMany({ where: { tokenHash: hash(currentToken), parentId: parent.id } });
      if ((await this.liveSessions(parent.id, tx)).length >= MAX_PARENT_DEVICES) {
        const pendingToken = random();
        await tx.parentSignIn.update({
          where: { id: signIn.id },
          data: {
            parentId: parent.id,
            pendingTokenHash: hash(pendingToken),
            deviceLabel: label,
            expiresAt: new Date(Date.now() + SIGN_IN_TTL_MS),
          },
        });
        return { kind: 'choose-device' as const, pendingToken, redirect: signIn.redirect };
      }
      return {
        kind: 'session' as const,
        ...(await this.createSession(tx, parent.id, label)),
        redirect: signIn.redirect,
      };
    });
  }

  private liveSessions(parentId: string, db: Prisma.TransactionClient = this.db) {
    return db.parentSession.findMany({
      where: { parentId, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, deviceLabel: true, createdAt: true, lastSeenAt: true },
    });
  }

  private async createSession(
    tx: Prisma.TransactionClient,
    parentId: string,
    label: string,
  ): Promise<{ token: string; maxAgeMs: number }> {
    const token = random();
    await tx.parentSession.create({
      data: {
        parentId,
        tokenHash: hash(token),
        deviceLabel: label,
        expiresAt: new Date(Date.now() + IDLE_MS),
      },
    });
    return { token, maxAgeMs: MAX_AGE_MS };
  }

  private async pending(pendingToken: string) {
    const signIn = await this.db.parentSignIn.findUnique({ where: { pendingTokenHash: hash(pendingToken) } });
    if (!signIn?.parentId || signIn.expiresAt < new Date()) throw new SignInRefused('expired');
    return { ...signIn, parentId: signIn.parentId };
  }

  /** The devices a parent at the limit can choose to sign out. */
  async pendingDevices(pendingToken: string) {
    const signIn = await this.pending(pendingToken);
    return { newDevice: signIn.deviceLabel, devices: await this.liveSessions(signIn.parentId) };
  }

  /**
   * Signs one of the parent's devices out and this one in. The chosen device must be one of theirs, and the
   * pending sign-in is used up only together with the swap, so a failure leaves both devices as they were.
   */
  async replaceDevice(pendingToken: string, sessionId: string): Promise<{ token: string; maxAgeMs: number }> {
    const signIn = await this.pending(pendingToken);
    return this.withParentLock(signIn.parentId, async (tx) => {
      const chosen = (await this.liveSessions(signIn.parentId, tx)).some(
        (session) => session.id === sessionId,
      );
      if (!chosen) throw new SignInRefused('expired');
      const used = await tx.parentSignIn.updateMany({
        where: { id: signIn.id, pendingTokenHash: hash(pendingToken) },
        data: { pendingTokenHash: null },
      });
      if (used.count !== 1) throw new SignInRefused('expired');
      await tx.parentSession.delete({ where: { id: sessionId } });
      if ((await this.liveSessions(signIn.parentId, tx)).length >= MAX_PARENT_DEVICES)
        throw new SignInRefused('expired');
      return this.createSession(tx, signIn.parentId, signIn.deviceLabel);
    });
  }

  /**
   * The signed-in parent for a session cookie, or null. A parent with no child in a class any more is signed
   * out everywhere. Use keeps the session alive (checked at most hourly), up to its maximum age.
   */
  async resolve(token: string | undefined): Promise<{ parentId: string; sessionId: string } | null> {
    if (!token) return null;
    const session = await this.db.parentSession.findUnique({ where: { tokenHash: hash(token) } });
    if (!session || session.expiresAt < new Date()) return null;
    if (!(await this.hasActiveChild(session.parentId))) {
      await this.db.parentSession.deleteMany({ where: { parentId: session.parentId } });
      return null;
    }
    const now = Date.now();
    if (now - session.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
      const expiresAt = new Date(Math.min(now + IDLE_MS, session.createdAt.getTime() + MAX_AGE_MS));
      await this.db.parentSession.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(), expiresAt },
      });
    }
    return { parentId: session.parentId, sessionId: session.id };
  }

  devices(parentId: string) {
    return this.liveSessions(parentId);
  }

  async signOut(parentId: string, sessionId: string): Promise<void> {
    await this.db.parentSession.deleteMany({ where: { id: sessionId, parentId } });
  }
}
