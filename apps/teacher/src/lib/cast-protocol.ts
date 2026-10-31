import type { ListenMessage, ReleaseMedia } from '@little-ants/shared';
import type { StageFrame } from '../components/player/stage-content';
import type { InkStroke } from './ink';

/** Google Cast receiver app registered for https://teacher.littleantsenglish.com/cast-receiver (public ID). */
export const CAST_APP_ID = 'B1587FA6';

/** Custom message channel between the teacher's device and the TV. */
export const CAST_NAMESPACE = 'urn:x-cast:org.passionedu.littleants';

export type AudioCommand =
  | { type: 'audio'; action: 'load'; track: ReleaseMedia | null }
  | { type: 'audio'; action: 'play' | 'pause' }
  | { type: 'audio'; action: 'seek'; time: number };

/**
 * Drawing on the stage. `ink` is the whole page's ink (sent on every change and when the page or TV changes);
 * `ink-live` is the stroke being drawn so far, sent whole so a lost message is repaired by the next one.
 * `key` is the page's `StageFrame.surface`.
 */
export type InkMessage =
  { type: 'ink'; key: string; strokes: InkStroke[] } | { type: 'ink-live'; key: string; stroke: InkStroke };

/** Teacher → TV. */
export type SenderMessage =
  { type: 'frame'; frame: StageFrame } | { type: 'end' } | AudioCommand | InkMessage;

export interface AudioStatus {
  trackId: string | null;
  playing: boolean;
  current: number;
  duration: number;
  /** The browser refused to start the sound until someone touches the screen (laptop screens). */
  blocked?: boolean;
}

/** TV → teacher. `ready` asks the teacher for the current frame (TV started or a teacher joined). */
export type ReceiverMessage = { type: 'ready' } | ({ type: 'audio-status' } & AudioStatus);

function typeOf(value: unknown): unknown {
  return value && typeof value === 'object' ? (value as { type?: unknown }).type : undefined;
}

export function isSenderMessage(value: unknown): value is SenderMessage {
  const type = typeOf(value);
  return type === 'frame' || type === 'end' || type === 'audio' || type === 'ink' || type === 'ink-live';
}

/** A Listening Time slide from a parent's phone (laptop/TV-browser screens only, never over Cast). */
export function isListenMessage(value: unknown): value is ListenMessage {
  return typeOf(value) === 'listen';
}

export function isReceiverMessage(value: unknown): value is ReceiverMessage {
  const type = typeOf(value);
  return type === 'ready' || type === 'audio-status';
}
