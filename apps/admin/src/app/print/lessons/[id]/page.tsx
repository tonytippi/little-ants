'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { LessonPrint } from '../../../../components/print/lesson-print';
import { PrintToolbar } from '../../../../components/print/print-toolbar';
import { api } from '../../../../lib/api';
import type { LessonDetail } from '../../../../lib/types';

export default function PrintLessonPage() {
  const { id } = useParams<{ id: string }>();
  const query = useQuery({ queryKey: ['lesson', id], queryFn: () => api.get<LessonDetail>(`/content/lessons/${id}`) });
  if (query.isPending) return <Spinner label="Loading lesson" />;
  if (query.error) return <ErrorNotice error={query.error} />;
  return (
    <>
      <PrintToolbar title={`${query.data.unit.code} · Lesson ${query.data.number}`} back={`/lessons/${id}`} />
      <LessonPrint lesson={query.data} />
    </>
  );
}
