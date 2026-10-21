'use client';

import { useQueries } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'next/navigation';
import { ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { LessonPrint } from '../../../../../components/print/lesson-print';
import { PrintToolbar } from '../../../../../components/print/print-toolbar';
import { api } from '../../../../../lib/api';
import type { LessonDetail } from '../../../../../lib/types';

/** Several lessons (usually one week) on consecutive A4 pages: /print/units/U01/lessons?from=1&to=5 */
export default function PrintLessonsPage() {
  const { code } = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const from = Math.max(1, Number(searchParams.get('from')) || 1);
  const to = Math.min(40, Math.max(from, Number(searchParams.get('to')) || from + 4));
  const numbers = Array.from({ length: to - from + 1 }, (_, index) => from + index);
  const queries = useQueries({
    queries: numbers.map((number) => ({
      queryKey: ['lesson-by-number', code, number],
      queryFn: () => api.get<LessonDetail>(`/content/units/${code}/lessons/${number}`),
    })),
  });

  if (queries.some((query) => query.isPending)) return <Spinner label="Loading lessons" />;
  const failed = queries.find((query) => query.error);
  if (failed?.error) return <ErrorNotice error={failed.error} />;
  return (
    <>
      <PrintToolbar title={`${code} · Lessons ${from}–${to}`} back={`/units/${code}?tab=lessons`} />
      {queries.map((query) => (query.data ? <LessonPrint key={query.data.id} lesson={query.data} /> : null))}
    </>
  );
}
