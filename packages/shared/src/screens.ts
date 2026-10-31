import type { ReleaseMedia } from './release.js';

/**
 * Screens driven through the API: a TV browser or a laptop plugged into the TV opens a screen (no sign-in) and
 * shows a pairing code. A signed-in teacher claims it and relays the same messages as with Google Cast; at home a
 * signed-in parent claims it and plays Listening Time on it. The API forwards messages without reading them.
 */

/** Pairing code letters, without look-alikes (0/O, 1/I/L). */
export const SCREEN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const SCREEN_CODE_LENGTH = 6;

/** Message types the teacher may send to a screen, and the screen to the teacher (or parent). */
export const TEACHER_TO_SCREEN_TYPES = ['frame', 'end', 'audio', 'ink', 'ink-live'] as const;
export const SCREEN_TO_TEACHER_TYPES = ['ready', 'audio-status'] as const;
/** At home a parent's phone shows Listening Time slides and plays their recordings on the TV. */
export const PARENT_TO_SCREEN_TYPES = ['listen', 'end', 'audio'] as const;

export type ScreenControllerKind = 'staff' | 'parent';

/** One Listening Time slide on the TV, built by the parent's phone from what its player shows. */
export interface ListenFrame {
  /** The item's colour (CSS colour). */
  colour: string;
  kindLabel: string;
  title: string;
  act: string;
  cue: string;
  picture: ReleaseMedia | null;
  /** Fill the picture box (talk scenes) instead of showing the whole picture. */
  cover: boolean;
  /** Big letter or word, and the small text beside it (sounds, word cards). */
  big?: string;
  small?: string;
  lines: string[];
  /** Index in `lines` of the line being heard, or -1. */
  current: number;
}

export type ListenMessage = { type: 'listen'; frame: ListenFrame };

/** Largest relayed message, in characters of JSON. */
export const SCREEN_MESSAGE_LIMIT = 64_000;

export interface NewScreen {
  screenId: string;
  /** Secret that only the laptop knows; it authorises the laptop's side of the screen. */
  displayToken: string;
  code: string;
  codeExpiresAt: string;
}

export interface PairedScreen {
  screenId: string;
}

/** Events the API adds to the laptop's stream, besides the teacher's relayed messages. */
export type ScreenDisplayEvent =
  | { type: 'paired'; kind: ScreenControllerKind; name: string }
  | { type: 'code'; code: string; codeExpiresAt: string }
  | { type: 'ping' };

/** Events the API adds to the teacher's stream, besides the laptop's relayed messages. */
export type ScreenTeacherEvent = { type: 'screen-online' } | { type: 'screen-offline' } | { type: 'ping' };

/** A pairing code as typed or scanned: upper case, spaces and dashes removed; null when it cannot be one. */
export function normalizeScreenCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== SCREEN_CODE_LENGTH) return null;
  return [...code].every((char) => SCREEN_CODE_ALPHABET.includes(char)) ? code : null;
}

/** The pairing code in a scanned QR code (`…/tv/pair?code=XXXXXX`, or the older `…/screen/pair?code=…`) or in
 * typed text; null otherwise. */
export function screenCodeFromScan(text: string): string | null {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return normalizeScreenCode(text);
  }
  return url.pathname.startsWith('/tv/pair') || url.pathname.startsWith('/screen/pair')
    ? normalizeScreenCode(url.searchParams.get('code') ?? '')
    : null;
}

/** What a screen's QR code opens: the Student app's pairing page, which sends teachers on to the Teacher app. */
export function screenPairUrl(studentAppUrl: string, code: string): string {
  const url = new URL('/tv/pair', studentAppUrl);
  url.searchParams.set('code', code);
  return url.toString();
}
