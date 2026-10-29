import { createContext, useContext } from 'react';
import type { ReleaseLesson, ReleaseMaterial, ReleaseStep } from '@little-ants/shared';
import { NOTE_SIZES } from '../../lib/note-size';

const TextSize = createContext<string>(NOTE_SIZES[0]);

function Block({ title, text }: { title: string; text: string }) {
  const size = useContext(TextSize);
  if (!text.trim()) return null;
  return (
    <section>
      <h3 className="text-xs font-bold uppercase tracking-wide text-bark-500">{title}</h3>
      <p className={`mt-1 whitespace-pre-line leading-relaxed text-bark-900 ${size}`}>{text}</p>
    </section>
  );
}

/** Teacher-only notes for the current step (never shown on the TV). */
export function NotesPanel({
  lesson,
  step,
  material,
  size = 0,
}: {
  lesson: ReleaseLesson;
  step: ReleaseStep | undefined;
  material: ReleaseMaterial | undefined;
  /** Index into NOTE_SIZES. */
  size?: number;
}) {
  return (
    <TextSize.Provider value={NOTE_SIZES[size] ?? NOTE_SIZES[0]}>
      <div className="flex flex-col gap-4">
        {step ? (
          <>
            <Block title="You do and say" text={step.teacherText} />
            <Block title="Children" text={step.childrenText} />
          </>
        ) : null}
        {material ? (
          <>
            <Block title="Words of the song / text" text={material.pages.length ? '' : material.fullText} />
            <Block title="Actions" text={material.actions} />
            <Block title="Tips" text={material.teacherNotes} />
          </>
        ) : null}
        <hr className="border-cream-200" />
        <Block title="Key language" text={lesson.keyLanguage} />
        <Block title="Support" text={lesson.support} />
        <Block title="Challenge" text={lesson.challenge} />
        <Block title="Look for" text={lesson.lookFor} />
      </div>
    </TextSize.Provider>
  );
}
