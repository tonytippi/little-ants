/** Shapes returned by the /api/teach endpoints. */

import type { ReleaseMedia } from '@little-ants/shared';

export interface TeachClass {
  id: string;
  name: string;
  schoolYear: string;
  nextLesson: number;
  lessonDays: number[];
  campus: { name: string };
  level: { number: number; name: string };
  currentUnit: {
    code: string;
    title: string;
    release: { version: number; publishedAt: string } | null;
    /** The unit cover, else its lead character's art (from the latest release). */
    picture: ReleaseMedia | null;
  } | null;
  students: { id: string; displayName: string }[];
}

export interface PublishedUnit {
  code: string;
  number: number;
  title: string;
  level: { number: number; name: string };
  release: { version: number; publishedAt: string };
  /** The unit cover, else its lead character's art. */
  picture: ReleaseMedia | null;
}

export type ObservationLevel = 'NOT_YET' | 'WITH_HELP' | 'ON_MY_OWN';

export interface ServerObservation {
  studentId: string;
  goalOrder: number;
  level: ObservationLevel;
  observedAt: string;
  lessonNumber: number | null;
}

export interface LessonRunRecord {
  clientId: string;
  classId: string;
  unitCode: string;
  lessonNumber: number;
  releaseVersion: number;
  taughtAt: string;
  notes: string;
}

export interface ObservationRecord {
  clientId: string;
  studentId: string;
  classId: string;
  unitCode: string;
  goalOrder: number;
  level: ObservationLevel;
  lessonNumber: number | null;
  observedAt: string;
}
