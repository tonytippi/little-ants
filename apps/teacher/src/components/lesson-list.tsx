import Link from 'next/link';
import type { UnitReleasePayload } from '@little-ants/shared';
import { Badge } from '@little-ants/ui/badge';
import { buttonClass } from '@little-ants/ui/button';
import { stageLabel } from '../lib/format';

export interface LessonLinks {
  teach: (lesson: number) => string;
  prepare?: (lesson: number) => string;
  print?: (lesson: number) => string;
}

/** The 40 lessons of a unit, grouped by week, with actions per lesson. */
export function LessonList({
  payload,
  actions,
  highlight,
}: {
  payload: UnitReleasePayload;
  actions: LessonLinks;
  highlight?: number;
}) {
  const weeks = new Map<number, UnitReleasePayload['lessons']>();
  for (const lesson of payload.lessons) weeks.set(lesson.week, [...(weeks.get(lesson.week) ?? []), lesson]);
  return (
    <div className="flex flex-col gap-6">
      {[...weeks.entries()].map(([week, lessons]) => (
        <section key={week} aria-label={`Week ${week}`}>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-bark-500">Week {week}</h2>
          <ul className="divide-y divide-cream-200 rounded-[var(--radius-card)] border border-cream-200 bg-white">
            {lessons.map((lesson) => (
              <li
                key={lesson.number}
                className={`flex flex-wrap items-center gap-3 px-4 py-3 ${lesson.number === highlight ? 'bg-leaf-50' : ''}`}
                aria-current={lesson.number === highlight ? 'step' : undefined}
              >
                <div className="min-w-56 flex-1">
                  <p className="font-bold text-bark-900">
                    Lesson {lesson.number}
                    <span className="ml-2 text-sm font-normal text-bark-500">
                      {stageLabel(lesson.stage)} · {lesson.minutes} min
                    </span>
                  </p>
                  {lesson.newToday.length ? (
                    <p className="mt-1 flex flex-wrap gap-1">
                      {lesson.newToday.map((code) => (
                        <Badge key={code} tone="ant">
                          NEW {code}
                        </Badge>
                      ))}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {actions.prepare ? (
                    <Link href={actions.prepare(lesson.number)} className={buttonClass('secondary', 'md')}>
                      Prepare
                    </Link>
                  ) : null}
                  {actions.print ? (
                    <Link href={actions.print(lesson.number)} className={buttonClass('ghost', 'md')}>
                      Print
                    </Link>
                  ) : null}
                  <Link href={actions.teach(lesson.number)} className={buttonClass('primary', 'md')}>
                    ▶ Teach
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
