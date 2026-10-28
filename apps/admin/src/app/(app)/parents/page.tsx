'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Badge } from '@little-ants/ui/badge';
import { Button } from '@little-ants/ui/button';
import { Card, EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { Field, Select, TextInput } from '@little-ants/ui/field';
import { END_REASON } from '../../../components/classes/children-card';
import { FormError } from '../../../components/form-error';
import { NavIcon } from '../../../components/nav-icons';
import { PageHeader } from '../../../components/page-header';
import { SchoolPage } from '../../../components/school-only';
import { api } from '../../../lib/api';
import { fieldErrors, formatDate, formatDay, useApiMutation } from '../../../lib/hooks';
import { orgKeys, useSchoolClasses } from '../../../lib/org';
import type { ClassDetail, School, SchoolParent } from '../../../lib/types';

type ChildStatus = 'all' | 'current' | 'left';
type SignIn = 'all' | 'signed-in' | 'never';

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
  const parents = useQuery({
    queryKey: orgKeys.schoolParents(school.id),
    queryFn: () => api.get<SchoolParent[]>(`/schools/${school.id}/parents`),
  });
  const shown = applyFilters(parents.data ?? [], filters);

  return (
    <div>
      <PageHeader eyebrow={school.name} title="Parents">
        Parent accounts of the children of this school, including children who have left. Parents sign in to
        the Listening Time app with the Google account of their email, as long as a child is in a class.
      </PageHeader>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="flex min-w-0 flex-col gap-4">
          {parents.isPending ? <Spinner label="Loading parents" /> : null}
          {parents.error ? <ErrorNotice error={parents.error} /> : null}
          {parents.data?.length === 0 ? (
            <EmptyState title="No parent accounts yet">
              Add a parent here, or together with a new child on the class page.
            </EmptyState>
          ) : null}
          {parents.data?.length ? (
            <>
              <ParentFilters parents={parents.data} filters={filters} onChange={setFilters} />
              <p className="text-xs text-bark-500">
                {shown.length} of {parents.data.length} parents
              </p>
              {shown.length === 0 ? (
                <EmptyState title="No parent matches these filters" />
              ) : (
                <ParentTable schoolId={school.id} parents={shown} />
              )}
            </>
          ) : null}
        </div>
        <AddParent schoolId={school.id} />
      </div>
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

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1fr)_repeat(3,minmax(0,11rem))_auto]">
      <TextInput
        type="search"
        aria-label="Search parents"
        placeholder="Search parent or child"
        value={filters.search}
        onChange={(event) => set({ search: event.target.value })}
        className="sm:col-span-2 lg:col-span-1"
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
      {Object.entries(NO_FILTERS).some(([key, value]) => filters[key as keyof Filters] !== value) ? (
        <Button size="sm" variant="ghost" onClick={() => onChange(NO_FILTERS)} className="self-center">
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}

/** One row per parent: a table on wide screens, stacked blocks on phones. */
function ParentTable({ schoolId, parents }: { schoolId: string; parents: SchoolParent[] }) {
  return (
    <Card className="p-0">
      <div
        aria-hidden
        className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_10rem] gap-4 rounded-t-[var(--radius-card)] bg-cream-100 px-4 py-2 text-xs font-bold uppercase tracking-wide text-bark-500 md:grid"
      >
        <span>Parent</span>
        <span>Children</span>
        <span>Devices</span>
      </div>
      <ul className="divide-y divide-cream-200">
        {parents.map((parent) => (
          <ParentRow key={parent.id} schoolId={schoolId} parent={parent} />
        ))}
      </ul>
    </Card>
  );
}

function ParentRow({ schoolId, parent }: { schoolId: string; parent: SchoolParent }) {
  const unlink = useApiMutation(
    (studentId: string) => api.del(`/students/${studentId}/parents/${parent.id}`),
    [orgKeys.allSchoolParents, orgKeys.allStudentParents],
  );
  const signOut = useApiMutation(
    () => api.del(`/schools/${schoolId}/parents/${parent.id}/sessions`),
    [orgKeys.schoolParents(schoolId)],
  );
  const { devices } = parent;

  return (
    <li className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_10rem] md:gap-4">
      <div className="min-w-0">
        <p className="truncate font-semibold" title={parent.email}>
          {parent.email}
        </p>
        <p className="text-xs text-bark-500">
          {parent.name ? `${parent.name} · ` : null}
          {parent.lastSignInAt ? `signed in ${formatDate(parent.lastSignInAt)}` : 'not signed in yet'}
        </p>
      </div>
      <div className="min-w-0">
        <ul aria-label={`Children of ${parent.email}`} className="flex flex-wrap gap-2">
          {parent.children.map((child) => (
            <li
              key={child.id}
              className={`inline-flex max-w-full items-center gap-1.5 rounded-full border py-1 pr-1 pl-3 ${
                child.endedOn ? 'border-dashed border-cream-200 bg-white' : 'border-cream-200 bg-cream-50'
              }`}
            >
              <span className="truncate font-semibold">{child.displayName}</span>
              {child.relationship ? (
                <span className="text-xs text-bark-500">· {child.relationship}</span>
              ) : null}
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
                disabled={unlink.isPending && unlink.variables === child.id}
                onClick={() =>
                  window.confirm(
                    `Remove ${parent.email} from ${child.displayName}? They can no longer open this child's listening.`,
                  ) && unlink.mutate(child.id)
                }
                className="rounded-full p-1 text-bark-500 transition-colors hover:bg-ant-50 hover:text-ant-600 disabled:opacity-50"
              >
                <NavIcon name="close" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <FormError error={unlink.error} />
      </div>
      <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-start">
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${devices ? 'text-leaf-700' : 'text-bark-500'}`}
        >
          <span aria-hidden className={`size-2 rounded-full ${devices ? 'bg-leaf-500' : 'bg-cream-200'}`} />
          {devices === 0 ? 'Not signed in' : `${devices} device${devices === 1 ? '' : 's'}`}
        </span>
        {devices > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            busy={signOut.isPending}
            onClick={() =>
              window.confirm(
                `Sign ${parent.email} out on every device? They can sign in again with Google.`,
              ) && signOut.mutate(undefined)
            }
          >
            Sign out devices
          </Button>
        ) : null}
        <FormError error={signOut.error} />
      </div>
    </li>
  );
}

/** Add a parent to a child: narrow the children down by class and name, then pick one. */
function AddParent({ schoolId }: { schoolId: string }) {
  const [classId, setClassId] = useState('');
  const [childSearch, setChildSearch] = useState('');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState('');
  const [message, setMessage] = useState('');
  const classes = useSchoolClasses(schoolId, 'ACTIVE');
  const klass = useQuery({
    queryKey: orgKeys.class(classId),
    queryFn: () => api.get<ClassDetail>(`/classes/${classId}`),
    enabled: Boolean(classId),
  });
  const term = childSearch.trim().toLowerCase();
  const children = (klass.data?.enrollments ?? [])
    .filter((enrollment) => !enrollment.endedOn)
    .map((enrollment) => enrollment.student)
    .filter((student) => !term || student.displayName.toLowerCase().includes(term));
  const child = children.find((student) => student.id === studentId);

  const add = useApiMutation(
    () => api.post(`/students/${studentId}/parents`, { email, relationship }),
    [orgKeys.schoolParents(schoolId), orgKeys.parents(studentId)],
  );
  const errors = fieldErrors(add.error);

  function submit(event: FormEvent): void {
    event.preventDefault();
    setMessage('');
    add.mutate(undefined, {
      onSuccess: () => {
        setMessage(`${email} can now sign in for ${child?.displayName ?? 'the child'}.`);
        setEmail('');
        setRelationship('');
      },
    });
  }

  return (
    <Card className="self-start">
      <h2 className="mb-3 font-bold">Add a parent</h2>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Class">
          {(id, describedBy) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              required
              value={classId}
              onChange={(event) => {
                setClassId(event.target.value);
                setStudentId('');
              }}
            >
              <option value="">Choose a class</option>
              {classes.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.campus.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {classId ? (
          <Field label="Child">
            {(id, describedBy) => (
              <div className="flex flex-col gap-2">
                <TextInput
                  type="search"
                  aria-label="Filter children by name"
                  placeholder="Filter by name"
                  value={childSearch}
                  onChange={(event) => setChildSearch(event.target.value)}
                />
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  required
                  value={child ? studentId : ''}
                  onChange={(event) => setStudentId(event.target.value)}
                >
                  <option value="">
                    {klass.isPending ? 'Loading children…' : `Choose a child (${children.length})`}
                  </option>
                  {children.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.displayName}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </Field>
        ) : null}
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
        <Button type="submit" busy={add.isPending} disabled={!child}>
          Add parent
        </Button>
        {message ? (
          <p role="status" className="text-sm text-leaf-700">
            {message}
          </p>
        ) : null}
        <FormError error={add.error} />
      </form>
    </Card>
  );
}
