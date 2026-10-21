'use client';

import { useQuery } from '@tanstack/react-query';
import { EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/hooks';
import type { TeacherNote } from '../../lib/types';

/** Notes teachers wrote after teaching each lesson, to improve the next version of the lesson plans. */
export function TeacherNotesTab({ code }: { code: string }) {
  const query = useQuery({ queryKey: ['teacher-notes', code], queryFn: () => api.get<TeacherNote[]>(`/content/units/${code}/teacher-notes`) });
  if (query.isPending) return <Spinner label="Loading notes" />;
  if (query.error) return <ErrorNotice error={query.error} />;
  if (query.data.length === 0) return <EmptyState title="No teacher notes yet">Notes appear here after teachers teach this unit with the Teacher app.</EmptyState>;
  const lessons = [...new Set(query.data.map((note) => note.lessonNumber))];
  return (
    <div className="flex flex-col gap-4">
      {lessons.map((lesson) => (
        <section key={lesson} aria-labelledby={`notes-${lesson}`}>
          <h2 id={`notes-${lesson}`} className="mb-2 font-bold">
            Lesson {lesson}
          </h2>
          <ul className="flex flex-col gap-2">
            {query.data
              .filter((note) => note.lessonNumber === lesson)
              .map((note) => (
                <li key={note.id} className="rounded-xl bg-white p-3 text-sm ring-1 ring-cream-200">
                  <p className="whitespace-pre-wrap">{note.notes}</p>
                  <p className="mt-1 text-xs text-bark-500">
                    {note.teacher.name} · {note.class.name} · {formatDate(note.taughtAt)}
                  </p>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
