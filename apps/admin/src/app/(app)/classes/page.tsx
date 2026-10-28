'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@little-ants/ui/button';
import { EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { ClassForm, type ClassCreateValues } from '../../../components/classes/class-form';
import { ClassStatusBadge } from '../../../components/classes/class-status-badge';
import { DataTable, type Column } from '../../../components/data-table';
import { Dialog } from '../../../components/dialog';
import { PageHeader } from '../../../components/page-header';
import { SchoolPage } from '../../../components/school-only';
import { api } from '../../../lib/api';
import { useApiMutation } from '../../../lib/hooks';
import { orgKeys, useCampuses, useLevels, useSchoolClasses } from '../../../lib/org';
import type { ClassSummary, School } from '../../../lib/types';

type Filter = 'ACTIVE' | 'ENDED' | 'ALL';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ENDED', label: 'Ended' },
  { value: 'ALL', label: 'All' },
];

export default function ClassesPage() {
  return <SchoolPage>{(school) => <Classes key={school.id} school={school} />}</SchoolPage>;
}

function Classes({ school }: { school: School }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<Filter>('ACTIVE');
  const campuses = useCampuses(school.id);
  const levels = useLevels();
  // Ended classes come from the full list; the API filters one status at a time.
  const classes = useSchoolClasses(school.id, filter === 'ACTIVE' ? 'ACTIVE' : 'all');
  const create = useApiMutation(
    (values: ClassCreateValues) => api.post<{ id: string }>(`/schools/${school.id}/classes`, values),
    [orgKeys.allClasses],
  );

  if (campuses.isPending || levels.isPending) return <Spinner label="Loading classes" />;
  const error = campuses.error ?? levels.error;
  if (error) return <ErrorNotice error={error} />;
  const hasCampus = campuses.data!.length > 0;
  const shown = classes.data?.filter((item) => filter !== 'ENDED' || item.status !== 'ACTIVE');

  return (
    <div>
      <PageHeader
        eyebrow={school.name}
        title="Classes"
        actions={hasCampus ? <Button onClick={() => setCreating(true)}>+ New class</Button> : null}
      >
        Classes, their teachers and children. Children&apos;s records hold a display name and birth year only.
      </PageHeader>

      <Dialog open={creating} onClose={() => setCreating(false)} title="New class" wide>
        <ClassForm
          mode="create"
          campuses={campuses.data!.filter((campus) => campus.active)}
          levels={levels.data!}
          submitLabel="Create class"
          busy={create.isPending}
          error={create.error}
          onSubmit={(values) =>
            create.mutate(values, { onSuccess: (created) => router.push(`/classes/${created.id}`) })
          }
        />
      </Dialog>

      {hasCampus ? null : (
        <EmptyState title="Add a campus first">
          Every class belongs to a campus. Add one on the{' '}
          <Link href="/campuses" className="font-semibold text-leaf-700 hover:underline">
            Campuses
          </Link>{' '}
          page.
        </EmptyState>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-1" role="group" aria-label="Show classes">
        {FILTERS.map((item) => (
          <Button
            key={item.value}
            size="sm"
            variant={filter === item.value ? 'primary' : 'ghost'}
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {classes.isPending ? <Spinner label="Loading classes" /> : null}
      {classes.error ? <ErrorNotice error={classes.error} /> : null}
      {shown && hasCampus ? (
        <DataTable
          label="Classes"
          columns={COLUMNS}
          rows={shown}
          rowKey={(item) => item.id}
          muted={(item) => item.status !== 'ACTIVE'}
          minWidth="48rem"
          empty={filter === 'ENDED' ? 'No ended classes' : 'No classes yet'}
        />
      ) : null}
    </div>
  );
}

const COLUMNS: Column<ClassSummary>[] = [
  {
    header: 'Class',
    cell: (item) => (
      <>
        <Link href={`/classes/${item.id}`} className="font-semibold text-leaf-700 hover:underline">
          {item.name}
        </Link>
        <span className="flex items-center gap-1 text-xs text-bark-500">
          {item.schoolYear}
          {item.status === 'ACTIVE' ? null : <ClassStatusBadge status={item.status} />}
        </span>
      </>
    ),
  },
  { header: 'Campus', cell: (item) => item.campus.name },
  { header: 'Level', cell: (item) => `${item.level.number} · ${item.level.name}` },
  {
    header: 'Now teaching',
    cell: (item) =>
      item.status === 'ACTIVE' && item.currentUnit
        ? `${item.currentUnit.code} · lesson ${item.nextLesson}`
        : '—',
  },
  {
    header: 'Teachers',
    cell: (item) => (
      <span className="text-bark-500">
        {item.teachers.map((teacher) => teacher.user.name).join(', ') || '—'}
      </span>
    ),
  },
  { header: 'Children', cell: (item) => item._count.enrollments },
];
