/** Shapes returned by the API endpoints the student app calls. */

import type { ReleaseMedia } from '@little-ants/shared';

export interface ParentUnit {
  code: string;
  number: number;
  title: string;
  /** The class is on this unit now. */
  current: boolean;
  picture: ReleaseMedia | null;
}

export interface ParentChild {
  id: string;
  displayName: string;
  className: string | null;
  level: number | null;
  nextLesson: number | null;
  units: ParentUnit[];
}

/** GET /parent/me */
export interface ParentMe {
  parent: { name: string | null; email: string };
  children: ParentChild[];
  /** Set by the app when the server could not be reached and the last known answer is shown. */
  offline?: boolean;
}

export interface ParentDevice {
  id: string;
  deviceLabel: string | null;
  createdAt: string;
  lastSeenAt: string;
  current?: boolean;
}

/** GET /parent/auth/pending/:token */
export interface PendingDevices {
  newDevice: string | null;
  devices: ParentDevice[];
}

/** GET /me (staff). Only the parts At school uses. */
export interface StaffMe {
  user: { id: string; name: string; email: string };
}

/** GET /teach/classes. Only the parts At school uses. */
export interface SchoolClass {
  id: string;
  name: string;
  nextLesson: number;
  campus: { name: string };
  level: { number: number; name: string };
  currentUnit: {
    code: string;
    title: string;
    release: { version: number; publishedAt: string } | null;
    picture: ReleaseMedia | null;
  } | null;
}

/** Where the app is used: a child at home (parent account) or a class at school (staff account). */
export type Mode = 'home' | 'school';
