'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@little-ants/ui/button';
import { EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { Select, TextInput } from '@little-ants/ui/field';
import { ClassActions } from '../../../components/classes/class-actions';
import { ClassForm, type ClassCreateValues } from '../../../components/classes/class-form';
import { ClassStatusBadge } from '../../../components/classes/class-status-badge';
import { DataTable, ListCount, Toolbar, type Column } from '../../../components/data-table';
import { Dialog } from '../../../components/dialog';
import { PageHeader } from '../../../components/page-header';
import { SchoolPage } from '../../../components/school-only';
import { SchoolSelect } from '../../../components/school-select';
import { api } from '../../../lib/api';
import { useApiMutation } from '../../../lib/hooks';
import { orgKeys, useCampuses, useLevels, useSchoolClasses } from '../../../lib/org';
import type { ClassSummary, School } from '../../../lib/types';

type Status = 'ACTIVE' | 'ENDED' | 'ALL';

/** "No teacher" in the teacher filter. */
const NO_TEACHER = 'none';

interface Filters {
  search: string;
  campusId: string;
  levelId: string;
  /** A teacher's user id, NO_TEACHER, or '' for any. */
  teacherId: string;
  status: Status;
}

const NO_FILTERS: Filters = { search: '', campusId: '', levelId: '', teacherId: '', status: 'ACTIVE' };

export default function ClassesPage() {
  return <SchoolPage>{(school) => <Classes key={school.id} school={school} />}</SchoolPage>;
}

function matches(item: ClassSummary, filters: Filters): boolean {
  const term = filters.search.trim().toLowerCase();
  const teacherIds = item.teachers.map((teacher) => teacher.user.id);
  return (
    (!term || item.name.toLowerCase().includes(term)) &&
    (!filters.campusId || item.campus.id === filters.campusId) &&
    (!filters.levelId || item.level.id === filters.levelId) &&
    (!filters.teacherId ||
      (filters.teacherId === NO_TEACHER
        ? teacherIds.length === 0
        : teacherIds.includes(filters.teacherId))) &&
    (filters.status === 'ALL' || (filters.status === 'ACTIVE') === (item.status === 'ACTIVE'))
  );
}

function Classes({ school }: { school: School }) {
  const router = useRouter();
  const params = useSearchParams();
  const [creating, setCreating] = useState(false);
  // Links from the campus, teacher and dashboard pages open the list already filtered.
  const [filters, setFilters] = useState<Filters>(() => ({
    ...NO_FILTERS,
    campusId: params.get('campus') ?? '',
    teacherId: params.get('teacher') ?? '',
  }));
  const campuses = useCampuses(school.id);
  const levels = useLevels();
  // Ended classes come from the full list; the API filters one status at a time.
  const classes = useSchoolClasses(school.id, filters.status === 'ACTIVE' ? 'ACTIVE' : 'all');
  const create = useApiMutation(
    (values: ClassCreateValues) => api.post<{ id: string }>(`/schools/${school.id}/classes`, values),
    [orgKeys.allClasses],
  );

  if (campuses.isPending || levels.isPending) return <Spinner label="Loading classes" />;
  const error = campuses.error ?? levels.error;
  if (error) return <ErrorNotice error={error} />;
  const hasCampus = campuses.data!.length > 0;
  const all = classes.data ?? [];
  const shown = all.filter((item) => matches(item, filters));
  const inStatus = all.filter((item) => matches(item, { ...NO_FILTERS, status: filters.status }));

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

      {hasCampus ? (
        <>
          <ClassFilters
            filters={filters}
            onChange={setFilters}
            campuses={campuses.data!}
            levels={levels.data!}
            classes={all}
          />
          {classes.isPending ? <Spinner label="Loading classes" /> : null}
          {classes.error ? <ErrorNotice error={classes.error} /> : null}
          {classes.data ? (
            <>
              <ListCount shown={shown.length} total={inStatus.length} noun="classes" />
              <DataTable
                label="Classes"
                columns={COLUMNS}
                rows={shown}
                rowKey={(item) => item.id}
                muted={(item) => item.status !== 'ACTIVE'}
                minWidth="52rem"
                empty={
                  inStatus.length === 0 ? (
                    <EmptyState title={filters.status === 'ENDED' ? 'No ended classes' : 'No classes yet'}>
                      {filters.status === 'ENDED' ? null : 'Create the first class with “+ New class”.'}
                    </EmptyState>
                  ) : (
                    'No class matches these filters'
                  )
                }
                actions={(item) => (
                  <ClassActions klass={item} schoolId={school.id} childCount={item._count.enrollments} />
                )}
              />
            </>
          ) : null}
        </>
      ) : (
        <EmptyState title="Add a campus first">
          Every class belongs to a campus. Add one on the{' '}
          <Link href="/campuses" className="font-semibold text-leaf-700 hover:underline">
            Campuses
          </Link>{' '}
          page.
        </EmptyState>
      )}
    </div>
  );
}

function ClassFilters({
  filters,
  onChange,
  campuses,
  levels,
  classes,
}: {
  filters: Filters;
  onChange: (filters: Filters) => void;
  campuses: { id: string; name: string }[];
  levels: { id: string; number: number; name: string }[];
  classes: ClassSummary[];
}) {
  const teachers = [
    ...new Map(classes.flatMap((item) => item.teachers.map(({ user }) => [user.id, user]))).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const filtered = Object.entries(NO_FILTERS).some(([key, value]) => filters[key as keyof Filters] !== value);

  return (
    <Toolbar>
      <SchoolSelect />
      <TextInput
        type="search"
        aria-label="Search classes"
        placeholder="Search by class name"
        value={filters.search}
        onChange={(event) => set({ search: event.target.value })}
      />
      <Select
        aria-label="Campus"
        value={filters.campusId}
        onChange={(event) => set({ campusId: event.target.value })}
      >
        <option value="">All campuses</option>
        {campuses.map((campus) => (
          <option key={campus.id} value={campus.id}>
            {campus.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Level"
        value={filters.levelId}
        onChange={(event) => set({ levelId: event.target.value })}
      >
        <option value="">All levels</option>
        {levels.map((level) => (
          <option key={level.id} value={level.id}>
            Level {level.number} · {level.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Teacher"
        value={filters.teacherId}
        onChange={(event) => set({ teacherId: event.target.value })}
      >
        <option value="">Any teacher</option>
        <option value={NO_TEACHER}>No teacher yet</option>
        {teachers.map((teacher) => (
          <option key={teacher.id} value={teacher.id}>
            {teacher.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Status"
        value={filters.status}
        onChange={(event) => set({ status: event.target.value as Status })}
      >
        <option value="ACTIVE">Active</option>
        <option value="ENDED">Ended</option>
        <option value="ALL">All classes</option>
      </Select>
      {filtered ? (
        <Button size="sm" variant="ghost" onClick={() => onChange(NO_FILTERS)}>
          Clear filters
        </Button>
      ) : null}
    </Toolbar>
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
    cell: (item) =>
      item.teachers.length ? (
        <span className="text-bark-500">{item.teachers.map((teacher) => teacher.user.name).join(', ')}</span>
      ) : item.status === 'ACTIVE' ? (
        <span className="text-xs font-semibold text-ant-600">none yet</span>
      ) : (
        '—'
      ),
  },
  { header: 'Children', cell: (item) => item._count.enrollments },
];
