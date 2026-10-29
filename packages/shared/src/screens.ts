/**
 * Laptop screens driven by a teacher's tablet through the API: a laptop plugged into the classroom TV opens a
 * screen (no sign-in) and shows a pairing code; the signed-in teacher claims it and then relays the same messages
 * as with Google Cast. The API forwards them without reading them.
 */

/** Pairing code letters, without look-alikes (0/O, 1/I/L). */
export const SCREEN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const SCREEN_CODE_LENGTH = 6;

/** Message types the teacher may send to a screen, and the screen to the teacher. */
export const TEACHER_TO_SCREEN_TYPES = ['frame', 'end', 'audio'] as const;
export const SCREEN_TO_TEACHER_TYPES = ['ready', 'audio-status'] as const;

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
  | { type: 'paired'; teacherName: string }
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

/** The pairing code in a scanned QR code (`…/screen/pair?code=XXXXXX`) or in typed text; null otherwise. */
export function screenCodeFromScan(text: string): string | null {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return normalizeScreenCode(text);
  }
  return url.pathname.startsWith('/screen/pair') ? normalizeScreenCode(url.searchParams.get('code') ?? '') : null;
}
