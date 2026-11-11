'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { ChildrenCard } from '../../../../components/classes/children-card';
import { ClassActions } from '../../../../components/classes/class-actions';
import { ClassStatusBadge } from '../../../../components/classes/class-status-badge';
import { TeachersCard } from '../../../../components/classes/teachers-card';
import { UnitHistoryCard } from '../../../../components/classes/unit-history-card';
import { PageHeader } from '../../../../components/page-header';
import { RunsSchoolsOnly } from '../../../../components/school-only';
import { api } from '../../../../lib/api';
import { formatDate } from '../../../../lib/hooks';
import { orgKeys } from '../../../../lib/org';
import type { ClassDetail } from '../../../../lib/types';

export default function ClassPage() {
  return (
    <RunsSchoolsOnly>
      <ClassView />
    </RunsSchoolsOnly>
  );
}

function ClassView() {
  const { id } = useParams<{ id: string }>();
  const klass = useQuery({
    queryKey: orgKeys.class(id),
    queryFn: () => api.get<ClassDetail>(`/classes/${id}`),
  });

  if (klass.isPending) return <Spinner label="Loading class" />;
  if (klass.error) return <ErrorNotice error={klass.error} />;
  const data = klass.data;
  const active = data.status === 'ACTIVE';

  return (
    <div>
      <PageHeader
        back={{ href: '/classes', label: 'All classes' }}
        actions={
          <ClassActions
            klass={data}
            schoolId={data.campus.school.id}
            childCount={data.enrollments.filter((enrollment) => !enrollment.endedOn).length}
            inHeader
          />
        }
        eyebrow={`${data.campus.school.name} · ${data.campus.name} · ${data.schoolYear}`}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {data.name} <ClassStatusBadge status={data.status} />
          </span>
        }
      >
        Level {data.level.number} · {data.level.name}
        {active && data.currentUnit
          ? ` · now teaching ${data.currentUnit.code}, lesson ${data.nextLesson}`
          : ''}
        {data.mergedInto ? (
          <>
            {' · merged into '}
            <Link
              href={`/classes/${data.mergedInto.id}`}
              className="font-semibold text-leaf-700 hover:underline"
            >
              {data.mergedInto.name}
            </Link>
          </>
        ) : null}
        {!active && data.endedAt ? ` · ended ${formatDate(data.endedAt)}` : ''}
      </PageHeader>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-6">
          <ChildrenCard klass={data} />
        </div>
        <div className="flex flex-col gap-6 self-start">
          <UnitHistoryCard klass={data} />
          <TeachersCard klass={data} />
        </div>
      </div>
    </div>
  );
}
