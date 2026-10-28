'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { ChildrenCard } from '../../../../components/classes/children-card';
import { ClassActionsCard } from '../../../../components/classes/class-actions-card';
import { ClassForm, type ClassEditValues } from '../../../../components/classes/class-form';
import { ClassStatusBadge } from '../../../../components/classes/class-status-badge';
import { TeachersCard } from '../../../../components/classes/teachers-card';
import { UnitHistoryCard } from '../../../../components/classes/unit-history-card';
import { PageHeader } from '../../../../components/page-header';
import { RunsSchoolsOnly } from '../../../../components/school-only';
import { api } from '../../../../lib/api';
import { formatDate, useApiMutation } from '../../../../lib/hooks';
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
  const update = useApiMutation(
    (values: ClassEditValues) => api.patch(`/classes/${id}`, values),
    [orgKeys.class(id), orgKeys.allClasses],
  );

  if (klass.isPending) return <Spinner label="Loading class" />;
  if (klass.error) return <ErrorNotice error={klass.error} />;
  const data = klass.data;
  const active = data.status === 'ACTIVE';

  return (
    <div>
      <PageHeader
        back={{ href: '/classes', label: 'All classes' }}
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
          {active ? (
            <Card>
              <h2 className="mb-4 font-bold">Class details</h2>
              <ClassForm
                key={`${data.id}-${data.nextLesson}-${data.currentUnitId}`}
                mode="edit"
                initial={data}
                submitLabel="Save class"
                busy={update.isPending}
                error={update.error}
                onSubmit={(values) => update.mutate(values)}
              />
              {update.isSuccess ? (
                <p role="status" className="mt-2 text-sm text-leaf-700">
                  Saved.
                </p>
              ) : null}
            </Card>
          ) : null}
          <ChildrenCard klass={data} />
        </div>
        <div className="flex flex-col gap-6 self-start">
          <UnitHistoryCard klass={data} />
          <TeachersCard klass={data} />
          {active ? <ClassActionsCard klass={data} /> : null}
        </div>
      </div>
    </div>
  );
}
