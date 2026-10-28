/**
 * Plays one item's segments in the browser: recordings through one shared <audio> element, texts through the
 * device voice (Web Speech API). Pause keeps recordings where they are and repeats the sentence being read.
 * A recording that cannot play (offline and not downloaded, or missing) is replaced by its voice fallback.
 */
import { audioFrame, firstSlide, type Segment, type Slide } from './player-plan';

export interface RunnerEvents {
  slide(slide: Slide): void;
  /** Progress through the item, 0–1. */
  progress(fraction: number): void;
  /** The runner paused by itself (the browser blocked playback until the next tap). */
  blocked(): void;
  /** Every segment played to the end. */
  end(): void;
}

type Result = 'done' | 'failed' | 'interrupted';

let chosenVoice: SpeechSynthesisVoice | null | undefined;

/** An English voice, British first (the programme's recordings are British English). */
export function englishVoice(): SpeechSynthesisVoice | null {
  if (chosenVoice) return chosenVoice;
  if (typeof speechSynthesis === 'undefined') return null;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null; // not loaded yet: try again next time
  chosenVoice =
    voices.find(
      (voice) => /en-GB/i.test(voice.lang) && /female|libby|sonia|serena|kate|martha/i.test(voice.name),
    ) ??
    voices.find((voice) => /en-GB/i.test(voice.lang)) ??
    voices.find((voice) => /^en/i.test(voice.lang)) ??
    null;
  return chosenVoice;
}

/** Load the voice list early (some browsers fill it asynchronously). */
export function warmUpVoices(): void {
  if (typeof speechSynthesis === 'undefined') return;
  speechSynthesis.getVoices();
  speechSynthesis.addEventListener?.('voiceschanged', () => {
    chosenVoice = undefined;
    englishVoice();
  });
}

const speakable = (text: string): string => text.replace(/[–—]/g, ',').replace(/…/g, '...');

export class ItemRunner {
  private token = 0;
  private index = 0;
  private paused = false;
  private segments: Segment[] = [];
  private current: Segment['type'] | null = null;
  private cancelCurrent: (() => void) | null = null;

  constructor(
    private readonly audio: HTMLAudioElement,
    private readonly events: RunnerEvents,
  ) {}

  get isPaused(): boolean {
    return this.paused;
  }

  /** Play the segments from the start (stops whatever was playing). */
  start(segments: Segment[]): void {
    this.stop();
    this.segments = [...segments];
    this.index = 0;
    this.paused = false;
    if (this.segments[0]) this.events.slide(firstSlide(this.segments[0]));
    this.events.progress(0);
    void this.loop(this.token);
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    if (this.current === 'audio') this.audio.pause();
    else if (this.current === 'speak') this.cancelCurrent?.();
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    if (this.current === 'audio') this.audio.play().catch(() => this.blockedByBrowser());
  }

  stop(): void {
    this.token += 1;
    this.cancelCurrent?.();
    this.cancelCurrent = null;
    this.current = null;
    this.audio.pause();
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }

  private blockedByBrowser(): void {
    this.paused = true;
    this.events.blocked();
  }

  private async loop(token: number): Promise<void> {
    while (this.index < this.segments.length) {
      await this.whilePaused(token);
      if (token !== this.token) return;
      const segment = this.segments[this.index]!;
      const result = await this.play(segment, token);
      if (token !== this.token) return;
      if (result === 'interrupted') continue; // paused mid-sentence: read it again after resume
      if (result === 'failed' && segment.type === 'audio')
        this.segments.splice(this.index + 1, 0, ...segment.fallback);
      this.index += 1;
      this.events.progress(this.index / this.segments.length);
    }
    this.current = null;
    if (token === this.token) this.events.end();
  }

  private play(segment: Segment, token: number): Promise<Result> {
    this.current = segment.type;
    if (segment.type === 'audio') return this.playAudio(segment, token);
    this.events.slide(segment.slide);
    if (segment.type === 'show') {
      if (segment.ms === null) return new Promise<Result>(() => undefined); // until Next (stop) is tapped
      return this.wait(segment.ms, token).then(() => 'done');
    }
    return this.speak(segment.text, segment.rate).then(async (result) => {
      if (result !== 'done' || token !== this.token) return result;
      await this.wait(segment.pauseMs, token);
      return 'done';
    });
  }

  private playAudio(segment: Extract<Segment, { type: 'audio' }>, token: number): Promise<Result> {
    const audio = this.audio;
    const base = this.index;
    return new Promise<Result>((resolve) => {
      let settled = false;
      const finish = (result: Result): void => {
        if (settled) return;
        settled = true;
        audio.onended = null;
        audio.onerror = null;
        audio.ontimeupdate = null;
        resolve(result);
      };
      audio.onended = () => finish('done');
      audio.onerror = () => finish('failed');
      audio.ontimeupdate = () => {
        if (token !== this.token || !audio.duration) return;
        const fraction = audio.currentTime / audio.duration;
        this.events.slide(audioFrame(segment, fraction));
        this.events.progress((base + fraction) / this.segments.length);
      };
      this.cancelCurrent = () => finish('interrupted');
      this.events.slide(audioFrame(segment, 0));
      audio.src = segment.media.url;
      audio.play().catch((error: unknown) => {
        if (token !== this.token) return;
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          // Autoplay blocked: wait for a tap on Play, then start this recording again.
          this.blockedByBrowser();
          finish('interrupted');
        } else if (!(error instanceof DOMException && error.name === 'AbortError')) finish('failed');
      });
    });
  }

  private speak(text: string, rate: number): Promise<Result> {
    return new Promise<Result>((resolve) => {
      let settled = false;
      let safety: ReturnType<typeof setTimeout> | undefined;
      const finish = (result: Result): void => {
        if (settled) return;
        settled = true;
        clearTimeout(safety);
        resolve(result);
      };
      this.cancelCurrent = () => {
        if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
        finish('interrupted');
      };
      if (typeof speechSynthesis === 'undefined') {
        // No device voice: leave time to read the text on screen.
        safety = setTimeout(() => finish('done'), 800 + text.length * 60);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(speakable(text));
      const voice = englishVoice();
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang ?? 'en-GB';
      utterance.rate = rate;
      utterance.pitch = 1.05;
      utterance.onend = () => finish('done');
      utterance.onerror = (event) =>
        finish(event.error === 'interrupted' || event.error === 'canceled' ? 'interrupted' : 'done');
      speechSynthesis.speak(utterance);
      // Some browsers never fire "end": carry on after a generous estimate.
      safety = setTimeout(() => finish('done'), 2500 + text.length * 120);
    });
  }

  /** Waits `ms` of playing time (paused time does not count). */
  private wait(ms: number, token: number): Promise<void> {
    return new Promise((resolve) => {
      let elapsed = 0;
      let last = Date.now();
      const tick = (): void => {
        if (token !== this.token) return resolve();
        const now = Date.now();
        if (!this.paused) elapsed += now - last;
        last = now;
        if (elapsed >= ms) resolve();
        else setTimeout(tick, 100);
      };
      tick();
    });
  }

  private whilePaused(token: number): Promise<void> {
    return new Promise((resolve) => {
      const tick = (): void => {
        if (token !== this.token || !this.paused) resolve();
        else setTimeout(tick, 150);
      };
      tick();
    });
  }
}
