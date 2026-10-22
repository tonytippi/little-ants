import { humanize } from '../../lib/hooks';
import type { LessonDetail } from '../../lib/types';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 break-inside-avoid">
      <h2 className="mb-1 text-[9pt] font-extrabold uppercase tracking-wider text-leaf-700">{title}</h2>
      {children}
    </section>
  );
}

/** A4 lesson plan in the same shape as the Word template. */
export function LessonPrint({ lesson }: { lesson: LessonDetail }) {
  return (
    <article className="mx-auto max-w-[190mm] px-6 py-8 print:break-after-page print:px-0 print:py-0">
      <header className="border-b-2 border-leaf-600 pb-2">
        <p className="text-[9pt] font-bold uppercase tracking-wider text-ant-500">
          {lesson.unit.code} · {lesson.unit.title} · Level {lesson.unit.level.number} {lesson.unit.level.name}
        </p>
        <h1 className="text-2xl font-extrabold">Lesson {lesson.number}</h1>
        <p className="text-[10pt]">
          Week {lesson.week} · {humanize(lesson.stage)} · {lesson.minutes} minutes
          {lesson.newToday.length ? ` · NEW today: ${lesson.newToday.join(', ')}` : ''}
        </p>
      </header>

      {lesson.goals.length ? (
        <Section title="By the end of the lesson, children can…">
          <ul className="list-disc pl-5">
            {lesson.goals.map((goal) => (
              <li key={goal}>{goal}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      {lesson.keyLanguage ? (
        <Section title="Key language">
          <p className="whitespace-pre-wrap italic">{lesson.keyLanguage}</p>
        </Section>
      ) : null}
      {lesson.prepItems.length ? (
        <Section title={`Prepare${lesson.prepMinutes ? ` (about ${lesson.prepMinutes} minutes)` : ''}`}>
          <ul className="columns-2 list-disc gap-6 pl-5">
            {lesson.prepItems.map((item) => (
              <li key={item.id}>{item.text}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Lesson flow">
        <table className="w-full border-collapse text-[10pt]">
          <thead>
            <tr className="bg-leaf-50 text-left">
              <th className="w-12 border border-cream-200 px-2 py-1">Time</th>
              <th className="border border-cream-200 px-2 py-1">What the teacher does and says</th>
              <th className="w-1/4 border border-cream-200 px-2 py-1">Children</th>
            </tr>
          </thead>
          <tbody>
            {lesson.steps.map((step) => (
              <tr key={step.id} className="break-inside-avoid align-top">
                <td className="border border-cream-200 px-2 py-1 font-bold">{step.minutes}&apos;</td>
                <td className="border border-cream-200 px-2 py-1">
                  <p className="font-bold">{step.title}</p>
                  <p className="whitespace-pre-wrap">{step.teacherText}</p>
                </td>
                <td className="whitespace-pre-wrap border border-cream-200 px-2 py-1">{step.childrenText}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {lesson.support || lesson.challenge ? (
        <Section title="Support and challenge">
          {lesson.support ? (
            <p>
              <strong>Support:</strong> {lesson.support}
            </p>
          ) : null}
          {lesson.challenge ? (
            <p>
              <strong>Challenge:</strong> {lesson.challenge}
            </p>
          ) : null}
        </Section>
      ) : null}
      {lesson.lookFor ? (
        <Section title="Look for (observe 5–6 children)">
          <p className="whitespace-pre-wrap">{lesson.lookFor}</p>
        </Section>
      ) : null}
      {lesson.homeLink ? (
        <Section title="Home link">
          <p className="whitespace-pre-wrap">{lesson.homeLink}</p>
        </Section>
      ) : null}
      <Section title="Teacher notes after the lesson">
        <div className="h-16 border-b border-dotted border-bark-500" />
        <div className="h-8 border-b border-dotted border-bark-500" />
      </Section>
    </article>
  );
}
