'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@little-ants/ui/badge';
import { Button } from '@little-ants/ui/button';
import { EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { Select, TextInput } from '@little-ants/ui/field';
import { END_REASON } from '../../../components/classes/children-card';
import { DataTable, ListCount, Toolbar, type Column } from '../../../components/data-table';
import { PageHeader } from '../../../components/page-header';
import { SchoolPage } from '../../../components/school-only';
import { StudentActions } from '../../../components/students/student-actions';
import { AddChildDialog } from '../../../components/students/student-dialogs';
import { formatDay } from '../../../lib/hooks';
import { useSchoolStudents } from '../../../lib/org';
import type { School, SchoolStudent } from '../../../lib/types';

type Status = 'current' | 'left' | 'all';

export default function StudentsPage() {
  return <SchoolPage>{(school) => <Students key={school.id} school={school} />}</SchoolPage>;
}

const COLUMNS: Column<SchoolStudent>[] = [
  {
    header: 'Child',
    cell: (student) => (
      <>
        <p className="font-semibold text-bark-900">{student.displayName}</p>
        <p className="text-xs text-bark-500">
          {student.birthYear ? `born ${student.birthYear}` : 'no birth year'}
        </p>
      </>
    ),
  },
  {
    header: 'Class',
    cell: ({ enrollment }) => (
      <Link href={`/classes/${enrollment.class.id}`} className="font-semibold text-leaf-700 hover:underline">
        {enrollment.class.name}
      </Link>
    ),
  },
  {
    header: 'Status',
    cell: ({ enrollment }) =>
      enrollment.endedOn ? (
        <Badge tone="sun">
          {enrollment.endReason ? END_REASON[enrollment.endReason] : 'left'} {formatDay(enrollment.endedOn)}
        </Badge>
      ) : (
        <span className="text-xs text-bark-500">
          <Badge tone="leaf">In class</Badge> since {formatDay(enrollment.startedOn)}
        </span>
      ),
  },
  {
    header: 'Parents',
    cell: (student) =>
      student.parents ? <span>{student.parents}</span> : <Badge tone="ant">none yet</Badge>,
  },
  {
    header: 'Consent',
    cell: (student) =>
      student.consentAt ? (
        <span className="text-xs">{formatDay(student.consentAt)}</span>
      ) : (
        <Badge tone="sun">missing</Badge>
      ),
  },
];

function Students({ school }: { school: School }) {
  const students = useSchoolStudents(school.id);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState<Status>('current');

  const all = students.data ?? [];
  const classes = [
    ...new Map(all.map((student) => [student.enrollment.class.id, student.enrollment.class])).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const term = search.trim().toLowerCase();
  const shown = all.filter(
    (student) =>
      (!term || student.displayName.toLowerCase().includes(term)) &&
      (!classId || student.enrollment.class.id === classId) &&
      (status === 'all' || (status === 'current') === !student.enrollment.endedOn),
  );

  return (
    <div>
      <PageHeader
        eyebrow={school.name}
        title="Students"
        actions={<Button onClick={() => setAdding(true)}>+ Add child</Button>}
      >
        Children of this school, including those who have left. Records hold a display name, birth year and
        the date parent consent was received.
      </PageHeader>
      {students.isPending ? <Spinner label="Loading children" /> : null}
      {students.error ? <ErrorNotice error={students.error} /> : null}
      {students.data ? (
        <>
          <Toolbar>
            <TextInput
              type="search"
              aria-label="Search children"
              placeholder="Search by name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select aria-label="Class" value={classId} onChange={(event) => setClassId(event.target.value)}>
              <option value="">All classes</option>
              {classes.map((klass) => (
                <option key={klass.id} value={klass.id}>
                  {klass.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Status"
              value={status}
              onChange={(event) => setStatus(event.target.value as Status)}
            >
              <option value="current">In a class now</option>
              <option value="left">Left</option>
              <option value="all">All children</option>
            </Select>
          </Toolbar>
          <ListCount shown={shown.length} total={all.length} noun="children" />
          <DataTable
            label="Children"
            columns={COLUMNS}
            rows={shown}
            rowKey={(student) => student.id}
            muted={(student) => Boolean(student.enrollment.endedOn)}
            minWidth="44rem"
            empty={
              all.length === 0 ? (
                <EmptyState title="No children yet">Add the first child with “+ Add child”.</EmptyState>
              ) : (
                'No child matches these filters'
              )
            }
            actions={(student) => (
              <StudentActions
                student={student}
                schoolId={school.id}
                currentClassId={student.enrollment.endedOn ? null : student.enrollment.class.id}
              />
            )}
          />
        </>
      ) : null}
      {adding ? <AddChildDialog schoolId={school.id} onClose={() => setAdding(false)} /> : null}
    </div>
  );
}
