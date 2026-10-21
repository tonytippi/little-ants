'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { buttonClass } from '@little-ants/ui/button';
import { ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { HistoryButton } from '../../../../components/history-panel';
import { LessonEditor } from '../../../../components/lesson/lesson-editor';
import { PageHeader } from '../../../../components/page-header';
import { StatusActions } from '../../../../components/status-actions';
import { TEACHER_APP_URL, api } from '../../../../lib/api';
import { humanize } from '../../../../lib/hooks';
import type { LessonDetail, UnitDetail } from '../../../../lib/types';

export default function LessonPage() {
  const { id } = useParams<{ id: string }>();
  const key = ['lesson', id];
  const lesson = useQuery({ queryKey: key, queryFn: () => api.get<LessonDetail>(`/content/lessons/${id}`) });
  const unitCode = lesson.data?.unit.code;
  const unit = useQuery({
    queryKey: ['unit', unitCode],
    queryFn: () => api.get<UnitDetail>(`/content/units/${unitCode}`),
    enabled: Boolean(unitCode),
  });

  if (lesson.isPending) return <Spinner label="Loading lesson" />;
  if (lesson.error) return <ErrorNotice error={lesson.error} />;
  const data = lesson.data;
  const invalidate = [key, ['unit', data.unit.code], ['units']];

  return (
    <div>
      <PageHeader
        back={{ href: `/units/${data.unit.code}?tab=lessons`, label: `${data.unit.code} ${data.unit.title}` }}
        eyebrow={`Week ${data.week} · ${humanize(data.stage)} · Level ${data.unit.level.number}`}
        title={`Lesson ${data.number}`}
        actions={
          <>
            {data.previousId ? (
              <Link href={`/lessons/${data.previousId}`} className={buttonClass('ghost', 'sm')} aria-label="Previous lesson">
                ← Lesson {data.number - 1}
              </Link>
            ) : null}
            {data.nextId ? (
              <Link href={`/lessons/${data.nextId}`} className={buttonClass('ghost', 'sm')} aria-label="Next lesson">
                Lesson {data.number + 1} →
              </Link>
            ) : null}
            <Link href={`/print/lessons/${data.id}`} className={buttonClass('secondary', 'sm')}>
              Print
            </Link>
            <a href={`${TEACHER_APP_URL}/preview/${data.unit.code}?lesson=${data.number}`} target="_blank" rel="noreferrer" className={buttonClass('secondary', 'sm')}>
              Preview
            </a>
            <HistoryButton entityType="lesson" entityId={data.id} current={data as unknown as Record<string, unknown>} invalidate={invalidate} />
          </>
        }
      />
      <div className="mb-5 flex justify-end">
        <StatusActions status={data.status} version={data.version} statusPath={`/content/lessons/${data.id}/status`} invalidate={invalidate} />
      </div>
      {unit.isPending ? <Spinner label="Loading unit materials" /> : null}
      {unit.error ? <ErrorNotice error={unit.error} /> : null}
      {unit.data ? <LessonEditor key={`${data.id}-${data.version}-${data.status}`} lesson={data} materials={unit.data.materials} /> : null}
    </div>
  );
}
