import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Observable, Subject, interval, map, type Subscriber } from 'rxjs';
import {
  SCREEN_CODE_ALPHABET,
  SCREEN_CODE_LENGTH,
  type NewScreen,
  type ScreenControllerKind,
  type ScreenDisplayEvent,
  type ScreenTeacherEvent,
} from '@little-ants/shared';

/** One event on a server-sent stream (Nest writes `data` as JSON). */
export interface StreamEvent {
  data: object;
}

/** A relayed message: the API only checks its type and size (see the controller). */
export type RelayedMessage = { type: string } & Record<string, unknown>;

/** Who drives a screen: a teacher in class, or a parent at home. */
export interface ScreenController {
  kind: ScreenControllerKind;
  id: string;
  name: string;
}

interface Screen {
  id: string;
  displayToken: Buffer;
  code: string | null;
  codeExpiresAt: number;
  owner: ScreenController | null;
  toDisplay: Subject<object>;
  toTeacher: Subject<object>;
  displayConnections: number;
  /** When the laptop's last stream closed (or the screen was created, before it connects). */
  displayLeftAt: number | null;
  lastActivity: number;
}

const CODE_TTL_MS = 15 * 60_000;
const DISPLAY_GONE_MS = 2 * 60_000;
const IDLE_MS = 12 * 60 * 60_000;
const SWEEP_MS = 30_000;
const HEARTBEAT_MS = 20_000;
export const MAX_SCREENS = 1_000;

/**
 * Laptop and TV-browser screens and the teacher or parent driving them, kept in memory (one API instance). A deploy drops them; the laptop then opens
 * a new screen and shows a new code.
 */
@Injectable()
export class ScreensService implements OnModuleDestroy {
  private readonly screens = new Map<string, Screen>();
  private readonly byCode = new Map<string, string>();
  private readonly sweeper = setInterval(() => this.sweep(), SWEEP_MS);

  constructor() {
    this.sweeper.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.sweeper);
  }

  create(): NewScreen {
    this.sweep();
    if (this.screens.size >= MAX_SCREENS) {
      throw new HttpException('Too many open screens, try again later', HttpStatus.TOO_MANY_REQUESTS);
    }
    const token = randomBytes(32);
    const screen: Screen = {
      id: randomBytes(16).toString('base64url'),
      displayToken: token,
      code: null,
      codeExpiresAt: 0,
      owner: null,
      toDisplay: new Subject(),
      toTeacher: new Subject(),
      displayConnections: 0,
      displayLeftAt: Date.now(),
      lastActivity: Date.now(),
    };
    this.screens.set(screen.id, screen);
    this.newCode(screen);
    return {
      screenId: screen.id,
      displayToken: token.toString('base64url'),
      code: screen.code!,
      codeExpiresAt: new Date(screen.codeExpiresAt).toISOString(),
    };
  }

  /** The laptop's stream: the current pairing state first, then everything sent to the screen. */
  displayStream(screenId: string, token: string): Observable<StreamEvent> {
    const screen = this.display(screenId, token);
    return new Observable<StreamEvent>((subscriber) => {
      const first: ScreenDisplayEvent = screen.owner
        ? { type: 'paired', kind: screen.owner.kind, name: screen.owner.name }
        : { type: 'code', code: screen.code!, codeExpiresAt: new Date(screen.codeExpiresAt).toISOString() };
      subscriber.next({ data: first });
      screen.displayConnections += 1;
      screen.displayLeftAt = null;
      if (screen.displayConnections === 1)
        screen.toTeacher.next({ type: 'screen-online' } satisfies ScreenTeacherEvent);
      const stop = relay(screen.toDisplay, subscriber);
      return () => {
        stop();
        screen.displayConnections -= 1;
        if (screen.displayConnections === 0) {
          screen.displayLeftAt = Date.now();
          screen.toTeacher.next({ type: 'screen-offline' } satisfies ScreenTeacherEvent);
        }
      };
    });
  }

  /** The controller's stream: whether the laptop is connected, then everything the laptop sends. */
  teacherStream(user: ScreenController, screenId: string): Observable<StreamEvent> {
    const screen = this.owned(user, screenId);
    return new Observable<StreamEvent>((subscriber) => {
      const online: ScreenTeacherEvent = {
        type: screen.displayConnections > 0 ? 'screen-online' : 'screen-offline',
      };
      subscriber.next({ data: online });
      return relay(screen.toTeacher, subscriber);
    });
  }

  pair(user: ScreenController, code: string): { screenId: string } {
    const screenId = this.byCode.get(code);
    const screen = screenId ? this.screens.get(screenId) : undefined;
    if (!screen || screen.code !== code || screen.codeExpiresAt < Date.now()) {
      throw new NotFoundException('This code is not valid any more. Use the code on the screen now.');
    }
    this.byCode.delete(code);
    screen.code = null;
    screen.owner = { kind: user.kind, id: user.id, name: user.name };
    screen.lastActivity = Date.now();
    screen.toDisplay.next({ type: 'paired', kind: user.kind, name: user.name } satisfies ScreenDisplayEvent);
    return { screenId: screen.id };
  }

  /** Disconnects the teacher or parent; the laptop shows a new code. */
  unpair(user: ScreenController, screenId: string): void {
    const screen = this.owned(user, screenId);
    screen.owner = null;
    screen.toTeacher.complete();
    screen.toTeacher = new Subject();
    this.newCode(screen);
  }

  toDisplay(user: ScreenController, screenId: string, message: RelayedMessage): void {
    const screen = this.owned(user, screenId);
    screen.lastActivity = Date.now();
    screen.toDisplay.next(message);
  }

  toTeacher(screenId: string, token: string, message: RelayedMessage): void {
    const screen = this.display(screenId, token);
    screen.lastActivity = Date.now();
    screen.toTeacher.next(message);
  }

  /** Removes screens whose laptop left, idle screens, and renews expired codes. */
  sweep(now = Date.now()): void {
    for (const screen of this.screens.values()) {
      const gone =
        screen.displayConnections === 0 &&
        screen.displayLeftAt !== null &&
        now - screen.displayLeftAt > DISPLAY_GONE_MS;
      if (gone || now - screen.lastActivity > IDLE_MS) {
        this.remove(screen);
      } else if (!screen.owner && screen.codeExpiresAt < now) {
        this.newCode(screen);
      }
    }
  }

  private remove(screen: Screen): void {
    if (screen.code) this.byCode.delete(screen.code);
    this.screens.delete(screen.id);
    screen.toDisplay.complete();
    screen.toTeacher.complete();
  }

  private newCode(screen: Screen): void {
    if (screen.code) this.byCode.delete(screen.code);
    let code: string;
    do {
      code = Array.from(
        { length: SCREEN_CODE_LENGTH },
        () => SCREEN_CODE_ALPHABET[randomInt(SCREEN_CODE_ALPHABET.length)],
      ).join('');
    } while (this.byCode.has(code));
    screen.code = code;
    screen.codeExpiresAt = Date.now() + CODE_TTL_MS;
    this.byCode.set(code, screen.id);
    screen.toDisplay.next({
      type: 'code',
      code,
      codeExpiresAt: new Date(screen.codeExpiresAt).toISOString(),
    } satisfies ScreenDisplayEvent);
  }

  private display(screenId: string, token: string): Screen {
    const screen = this.screens.get(screenId);
    if (!screen) throw new NotFoundException('This screen has closed');
    const given = Buffer.from(token, 'base64url');
    if (given.length !== screen.displayToken.length || !timingSafeEqual(given, screen.displayToken)) {
      throw new UnauthorizedException('Wrong screen token');
    }
    return screen;
  }

  private owned(user: ScreenController, screenId: string): Screen {
    const screen = this.screens.get(screenId);
    if (!screen) throw new NotFoundException('This screen has closed');
    if (screen.owner?.kind !== user.kind || screen.owner?.id !== user.id)
      throw new ForbiddenException('This screen is connected to someone else');
    return screen;
  }
}

/** Forwards a screen's messages to one stream until the screen closes, with a heartbeat in between. */
function relay(source: Subject<object>, subscriber: Subscriber<StreamEvent>): () => void {
  const messages = source.subscribe({
    next: (data) => subscriber.next({ data }),
    complete: () => subscriber.complete(),
  });
  // Keeps proxies (Cloudflare closes idle connections after ~100 s) from dropping the stream.
  const beats = interval(HEARTBEAT_MS)
    .pipe(map(() => ({ type: 'ping' })))
    .subscribe((data) => subscriber.next({ data }));
  return () => {
    messages.unsubscribe();
    beats.unsubscribe();
  };
}
