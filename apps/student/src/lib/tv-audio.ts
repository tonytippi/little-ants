/**
 * A sound player that plays on the TV: the phone's player runs as usual, but recordings play on the TV screen it
 * drives. The TV reports its position about once a second; between reports the position is estimated, so the
 * lyrics move smoothly.
 */
import type { RunnerAudio } from './player-runner';
import type { TvAudioStatus, TvMessage } from './tv-link';

/** How long to wait for the TV to say it started before carrying on as if it did. */
const START_TIMEOUT_MS = 5_000;
const TICK_MS = 250;

export class TvAudio implements RunnerAudio {
  onended: HTMLAudioElement['onended'] = null;
  onerror: HTMLAudioElement['onerror'] = null;
  ontimeupdate: HTMLAudioElement['ontimeupdate'] = null;

  private url = '';
  private status: TvAudioStatus | null = null;
  private statusAt = 0;
  private wanted = false;
  private waiting: { resolve: () => void; reject: (error: unknown) => void }[] = [];
  private readonly ticker: ReturnType<typeof setInterval>;
  private readonly unsubscribe: () => void;

  constructor(
    private readonly send: (message: TvMessage) => void,
    subscribe: (listener: (status: TvAudioStatus) => void) => () => void,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.unsubscribe = subscribe((status) => this.onStatus(status));
    this.ticker = setInterval(() => {
      if (this.status?.playing)
        this.ontimeupdate?.call(this as unknown as GlobalEventHandlers, new Event('timeupdate'));
    }, TICK_MS);
  }

  get src(): string {
    return this.url;
  }

  set src(url: string) {
    this.url = url;
    this.status = null;
    this.wanted = false;
    this.send({ type: 'audio', action: 'load', track: url ? { id: url, url } : null });
  }

  get currentTime(): number {
    const status = this.status;
    if (!status) return 0;
    if (!status.playing) return status.current;
    const estimate = status.current + (this.now() - this.statusAt) / 1000;
    return status.duration > 0 ? Math.min(status.duration, estimate) : estimate;
  }

  set currentTime(time: number) {
    this.send({ type: 'audio', action: 'seek', time });
  }

  get duration(): number {
    return this.status && this.status.duration > 0 ? this.status.duration : Number.NaN;
  }

  play(): Promise<void> {
    this.wanted = true;
    this.send({ type: 'audio', action: 'play' });
    return new Promise<void>((resolve, reject) => {
      this.waiting.push({ resolve, reject });
      setTimeout(resolve, START_TIMEOUT_MS);
    });
  }

  pause(): void {
    this.wanted = false;
    this.send({ type: 'audio', action: 'pause' });
    this.settle((waiter) => waiter.resolve());
  }

  /** The TV came back: load the recording again where it was, and play on if it was playing. */
  resync(): void {
    if (!this.url) return;
    const at = this.currentTime;
    const playing = this.wanted;
    this.send({ type: 'audio', action: 'load', track: { id: this.url, url: this.url } });
    if (at > 0) this.send({ type: 'audio', action: 'seek', time: at });
    if (playing) this.send({ type: 'audio', action: 'play' });
  }

  dispose(): void {
    clearInterval(this.ticker);
    this.unsubscribe();
    this.send({ type: 'audio', action: 'load', track: null });
  }

  private onStatus(status: TvAudioStatus): void {
    if (status.trackId !== this.url) return;
    const before = this.status;
    this.status = status;
    this.statusAt = this.now();
    if (status.blocked && this.wanted) {
      // The TV's browser wants a touch on its screen first: the player pauses and waits for Play.
      this.wanted = false;
      this.settle((waiter) => waiter.reject(new DOMException('The TV needs a tap first', 'NotAllowedError')));
      return;
    }
    if (status.playing) this.settle((waiter) => waiter.resolve());
    const finished = status.duration > 0 && status.current >= status.duration - 0.5;
    if (this.wanted && before?.playing && !status.playing && finished) {
      this.wanted = false;
      this.onended?.call(this as unknown as GlobalEventHandlers, new Event('ended'));
    }
  }

  private settle(apply: (waiter: { resolve: () => void; reject: (error: unknown) => void }) => void): void {
    const waiters = this.waiting;
    this.waiting = [];
    waiters.forEach(apply);
  }
}
