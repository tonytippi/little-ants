'use client';

import Link from 'next/link';
import { buttonClass } from '@little-ants/ui/button';
import { humanize } from '../../lib/hooks';
import type { ContentStatus, UnitDetail } from '../../lib/types';

const STATUS_STYLE: Record<ContentStatus, string> = {
  DRAFT: 'bg-white ring-cream-200',
  REVIEW: 'bg-sun-100 ring-sun-400/50',
  APPROVED: 'bg-leaf-50 ring-leaf-100',
  ARCHIVED: 'bg-cream-100 ring-cream-200 opacity-60',
};

/** 40-lesson grid grouped by week (replaces Master Sheet tab 6). */
export function LessonsTab({ unit }: { unit: UnitDetail }) {
  const weeks = [...new Set(unit.lessons.map((lesson) => lesson.week))].sort((a, b) => a - b);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4 text-xs text-bark-500">
        {(Object.keys(STATUS_STYLE) as ContentStatus[]).map((status) => (
          <span key={status} className="flex items-center gap-1">
            <span className={`inline-block size-3 rounded ring-1 ${STATUS_STYLE[status]}`} aria-hidden />
            {humanize(status)}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {weeks.map((week) => {
          const lessons = unit.lessons.filter((lesson) => lesson.week === week);
          const first = lessons[0]?.number ?? 1;
          const last = lessons[lessons.length - 1]?.number ?? first;
          return (
            <section key={week} aria-labelledby={`week-${week}`} className="rounded-xl bg-white p-3 ring-1 ring-cream-200">
              <div className="mb-2 flex items-center justify-between">
                <h2 id={`week-${week}`} className="text-sm font-bold">
                  Week {week}
                </h2>
                <Link href={`/print/units/${unit.code}/lessons?from=${first}&to=${last}`} className={buttonClass('ghost', 'sm')}>
                  Print week
                </Link>
              </div>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {lessons.map((lesson) => (
                  <li key={lesson.id}>
                    <Link href={`/lessons/${lesson.id}`} className={`flex h-full flex-col rounded-lg px-3 py-2 ring-1 hover:ring-leaf-500 ${STATUS_STYLE[lesson.status]}`}>
                      <span className="text-sm font-bold">Lesson {lesson.number}</span>
                      <span className="text-xs text-bark-500">
                        {humanize(lesson.stage)} · {lesson.minutes} min
                      </span>
                      {lesson.newToday.length ? <span className="mt-1 text-xs font-semibold text-ant-600">NEW: {lesson.newToday.join(', ')}</span> : null}
                      <span className="sr-only">Status {humanize(lesson.status)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
