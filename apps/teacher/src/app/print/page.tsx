'use client';

import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import type { ReleaseLesson, UnitReleasePayload } from '@little-ants/shared';
import { Button, buttonClass } from '@little-ants/ui/button';
import { Spinner } from '@little-ants/ui/feedback';
import { ReleaseGate } from '../../components/release-gate';
import { stageLabel } from '../../lib/format';
import { links } from '../../lib/links';
import { useLessonParams } from '../../lib/search';
import { RequireStaff } from '../../lib/session';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4 break-inside-avoid">
      <h2 className="border-b border-bark-900 pb-0.5 text-[11pt] font-extrabold uppercase tracking-wide">
        {title}
      </h2>
      <div className="mt-1.5 text-[10.5pt] leading-snug">{children}</div>
    </section>
  );
}

/** A4 lesson plan in the same shape as the Word template (lesson flow table, prep, notes lines). */
function LessonPlan({ payload, lesson }: { payload: UnitReleasePayload; lesson: ReleaseLesson }) {
  return (
    <article className="mx-auto max-w-[190mm] bg-white p-[10mm] text-black print:p-0">
      <header className="flex items-start justify-between gap-4 border-b-2 border-leaf-600 pb-2">
        <div>
          <p className="text-[9pt] font-bold uppercase tracking-wider text-ant-600">
            Little Ants English · {payload.unit.code} {payload.unit.title}
          </p>
          <h1 className="text-[18pt] font-extrabold leading-tight">Lesson {lesson.number}</h1>
          <p className="text-[10pt]">
            Week {lesson.week} · {stageLabel(lesson.stage)} · {lesson.minutes} minutes
            {lesson.newToday.length ? ` · NEW today: ${lesson.newToday.join(', ')}` : ''}
          </p>
        </div>
        <p className="text-right text-[8pt] text-bark-500">Release v{payload.version}</p>
      </header>

      <Section title="By the end of the lesson, children can…">
        <ul className="list-disc pl-5">
          {lesson.goals.map((goal) => (
            <li key={goal}>{goal}</li>
          ))}
        </ul>
      </Section>
      <Section title="Key language">
        <p className="whitespace-pre-line italic">{lesson.keyLanguage}</p>
      </Section>
      <Section title={`Prepare${lesson.prepMinutes ? ` (about ${lesson.prepMinutes} min)` : ''}`}>
        <ul className="columns-2 gap-6">
          {lesson.prep.map((item, index) => (
            <li key={index} className="break-inside-avoid">
              ☐ {item.text}
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Lesson flow">
        <table className="w-full border-collapse text-[10pt]">
          <thead>
            <tr className="bg-cream-100">
              <th className="w-[10mm] border border-bark-500 px-1 py-1 text-left">Time</th>
              <th className="border border-bark-500 px-1 py-1 text-left">What the teacher does and says</th>
              <th className="w-[45mm] border border-bark-500 px-1 py-1 text-left">Children</th>
            </tr>
          </thead>
          <tbody>
            {lesson.steps.map((step) => (
              <tr key={step.order} className="break-inside-avoid align-top">
                <td className="border border-bark-500 px-1 py-1 font-bold">{step.minutes}′</td>
                <td className="border border-bark-500 px-1 py-1">
                  <p className="font-bold">{step.title}</p>
                  <p className="whitespace-pre-line">{step.teacherText}</p>
                </td>
                <td className="border border-bark-500 px-1 py-1 whitespace-pre-line">{step.childrenText}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      <Section title="Support and challenge">
        {lesson.support ? <p>Support: {lesson.support}</p> : null}
        {lesson.challenge ? <p>Challenge: {lesson.challenge}</p> : null}
      </Section>
      <Section title="Look for (observe 5–6 children)">
        <p>{lesson.lookFor}</p>
      </Section>
      <Section title="Home link">
        <p>{lesson.homeLink}</p>
      </Section>
      <Section title="Teacher notes after the lesson">
        <div className="h-[24mm] bg-[repeating-linear-gradient(transparent,transparent_7mm,#999_7mm,#999_7.3mm)]" />
      </Section>
    </article>
  );
}

function Print() {
  const { unit, lesson } = useLessonParams();
  return (
    <ReleaseGate unit={unit}>
      {(payload) => {
        const found = payload.lessons.find((item) => item.number === lesson);
        return (
          <div className="min-h-screen bg-cream-100 py-6 print:bg-white print:py-0">
            <div className="no-print mx-auto mb-4 flex max-w-[190mm] justify-between gap-2 px-2">
              <Link href={links.unit(payload.unit.code)} className={buttonClass('ghost')}>
                ← {payload.unit.code}
              </Link>
              <Button onClick={() => window.print()}>Print</Button>
            </div>
            {found ? (
              <LessonPlan payload={payload} lesson={found} />
            ) : (
              <p className="p-8">Lesson {lesson} was not found.</p>
            )}
          </div>
        );
      }}
    </ReleaseGate>
  );
}

export default function PrintPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <RequireStaff appName="Teacher">
        <Print />
      </RequireStaff>
    </Suspense>
  );
}
