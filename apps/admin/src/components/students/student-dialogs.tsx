'use client';

import { useState } from 'react';
import { Field, Select, TextInput } from '@little-ants/ui/field';
import { api } from '../../lib/api';
import { fieldErrors, useApiMutation } from '../../lib/hooks';
import { CHILD_KEYS, useSchoolClasses } from '../../lib/org';
import type { Student } from '../../lib/types';
import { EMPTY_PARENT, ParentEmailFields, filledParents } from '../classes/parent-email-fields';
import { FormDialog } from '../form-dialog';

/** The fields of a child shown in every child dialog. */
export type ChildRecord = Pick<Student, 'id' | 'displayName' | 'birthYear' | 'consentAt'>;

function birthYearValue(value: string): number | null {
  return value ? Number(value) : null;
}

/** Name, birth year and consent date: the record of a child. */
function ChildFields({
  values,
  errors,
  onChange,
}: {
  values: { name: string; birthYear: string; consent: string };
  errors: Record<string, string>;
  onChange: (patch: Partial<{ name: string; birthYear: string; consent: string }>) => void;
}) {
  return (
    <>
      <Field label="Name children use" hint="A display name only, e.g. Bé An" error={errors.displayName}>
        {(id, describedBy) => (
          <TextInput
            id={id}
            aria-describedby={describedBy}
            required
            value={values.name}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Birth year (optional)" error={errors.birthYear}>
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              type="number"
              value={values.birthYear}
              onChange={(event) => onChange({ birthYear: event.target.value })}
            />
          )}
        </Field>
        <Field label="Parent consent received" error={errors.consentAt}>
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              type="date"
              value={values.consent}
              onChange={(event) => onChange({ consent: event.target.value })}
            />
          )}
        </Field>
      </div>
    </>
  );
}

/** A new child in a class, with the parents who may sign in for them. Pass `classId` to fix the class. */
export function AddChildDialog({
  schoolId,
  classId: fixedClassId,
  onClose,
}: {
  schoolId: string;
  classId?: string;
  onClose: () => void;
}) {
  const classes = useSchoolClasses(schoolId, 'ACTIVE');
  const [classId, setClassId] = useState(fixedClassId ?? '');
  const [values, setValues] = useState({ name: '', birthYear: '', consent: '' });
  const [parents, setParents] = useState([EMPTY_PARENT]);
  const add = useApiMutation(
    () =>
      api.post<Student>(`/classes/${classId}/students`, {
        displayName: values.name,
        birthYear: birthYearValue(values.birthYear),
        consentAt: values.consent || null,
        parents: filledParents(parents),
      }),
    CHILD_KEYS,
  );

  return (
    <FormDialog
      open
      title="Add a child"
      submitLabel="Add child"
      busy={add.isPending}
      error={add.error}
      disabled={!classId}
      onClose={onClose}
      onSubmit={() => add.mutate(undefined, { onSuccess: onClose })}
    >
      {fixedClassId ? null : (
        <Field label="Class">
          {(id, describedBy) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              required
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
            >
              <option value="">{classes.isPending ? 'Loading classes…' : 'Choose a class'}</option>
              {classes.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.campus.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      <ChildFields
        values={values}
        errors={fieldErrors(add.error)}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
      />
      <ParentEmailFields rows={parents} onChange={setParents} />
    </FormDialog>
  );
}

export function EditChildDialog({ student, onClose }: { student: ChildRecord; onClose: () => void }) {
  const [values, setValues] = useState({
    name: student.displayName,
    birthYear: student.birthYear ? String(student.birthYear) : '',
    consent: student.consentAt?.slice(0, 10) ?? '',
  });
  const update = useApiMutation(
    () =>
      api.patch<Student>(`/students/${student.id}`, {
        displayName: values.name,
        birthYear: birthYearValue(values.birthYear),
        consentAt: values.consent || null,
      }),
    CHILD_KEYS,
  );

  return (
    <FormDialog
      open
      title={`Edit ${student.displayName}`}
      submitLabel="Save"
      busy={update.isPending}
      error={update.error}
      onClose={onClose}
      onSubmit={() => update.mutate(undefined, { onSuccess: onClose })}
    >
      <ChildFields
        values={values}
        errors={fieldErrors(update.error)}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
      />
    </FormDialog>
  );
}

/**
 * Put a child in another class: "move" takes a child out of their class today, "rejoin" brings back a child who
 * left (refused by the API if they have joined a class since).
 */
export function ChangeClassDialog({
  student,
  schoolId,
  mode,
  currentClassId,
  onClose,
}: {
  student: ChildRecord;
  schoolId: string;
  mode: 'move' | 'rejoin';
  currentClassId?: string;
  onClose: () => void;
}) {
  const classes = useSchoolClasses(schoolId, 'ACTIVE');
  const targets = classes.data?.filter((item) => item.id !== currentClassId) ?? [];
  const [classId, setClassId] = useState('');
  const change = useApiMutation(() => api.post(`/students/${student.id}/${mode}`, { classId }), CHILD_KEYS);

  return (
    <FormDialog
      open
      title={mode === 'move' ? `Move ${student.displayName}` : `${student.displayName} back in class`}
      submitLabel={mode === 'move' ? 'Move' : 'Back in class'}
      busy={change.isPending}
      error={change.error}
      disabled={!classId}
      onClose={onClose}
      onSubmit={() => change.mutate(undefined, { onSuccess: onClose })}
    >
      <p className="text-sm text-bark-500">
        {mode === 'move'
          ? 'The child leaves the current class today and joins the new one, keeping their parents and records.'
          : 'The child joins this class from today, and their parents can use the student app again.'}
      </p>
      <Field label="Class">
        {(id, describedBy) => (
          <Select
            id={id}
            aria-describedby={describedBy}
            required
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
          >
            <option value="">{classes.isPending ? 'Loading classes…' : 'Choose a class'}</option>
            {targets.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.campus.name} · {item.schoolYear}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {classes.data && targets.length === 0 ? (
        <p className="text-sm text-bark-500">There is no other active class at this school.</p>
      ) : null}
    </FormDialog>
  );
}
