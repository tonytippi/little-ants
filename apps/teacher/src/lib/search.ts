'use client';

import { useSearchParams } from 'next/navigation';

/** Lesson coordinates from the query string (?unit=U01&lesson=12&class=...). */
export function useLessonParams(): { unit: string | null; lesson: number; classId: string | null } {
  const params = useSearchParams();
  const unit = params.get('unit')?.toUpperCase() ?? null;
  const lesson = Number(params.get('lesson') ?? '1');
  return { unit, lesson: Number.isInteger(lesson) && lesson >= 1 ? lesson : 1, classId: params.get('class') };
}
