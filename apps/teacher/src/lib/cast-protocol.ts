import type { ReleaseMedia } from '@little-ants/shared';
import type { StageFrame } from '../components/player/stage-content';

/** Google Cast receiver app registered for https://la-teacher.passionedu.org/cast-receiver (public ID). */
export const CAST_APP_ID = 'B1587FA6';

/** Custom message channel between the teacher's device and the TV. */
export const CAST_NAMESPACE = 'urn:x-cast:org.passionedu.littleants';

export type AudioCommand =
  | { type: 'audio'; action: 'load'; track: ReleaseMedia | null }
  | { type: 'audio'; action: 'play' | 'pause' }
  | { type: 'audio'; action: 'seek'; time: number };

/** Teacher → TV. */
export type SenderMessage = { type: 'frame'; frame: StageFrame } | { type: 'end' } | AudioCommand;

export interface AudioStatus {
  trackId: string | null;
  playing: boolean;
  current: number;
  duration: number;
}

/** TV → teacher. `ready` asks the teacher for the current frame (TV started or a teacher joined). */
export type ReceiverMessage = { type: 'ready' } | ({ type: 'audio-status' } & AudioStatus);

function typeOf(value: unknown): unknown {
  return value && typeof value === 'object' ? (value as { type?: unknown }).type : undefined;
}

export function isSenderMessage(value: unknown): value is SenderMessage {
  const type = typeOf(value);
  return type === 'frame' || type === 'end' || type === 'audio';
}

export function isReceiverMessage(value: unknown): value is ReceiverMessage {
  const type = typeOf(value);
  return type === 'ready' || type === 'audio-status';
}
