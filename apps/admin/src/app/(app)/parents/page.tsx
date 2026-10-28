'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge } from '@little-ants/ui/badge';
import { Button } from '@little-ants/ui/button';
import { EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { Field, Select, TextInput } from '@little-ants/ui/field';
import { END_REASON } from '../../../components/classes/children-card';
import { ConfirmDialog } from '../../../components/confirm-dialog';
import { DataTable, ListCount, Toolbar, type Column } from '../../../components/data-table';
import { FormDialog } from '../../../components/form-dialog';
import { NavIcon } from '../../../components/nav-icons';
import { PageHeader } from '../../../components/page-header';
import { RowMenu } from '../../../components/row-menu';
import { SchoolPage } from '../../../components/school-only';
import { api } from '../../../lib/api';
import { fieldErrors, formatDate, formatDay, useApiMutation } from '../../../lib/hooks';
import { orgKeys, useSchoolStudents } from '../../../lib/org';
import type { School, SchoolParent } from '../../../lib/types';

type ChildStatus = 'all' | 'current' | 'left';
type SignIn = 'all' | 'signed-in' | 'never';
type ParentChild = SchoolParent['children'][number];

interface Filters {
  search: string;
  classId: string;
  status: ChildStatus;
  signIn: SignIn;
}

const NO_FILTERS: Filters = { search: '', classId: '', status: 'all', signIn: 'all' };

/** Parents matching the filters, each with only the children that match the class and status filters. */
function applyFilters(parents: SchoolParent[], filters: Filters): SchoolParent[] {
  const term = filters.search.trim().toLowerCase();
  return parents.flatMap((parent) => {
    if (filters.signIn === 'signed-in' && parent.devices === 0) return [];
    if (filters.signIn === 'never' && parent.lastSignInAt) return [];
    const parentMatches = !term || parent.email.includes(term) || parent.name.toLowerCase().includes(term);
    const children = parent.children.filter(
      (child) =>
        (!filters.classId || child.class.id === filters.classId) &&
        (filters.status === 'all' || (filters.status === 'current') === !child.endedOn) &&
        (parentMatches || child.displayName.toLowerCase().includes(term)),
    );
    return children.length ? [{ ...parent, children }] : [];
  });
}

export default function ParentsPage() {
  return <SchoolPage>{(school) => <ParentsView key={school.id} school={school} />}</SchoolPage>;
}

function ParentsView({ school }: { school: School }) {
  const [filters, setFilters] = useState(NO_FILTERS);
  const [adding, setAdding] = useState(false);
  const [unlinking, setUnlinking] = useState<{ parent: SchoolParent; child: ParentChild } | null>(null);
  const parents = useQuery({
    queryKey: orgKeys.schoolParents(school.id),
    queryFn: () => api.get<SchoolParent[]>(`/schools/${school.id}/parents`),
  });
  const shown = applyFilters(parents.data ?? [], filters);

  const columns: Column<SchoolParent>[] = [
    {
      header: 'Parent',
      cell: (parent) => (
        <>
          <p className="font-semibold text-bark-900">{parent.email}</p>
          <p className="text-xs text-bark-500">
            {parent.name ? `${parent.name} · ` : null}
            {parent.lastSignInAt ? `signed in ${formatDate(parent.lastSignInAt)}` : 'not signed in yet'}
          </p>
        </>
      ),
    },
    {
      header: 'Children',
      cell: (parent) => <ChildChips parent={parent} onRemove={(child) => setUnlinking({ parent, child })} />,
    },
    {
      header: 'Devices',
      cell: ({ devices }) => (
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${devices ? 'text-leaf-700' : 'text-bark-500'}`}
        >
          <span aria-hidden className={`size-2 rounded-full ${devices ? 'bg-leaf-500' : 'bg-cream-200'}`} />
          {devices === 0 ? 'Not signed in' : `${devices} device${devices === 1 ? '' : 's'}`}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={school.name}
        title="Parents"
        actions={<Button onClick={() => setAdding(true)}>+ Add parent</Button>}
      >
        Parent accounts of the children of this school, including children who have left. Parents sign in to
        the Listening Time app with the Google account of their email, as long as a child is in a class.
      </PageHeader>
      {parents.isPending ? <Spinner label="Loading parents" /> : null}
      {parents.error ? <ErrorNotice error={parents.error} /> : null}
      {parents.data ? (
        <>
          <ParentFilters parents={parents.data} filters={filters} onChange={setFilters} />
          <ListCount shown={shown.length} total={parents.data.length} noun="parents" />
          <DataTable
            label="Parents"
            columns={columns}
            rows={shown}
            rowKey={(parent) => parent.id}
            minWidth="44rem"
            empty={
              parents.data.length === 0 ? (
                <EmptyState title="No parent accounts yet">
                  Add a parent with “+ Add parent”, or together with a new child.
                </EmptyState>
              ) : (
                'No parent matches these filters'
              )
            }
            actions={(parent) => <ParentActions schoolId={school.id} parent={parent} />}
          />
        </>
      ) : null}
      {adding ? <AddParentDialog schoolId={school.id} onClose={() => setAdding(false)} /> : null}
      {unlinking ? <UnlinkDialog {...unlinking} onClose={() => setUnlinking(null)} /> : null}
    </div>
  );
}

function ParentFilters({
  parents,
  filters,
  onChange,
}: {
  parents: SchoolParent[];
  filters: Filters;
  onChange: (filters: Filters) => void;
}) {
  // Classes of the listed children, including classes they have left.
  const classes = [
    ...new Map(
      parents.flatMap((parent) => parent.children.map((child) => [child.class.id, child.class])),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const filtered = Object.entries(NO_FILTERS).some(([key, value]) => filters[key as keyof Filters] !== value);

  return (
    <Toolbar>
      <TextInput
        type="search"
        aria-label="Search parents"
        placeholder="Search parent or child"
        value={filters.search}
        onChange={(event) => set({ search: event.target.value })}
      />
      <Select
        aria-label="Class"
        value={filters.classId}
        onChange={(event) => set({ classId: event.target.value })}
      >
        <option value="">All classes</option>
        {classes.map((klass) => (
          <option key={klass.id} value={klass.id}>
            {klass.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Child status"
        value={filters.status}
        onChange={(event) => set({ status: event.target.value as ChildStatus })}
      >
        <option value="all">All children</option>
        <option value="current">In a class now</option>
        <option value="left">Left the school</option>
      </Select>
      <Select
        aria-label="Sign-in"
        value={filters.signIn}
        onChange={(event) => set({ signIn: event.target.value as SignIn })}
      >
        <option value="all">Any sign-in</option>
        <option value="signed-in">Signed in now</option>
        <option value="never">Never signed in</option>
      </Select>
      {filtered ? (
        <Button size="sm" variant="ghost" onClick={() => onChange(NO_FILTERS)}>
          Clear filters
        </Button>
      ) : null}
    </Toolbar>
  );
}

function ChildChips({ parent, onRemove }: { parent: SchoolParent; onRemove: (child: ParentChild) => void }) {
  return (
    <ul aria-label={`Children of ${parent.email}`} className="flex flex-wrap gap-2">
      {parent.children.map((child) => (
        <li
          key={child.id}
          className={`inline-flex max-w-full items-center gap-1.5 rounded-full border py-1 pr-1 pl-3 ${
            child.endedOn ? 'border-dashed border-cream-200 bg-white' : 'border-cream-200 bg-cream-50'
          }`}
        >
          <span className="truncate font-semibold text-bark-900">{child.displayName}</span>
          {child.relationship ? <span className="text-xs text-bark-500">· {child.relationship}</span> : null}
          <Link
            href={`/classes/${child.class.id}`}
            className="text-xs font-semibold text-leaf-700 hover:underline"
          >
            {child.class.name}
          </Link>
          {child.endedOn ? (
            <Badge tone="sun">
              {child.endReason ? END_REASON[child.endReason] : 'left'} {formatDay(child.endedOn)}
            </Badge>
          ) : null}
          <button
            type="button"
            aria-label={`Remove ${parent.email} from ${child.displayName}`}
            title="Remove this parent from the child"
            onClick={() => onRemove(child)}
            className="rounded-full p-1 text-bark-500 transition-colors hover:bg-ant-50 hover:text-ant-600"
          >
            <NavIcon name="close" className="size-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function UnlinkDialog({
  parent,
  child,
  onClose,
}: {
  parent: SchoolParent;
  child: ParentChild;
  onClose: () => void;
}) {
  const unlink = useApiMutation(
    () => api.del(`/students/${child.id}/parents/${parent.id}`),
    [orgKeys.allSchoolParents, orgKeys.allStudentParents, orgKeys.allSchoolStudents],
  );
  return (
    <ConfirmDialog
      open
      title="Remove parent"
      confirmLabel="Remove"
      danger
      busy={unlink.isPending}
      error={unlink.error}
      onClose={onClose}
      onConfirm={() => unlink.mutate(undefined, { onSuccess: onClose })}
    >
      <p>
        Remove <strong>{parent.email}</strong> from {child.displayName}? They can no longer open this
        child&apos;s listening.
      </p>
    </ConfirmDialog>
  );
}

function ParentActions({ schoolId, parent }: { schoolId: string; parent: SchoolParent }) {
  const [signingOut, setSigningOut] = useState(false);
  const signOut = useApiMutation(
    () => api.del(`/schools/${schoolId}/parents/${parent.id}/sessions`),
    [orgKeys.schoolParents(schoolId)],
  );
  return (
    <>
      <RowMenu
        label={`Actions for ${parent.email}`}
        actions={[
          {
            label: 'Sign out on every device',
            onSelect: () => setSigningOut(true),
            danger: true,
            hidden: parent.devices === 0,
          },
        ]}
      />
      <ConfirmDialog
        open={signingOut}
        title="Sign out on every device"
        confirmLabel="Sign out"
        danger
        busy={signOut.isPending}
        error={signOut.error}
        onClose={() => setSigningOut(false)}
        onConfirm={() => signOut.mutate(undefined, { onSuccess: () => setSigningOut(false) })}
      >
        <p>
          Sign <strong>{parent.email}</strong> out on {parent.devices} device{parent.devices === 1 ? '' : 's'}
          , for example after a lost phone. They can sign in again with Google.
        </p>
      </ConfirmDialog>
    </>
  );
}

/** Add a parent to a child in a class: narrow the children down by class and name, then pick one. */
function AddParentDialog({ schoolId, onClose }: { schoolId: string; onClose: () => void }) {
  const students = useSchoolStudents(schoolId);
  const [classId, setClassId] = useState('');
  const [childSearch, setChildSearch] = useState('');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState('');

  const inClass = (students.data ?? []).filter((student) => !student.enrollment.endedOn);
  const classes = [
    ...new Map(inClass.map((student) => [student.enrollment.class.id, student.enrollment.class])).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const term = childSearch.trim().toLowerCase();
  const children = inClass.filter(
    (student) =>
      (!classId || student.enrollment.class.id === classId) &&
      (!term || student.displayName.toLowerCase().includes(term)),
  );
  const child = children.find((student) => student.id === studentId);

  const add = useApiMutation(
    () => api.post(`/students/${studentId}/parents`, { email, relationship }),
    [orgKeys.schoolParents(schoolId), orgKeys.parents(studentId), orgKeys.allSchoolStudents],
  );
  const errors = fieldErrors(add.error);

  return (
    <FormDialog
      open
      title="Add a parent"
      submitLabel="Add parent"
      busy={add.isPending}
      error={add.error}
      disabled={!child}
      onClose={onClose}
      onSubmit={() => add.mutate(undefined, { onSuccess: onClose })}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-bark-700">Child</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <Select aria-label="Class" value={classId} onChange={(event) => setClassId(event.target.value)}>
            <option value="">All classes</option>
            {classes.map((klass) => (
              <option key={klass.id} value={klass.id}>
                {klass.name}
              </option>
            ))}
          </Select>
          <TextInput
            type="search"
            aria-label="Filter children by name"
            placeholder="Filter by name"
            value={childSearch}
            onChange={(event) => setChildSearch(event.target.value)}
          />
        </div>
        <Select
          aria-label="Child"
          required
          value={child ? studentId : ''}
          onChange={(event) => setStudentId(event.target.value)}
        >
          <option value="">
            {students.isPending ? 'Loading children…' : `Choose a child (${children.length})`}
          </option>
          {children.map((student) => (
            <option key={student.id} value={student.id}>
              {student.displayName} · {student.enrollment.class.name}
            </option>
          ))}
        </Select>
      </fieldset>
      <Field label="Parent's Google email" error={errors.email}>
        {(id, describedBy) => (
          <TextInput
            id={id}
            aria-describedby={describedBy}
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        )}
      </Field>
      <Field label="Relationship (optional)" error={errors.relationship}>
        {(id, describedBy) => (
          <TextInput
            id={id}
            aria-describedby={describedBy}
            placeholder="e.g. Mother"
            maxLength={40}
            value={relationship}
            onChange={(event) => setRelationship(event.target.value)}
          />
        )}
      </Field>
    </FormDialog>
  );
}
