'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Badge } from '@little-ants/ui/badge';
import { Button } from '@little-ants/ui/button';
import { Card, EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { TextInput } from '@little-ants/ui/field';
import { AdminOnly } from '../../../../components/admin-only';
import { ClassForm } from '../../../../components/classes/class-form';
import { FormError } from '../../../../components/form-error';
import { PageHeader } from '../../../../components/page-header';
import { api } from '../../../../lib/api';
import { useApiMutation } from '../../../../lib/hooks';
import type { Campus, ClassDetail, LevelOption, StaffMember, Student } from '../../../../lib/types';

export default function ClassPage() {
  return (
    <AdminOnly>
      <ClassView />
    </AdminOnly>
  );
}

function ClassView() {
  const { id } = useParams<{ id: string }>();
  const key = ['class', id];
  const klass = useQuery({ queryKey: key, queryFn: () => api.get<ClassDetail>(`/classes/${id}`) });
  const campuses = useQuery({ queryKey: ['campuses'], queryFn: () => api.get<Campus[]>('/campuses') });
  const levels = useQuery({ queryKey: ['levels'], queryFn: () => api.get<LevelOption[]>('/levels') });
  const update = useApiMutation((values: object) => api.patch(`/classes/${id}`, values), [key, ['classes']]);

  if (klass.isPending || campuses.isPending || levels.isPending) return <Spinner label="Loading class" />;
  const error = klass.error ?? campuses.error ?? levels.error;
  if (error) return <ErrorNotice error={error} />;
  const data = klass.data!;

  return (
    <div>
      <PageHeader back={{ href: '/classes', label: 'All classes' }} eyebrow={`${data.campus.name} · ${data.schoolYear}`} title={data.name}>
        Level {data.level.number} · {data.level.name}
        {data.currentUnit ? ` · now teaching ${data.currentUnit.code}, lesson ${data.nextLesson}` : ''}
      </PageHeader>
      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-4 font-bold">Class details</h2>
            <ClassForm
              key={`${data.id}-${data.nextLesson}-${data.currentUnitId}`}
              campuses={campuses.data!}
              levels={levels.data!}
              initial={data}
              submitLabel="Save class"
              busy={update.isPending}
              error={update.error}
              onSubmit={(values) => update.mutate(values)}
            />
            {update.isSuccess ? <p role="status" className="mt-2 text-sm text-leaf-700">Saved.</p> : null}
          </Card>
          <Students klass={data} />
        </div>
        <Teachers klass={data} />
      </div>
    </div>
  );
}

function Teachers({ klass }: { klass: ClassDetail }) {
  const staff = useQuery({ queryKey: ['staff'], queryFn: () => api.get<{ users: StaffMember[] }>('/staff') });
  const [chosen, setChosen] = useState(() => klass.teachers.map((item) => item.user.id));
  const save = useApiMutation(() => api.put(`/classes/${klass.id}/teachers`, { userIds: chosen }), [['class', klass.id], ['classes'], ['staff']]);
  const teachers = staff.data?.users.filter((user) => user.active && (user.roles.includes('TEACHER') || chosen.includes(user.id))) ?? [];
  const dirty = chosen.slice().sort().join() !== klass.teachers.map((item) => item.user.id).sort().join();

  return (
    <Card className="self-start">
      <h2 className="mb-3 font-bold">Teachers</h2>
      {staff.isPending ? <Spinner label="Loading staff" /> : null}
      {staff.error ? <ErrorNotice error={staff.error} /> : null}
      {staff.data && teachers.length === 0 ? <EmptyState title="No teachers yet">Invite staff with the Teacher role first.</EmptyState> : null}
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Teachers of this class</legend>
        {teachers.map((user) => (
          <label key={user.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={chosen.includes(user.id)}
              onChange={(event) => setChosen((current) => (event.target.checked ? [...current, user.id] : current.filter((item) => item !== user.id)))}
            />
            <span className="font-semibold">{user.name}</span>
            <span className="text-xs text-bark-500">{user.email}</span>
          </label>
        ))}
      </fieldset>
      {dirty ? (
        <Button size="sm" className="mt-3" busy={save.isPending} onClick={() => save.mutate(undefined)}>
          Save teachers
        </Button>
      ) : null}
      <FormError error={save.error} />
    </Card>
  );
}

function Students({ klass }: { klass: ClassDetail }) {
  const [showLeft, setShowLeft] = useState(false);
  const students = klass.students.filter((student) => showLeft || student.status === 'ACTIVE');
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">Children ({klass.students.filter((student) => student.status === 'ACTIVE').length})</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showLeft} onChange={(event) => setShowLeft(event.target.checked)} />
          Show children who left
        </label>
      </div>
      <AddStudent classId={klass.id} />
      {students.length === 0 ? (
        <EmptyState title="No children yet" />
      ) : (
        <ul className="mt-3 divide-y divide-cream-200">
          {students.map((student) => (
            <StudentRow key={student.id} student={student} classId={klass.id} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function birthYearValue(value: string): number | null {
  return value ? Number(value) : null;
}

function AddStudent({ classId }: { classId: string }) {
  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [consent, setConsent] = useState('');
  const add = useApiMutation(
    () => api.post(`/classes/${classId}/students`, { displayName: name, birthYear: birthYearValue(birthYear), consentAt: consent || null }),
    [['class', classId], ['classes']],
  );
  function submit(event: FormEvent): void {
    event.preventDefault();
    add.mutate(undefined, {
      onSuccess: () => {
        setName('');
        setBirthYear('');
        setConsent('');
      },
    });
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 rounded-xl bg-cream-50 p-3">
      <TextInput aria-label="Child's name" placeholder="Name children use (e.g. Bé An)" required value={name} onChange={(event) => setName(event.target.value)} className="w-56" />
      <TextInput aria-label="Birth year" placeholder="Birth year" type="number" value={birthYear} onChange={(event) => setBirthYear(event.target.value)} className="w-28" />
      <label className="flex flex-col text-xs text-bark-500">
        Parent consent received
        <TextInput type="date" value={consent} onChange={(event) => setConsent(event.target.value)} className="w-40" />
      </label>
      <Button type="submit" variant="secondary" busy={add.isPending}>
        Add child
      </Button>
      <div className="w-full">
        <FormError error={add.error} />
      </div>
    </form>
  );
}

function StudentRow({ student, classId }: { student: Student; classId: string }) {
  const invalidate = [['class', classId], ['classes']];
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(student.displayName);
  const [birthYear, setBirthYear] = useState(student.birthYear ? String(student.birthYear) : '');
  const [consent, setConsent] = useState(student.consentAt?.slice(0, 10) ?? '');
  const update = useApiMutation((data: object) => api.patch(`/students/${student.id}`, data), invalidate);
  const remove = useApiMutation(() => api.del(`/students/${student.id}`), invalidate);

  if (editing) {
    return (
      <li className="flex flex-wrap items-end gap-2 py-2">
        <TextInput aria-label="Name" value={name} onChange={(event) => setName(event.target.value)} className="w-48" />
        <TextInput aria-label="Birth year" type="number" value={birthYear} onChange={(event) => setBirthYear(event.target.value)} className="w-28" />
        <TextInput aria-label="Consent date" type="date" value={consent} onChange={(event) => setConsent(event.target.value)} className="w-40" />
        <Button
          size="sm"
          busy={update.isPending}
          onClick={() => update.mutate({ displayName: name, birthYear: birthYearValue(birthYear), consentAt: consent || null }, { onSuccess: () => setEditing(false) })}
        >
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <div className="w-full">
          <FormError error={update.error} />
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <span>
        <span className="font-semibold">{student.displayName}</span>
        <span className="text-bark-500">
          {' '}
          · {student.birthYear ?? 'no birth year'} · {student.consentAt ? `consent ${student.consentAt.slice(0, 10)}` : 'no consent recorded'}
        </span>{' '}
        {student.status === 'LEFT' ? <Badge tone="bark">left</Badge> : null}
      </span>
      <span className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          Edit
        </Button>
        <Button size="sm" variant="ghost" busy={update.isPending} onClick={() => update.mutate({ status: student.status === 'ACTIVE' ? 'LEFT' : 'ACTIVE' })}>
          {student.status === 'ACTIVE' ? 'Mark as left' : 'Back in class'}
        </Button>
        <Button
          size="sm"
          variant="danger"
          busy={remove.isPending}
          onClick={() => window.confirm(`Delete ${student.displayName}'s record and Show & Share results for good? Use this when a parent asks for deletion.`) && remove.mutate(undefined)}
        >
          Delete
        </Button>
      </span>
      <FormError error={remove.error} />
    </li>
  );
}
