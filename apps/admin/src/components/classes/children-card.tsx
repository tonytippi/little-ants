'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@little-ants/ui/button';
import { Card, EmptyState } from '@little-ants/ui/feedback';
import { Select, TextInput } from '@little-ants/ui/field';
import { api } from '../../lib/api';
import { formatDay, useApiMutation } from '../../lib/hooks';
import { orgKeys, useSchoolClasses } from '../../lib/org';
import type { ClassDetail, ClassSummary, Enrollment, EnrollmentEnd, Student } from '../../lib/types';
import { FormError } from '../form-error';
import { ChildParentsButton } from './child-parents';

const END_REASON: Record<EnrollmentEnd, string> = {
  LEFT: 'left',
  MOVED: 'moved to another class',
  MERGED: 'class merged',
  CLASS_STOPPED: 'class stopped',
};

/** Every change to a child can touch this class, the class they move to and the class lists. */
const CHILD_KEYS = [orgKeys.allClassDetails, orgKeys.allClasses];

function birthYearValue(value: string): number | null {
  return value ? Number(value) : null;
}

/** Children in the class now, with the former children (moved, left or ended with the class) below. */
export function ChildrenCard({ klass }: { klass: ClassDetail }) {
  const active = klass.status === 'ACTIVE';
  const current = klass.enrollments.filter((enrollment) => !enrollment.endedOn);
  const former = klass.enrollments.filter((enrollment) => enrollment.endedOn);
  const classes = useSchoolClasses(klass.campus.school.id, 'ACTIVE');
  const moveTargets = classes.data?.filter((item) => item.id !== klass.id) ?? [];

  return (
    <Card>
      <h2 className="mb-3 font-bold">Children ({current.length})</h2>
      {active ? <AddChild classId={klass.id} /> : null}
      {current.length === 0 ? (
        <EmptyState title={active ? 'No children yet' : 'No children in this class any more'} />
      ) : (
        <ul className="mt-3 divide-y divide-cream-200">
          {current.map((enrollment) => (
            <ChildRow key={enrollment.id} student={enrollment.student} moveTargets={moveTargets} />
          ))}
        </ul>
      )}
      {former.length ? (
        <FormerChildren
          enrollments={former}
          returnClassId={active ? klass.id : null}
          currentStudentIds={new Set(current.map((enrollment) => enrollment.student.id))}
        />
      ) : null}
    </Card>
  );
}

interface FormerChildrenProps {
  enrollments: Enrollment[];
  /** This class when it is active: children who left can come back to it. */
  returnClassId: string | null;
  currentStudentIds: Set<string>;
}

function FormerChildren({ enrollments, returnClassId, currentStudentIds }: FormerChildrenProps) {
  // Rows come newest first; only a child's latest stay here can offer "Back in class".
  const seen = new Set<string>();
  return (
    <details className="mt-4">
      <summary className="cursor-pointer text-sm font-semibold text-bark-700">
        Former children ({enrollments.length})
      </summary>
      <ul className="mt-2 divide-y divide-cream-200">
        {enrollments.map((enrollment) => {
          const latest = !seen.has(enrollment.student.id);
          seen.add(enrollment.student.id);
          const canReturn =
            returnClassId !== null &&
            latest &&
            enrollment.endReason === 'LEFT' &&
            !currentStudentIds.has(enrollment.student.id);
          return (
            <FormerChildRow
              key={enrollment.id}
              enrollment={enrollment}
              returnClassId={canReturn ? returnClassId : null}
            />
          );
        })}
      </ul>
    </details>
  );
}

function FormerChildRow({
  enrollment,
  returnClassId,
}: {
  enrollment: Enrollment;
  returnClassId: string | null;
}) {
  const { student } = enrollment;
  // Rejoin refuses a child who has joined another class since (409), so no one is pulled out of a class.
  const back = useApiMutation(
    (classId: string) => api.post(`/students/${student.id}/rejoin`, { classId }),
    CHILD_KEYS,
  );
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <span className="font-semibold">{student.displayName}</span>
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-bark-500">
          {formatDay(enrollment.startedOn)} – {formatDay(enrollment.endedOn)}
          {enrollment.endReason ? ` · ${END_REASON[enrollment.endReason]}` : ''}
        </span>
        {returnClassId ? (
          <Button
            size="sm"
            variant="secondary"
            busy={back.isPending}
            onClick={() => back.mutate(returnClassId)}
          >
            Back in class
          </Button>
        ) : null}
      </span>
      <div className="w-full empty:hidden">
        <FormError error={back.error} />
      </div>
    </li>
  );
}

function AddChild({ classId }: { classId: string }) {
  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [consent, setConsent] = useState('');
  const add = useApiMutation(
    () =>
      api.post<Student>(`/classes/${classId}/students`, {
        displayName: name,
        birthYear: birthYearValue(birthYear),
        consentAt: consent || null,
      }),
    CHILD_KEYS,
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
      <TextInput
        aria-label="Child's name"
        placeholder="Name children use (e.g. Bé An)"
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="w-56"
      />
      <TextInput
        aria-label="Birth year"
        placeholder="Birth year"
        type="number"
        value={birthYear}
        onChange={(event) => setBirthYear(event.target.value)}
        className="w-28"
      />
      <label className="flex flex-col text-xs text-bark-500">
        Parent consent received
        <TextInput
          type="date"
          value={consent}
          onChange={(event) => setConsent(event.target.value)}
          className="w-40"
        />
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

type RowMode = 'view' | 'edit' | 'move';

function ChildRow({ student, moveTargets }: { student: Student; moveTargets: ClassSummary[] }) {
  const [mode, setMode] = useState<RowMode>('view');
  const update = useApiMutation(
    (data: object) => api.patch<Student>(`/students/${student.id}`, data),
    CHILD_KEYS,
  );
  const move = useApiMutation(
    (classId: string) => api.post(`/students/${student.id}/move`, { classId }),
    CHILD_KEYS,
  );
  const leave = useApiMutation(() => api.post(`/students/${student.id}/leave`, {}), CHILD_KEYS);
  const remove = useApiMutation(() => api.del(`/students/${student.id}`), CHILD_KEYS);

  if (mode === 'edit')
    return (
      <EditChild
        student={student}
        busy={update.isPending}
        error={update.error}
        onSave={(data) => update.mutate(data, { onSuccess: () => setMode('view') })}
        onCancel={() => setMode('view')}
      />
    );
  if (mode === 'move')
    return (
      <MoveChild
        student={student}
        targets={moveTargets}
        busy={move.isPending}
        error={move.error}
        onMove={(classId) => move.mutate(classId)}
        onCancel={() => setMode('view')}
      />
    );

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <span>
        <span className="font-semibold">{student.displayName}</span>
        <span className="text-bark-500">
          {' '}
          · {student.birthYear ?? 'no birth year'} ·{' '}
          {student.consentAt ? `consent ${student.consentAt.slice(0, 10)}` : 'no consent recorded'}
        </span>
      </span>
      <span className="flex flex-wrap gap-1">
        <Button size="sm" variant="ghost" onClick={() => setMode('edit')}>
          Edit
        </Button>
        <ChildParentsButton student={student} />
        <Button size="sm" variant="ghost" onClick={() => setMode('move')}>
          Move to…
        </Button>
        <Button
          size="sm"
          variant="ghost"
          busy={leave.isPending}
          onClick={() =>
            window.confirm(
              `Mark ${student.displayName} as left? The child leaves this class today and loses access to the student app.`,
            ) && leave.mutate(undefined)
          }
        >
          Left
        </Button>
        <Button
          size="sm"
          variant="danger"
          busy={remove.isPending}
          onClick={() =>
            window.confirm(
              `Delete ${student.displayName}'s record and Show & Share results for good? Use this when a parent asks for deletion.`,
            ) && remove.mutate(undefined)
          }
        >
          Delete
        </Button>
      </span>
      <div className="w-full empty:hidden">
        <FormError error={leave.error ?? remove.error} />
      </div>
    </li>
  );
}

interface EditChildProps {
  student: Student;
  busy: boolean;
  error: unknown;
  onSave: (data: { displayName: string; birthYear: number | null; consentAt: string | null }) => void;
  onCancel: () => void;
}

function EditChild({ student, busy, error, onSave, onCancel }: EditChildProps) {
  const [name, setName] = useState(student.displayName);
  const [birthYear, setBirthYear] = useState(student.birthYear ? String(student.birthYear) : '');
  const [consent, setConsent] = useState(student.consentAt?.slice(0, 10) ?? '');
  return (
    <li className="flex flex-wrap items-end gap-2 py-2">
      <TextInput
        aria-label="Name"
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="w-48"
      />
      <TextInput
        aria-label="Birth year"
        type="number"
        value={birthYear}
        onChange={(event) => setBirthYear(event.target.value)}
        className="w-28"
      />
      <TextInput
        aria-label="Consent date"
        type="date"
        value={consent}
        onChange={(event) => setConsent(event.target.value)}
        className="w-40"
      />
      <Button
        size="sm"
        busy={busy}
        onClick={() =>
          onSave({ displayName: name, birthYear: birthYearValue(birthYear), consentAt: consent || null })
        }
      >
        Save
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
      <div className="w-full">
        <FormError error={error} />
      </div>
    </li>
  );
}

interface MoveChildProps {
  student: Student;
  targets: ClassSummary[];
  busy: boolean;
  error: unknown;
  onMove: (classId: string) => void;
  onCancel: () => void;
}

function MoveChild({ student, targets, busy, error, onMove, onCancel }: MoveChildProps) {
  const [classId, setClassId] = useState('');
  return (
    <li className="flex flex-wrap items-center gap-2 py-2 text-sm">
      <span className="font-semibold">{student.displayName}</span>
      <Select
        aria-label={`Move ${student.displayName} to`}
        value={classId}
        onChange={(event) => setClassId(event.target.value)}
        className="w-64"
      >
        <option value="">Move to class…</option>
        {targets.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name} · {item.campus.name} · {item.schoolYear}
          </option>
        ))}
      </Select>
      <Button size="sm" busy={busy} disabled={!classId} onClick={() => onMove(classId)}>
        Move
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
      {targets.length === 0 ? (
        <p className="w-full text-xs text-bark-500">There is no other active class at this school.</p>
      ) : null}
      <div className="w-full">
        <FormError error={error} />
      </div>
    </li>
  );
}
