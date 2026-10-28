'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@little-ants/ui/button';
import { Card, EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { CampusesCard } from '../../../components/classes/campuses-card';
import { ClassForm, type ClassCreateValues } from '../../../components/classes/class-form';
import { ClassStatusBadge } from '../../../components/classes/class-status-badge';
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
        actions={
          hasCampus ? (
            <Button
              onClick={() => setCreating((value) => !value)}
              variant={creating ? 'secondary' : 'primary'}
            >
              {creating ? 'Close' : '+ New class'}
            </Button>
          ) : null
        }
      >
        Classes, their teachers and children. Children&apos;s records hold a display name and birth year only.
      </PageHeader>

      {creating ? (
        <Card className="mb-6">
          <h2 className="mb-4 font-bold">New class</h2>
          <ClassForm
            mode="create"
            campuses={campuses.data!}
            levels={levels.data!}
            submitLabel="Create class"
            busy={create.isPending}
            error={create.error}
            onSubmit={(values) =>
              create.mutate(values, { onSuccess: (created) => router.push(`/classes/${created.id}`) })
            }
          />
        </Card>
      ) : null}

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
      {shown?.length === 0 ? (
        <EmptyState title={filter === 'ENDED' ? 'No ended classes' : 'No classes yet'} />
      ) : null}
      {shown?.length ? <ClassTable classes={shown} /> : null}

      <div className="mt-6">
        <CampusesCard schoolId={school.id} campuses={campuses.data!} />
      </div>
    </div>
  );
}

function ClassTable({ classes }: { classes: ClassSummary[] }) {
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[48rem] text-sm">
        <thead className="bg-cream-100 text-left text-xs uppercase tracking-wide text-bark-500">
          <tr>
            <th className="px-4 py-2">Class</th>
            <th className="px-4 py-2">Campus</th>
            <th className="px-4 py-2">Level</th>
            <th className="px-4 py-2">Now teaching</th>
            <th className="px-4 py-2">Teachers</th>
            <th className="px-4 py-2">Children</th>
          </tr>
        </thead>
        <tbody>
          {classes.map((item) => (
            <tr key={item.id} className="border-t border-cream-200">
              <td className="px-4 py-3">
                <Link href={`/classes/${item.id}`} className="font-semibold text-leaf-700 hover:underline">
                  {item.name}
                </Link>
                <span className="flex items-center gap-1 text-xs text-bark-500">
                  {item.schoolYear}
                  {item.status === 'ACTIVE' ? null : <ClassStatusBadge status={item.status} />}
                </span>
              </td>
              <td className="px-4 py-3">{item.campus.name}</td>
              <td className="px-4 py-3">
                {item.level.number} · {item.level.name}
              </td>
              <td className="px-4 py-3">
                {item.status === 'ACTIVE' && item.currentUnit
                  ? `${item.currentUnit.code} · lesson ${item.nextLesson}`
                  : '—'}
              </td>
              <td className="px-4 py-3 text-bark-500">
                {item.teachers.map((teacher) => teacher.user.name).join(', ') || '—'}
              </td>
              <td className="px-4 py-3">{item._count.enrollments}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
