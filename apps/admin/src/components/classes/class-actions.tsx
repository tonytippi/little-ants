'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@little-ants/ui/button';
import { EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { Field, Select } from '@little-ants/ui/field';
import { api } from '../../lib/api';
import { useApiMutation } from '../../lib/hooks';
import { orgKeys, useSchoolClasses, useSchoolStaff } from '../../lib/org';
import type { ClassDetail, ClassSummary } from '../../lib/types';
import { ConfirmDialog } from '../confirm-dialog';
import { Dialog } from '../dialog';
import { FormDialog } from '../form-dialog';
import { RowMenu } from '../row-menu';
import { ClassForm, type ClassEditValues } from './class-form';

type AnyClass = ClassSummary | ClassDetail;
type Open = 'edit' | 'teachers' | 'merge' | 'stop' | null;

interface ClassActionsProps {
  klass: AnyClass;
  schoolId: string;
  /** Children in the class now. */
  childCount: number;
  /** On the class page: Edit and Teachers as buttons, the rest in the ⋯ menu. */
  inHeader?: boolean;
}

const childrenText = (count: number): string => (count === 1 ? '1 child' : `${count} children`);

/** Every change to a class can show in class lists and details, and in who teaches what. */
const classKeys = (schoolId: string) => [
  orgKeys.allClassDetails,
  orgKeys.allClasses,
  orgKeys.schoolStaff(schoolId),
];

/** The actions of a class — edit, teachers, merge, stop — each in a modal, from a table row or the class page. */
export function ClassActions({ klass, schoolId, childCount, inHeader = false }: ClassActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState<Open>(null);
  const active = klass.status === 'ACTIVE';
  const close = () => setOpen(null);

  return (
    <>
      {inHeader && active ? (
        <>
          <Button variant="secondary" onClick={() => setOpen('teachers')}>
            Teachers
          </Button>
          <Button onClick={() => setOpen('edit')}>Edit class</Button>
        </>
      ) : null}
      {inHeader && !active ? null : (
        <RowMenu
          label={`Actions for ${klass.name}`}
          actions={[
            { label: 'Open class', onSelect: () => router.push(`/classes/${klass.id}`), hidden: inHeader },
            { label: 'Edit', onSelect: () => setOpen('edit'), hidden: inHeader || !active },
            { label: 'Teachers', onSelect: () => setOpen('teachers'), hidden: inHeader || !active },
            { label: 'Merge into another class', onSelect: () => setOpen('merge'), hidden: !active },
            { label: 'Stop class', onSelect: () => setOpen('stop'), danger: true, hidden: !active },
          ]}
        />
      )}
      {open === 'edit' ? <EditClassDialog klass={klass} schoolId={schoolId} onClose={close} /> : null}
      {open === 'teachers' ? <TeachersDialog klass={klass} schoolId={schoolId} onClose={close} /> : null}
      {open === 'merge' ? (
        <MergeDialog klass={klass} schoolId={schoolId} childCount={childCount} onClose={close} />
      ) : null}
      {open === 'stop' ? (
        <StopDialog klass={klass} schoolId={schoolId} childCount={childCount} onClose={close} />
      ) : null}
    </>
  );
}

interface DialogProps {
  klass: AnyClass;
  schoolId: string;
  onClose: () => void;
}

function EditClassDialog({ klass, schoolId, onClose }: DialogProps) {
  const update = useApiMutation(
    (values: ClassEditValues) => api.patch(`/classes/${klass.id}`, values),
    classKeys(schoolId),
  );
  return (
    <Dialog open onClose={onClose} title={`Edit ${klass.name}`} wide>
      <ClassForm
        mode="edit"
        initial={klass}
        submitLabel="Save class"
        busy={update.isPending}
        error={update.error}
        onSubmit={(values) => update.mutate(values, { onSuccess: onClose })}
      />
    </Dialog>
  );
}

const sameIds = (a: string[], b: string[]): boolean => a.slice().sort().join() === b.slice().sort().join();

/** Teachers of the class, chosen among the people who work at its school. */
function TeachersDialog({ klass, schoolId, onClose }: DialogProps) {
  const assigned = klass.teachers.map((item) => item.user.id);
  const staff = useSchoolStaff(schoolId);
  const [chosen, setChosen] = useState(assigned);
  const save = useApiMutation(
    () => api.put(`/classes/${klass.id}/teachers`, { userIds: chosen }),
    classKeys(schoolId),
  );
  const members =
    staff.data?.members.filter((member) => member.user.active || chosen.includes(member.user.id)) ?? [];

  return (
    <FormDialog
      open
      title={`Teachers of ${klass.name}`}
      submitLabel="Save teachers"
      busy={save.isPending}
      error={save.error}
      disabled={sameIds(chosen, assigned)}
      onClose={onClose}
      onSubmit={() => save.mutate(undefined, { onSuccess: onClose })}
    >
      {staff.isPending ? <Spinner label="Loading teachers" /> : null}
      {staff.error ? <ErrorNotice error={staff.error} /> : null}
      {staff.data && members.length === 0 ? (
        <EmptyState title="No teachers yet">
          Add teachers on the{' '}
          <Link href="/teachers" className="font-semibold text-leaf-700 hover:underline">
            Teachers
          </Link>{' '}
          page first.
        </EmptyState>
      ) : null}
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Teachers of this class</legend>
        {members.map(({ user, role }) => (
          <label key={user.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={chosen.includes(user.id)}
              onChange={(event) =>
                setChosen((current) =>
                  event.target.checked ? [...current, user.id] : current.filter((item) => item !== user.id),
                )
              }
            />
            <span className="font-semibold">{user.name}</span>
            <span className="text-xs text-bark-500">
              {user.email}
              {role === 'SCHOOL_ADMIN' ? ' · school admin' : ''}
            </span>
          </label>
        ))}
      </fieldset>
    </FormDialog>
  );
}

function MergeDialog({ klass, schoolId, childCount, onClose }: DialogProps & { childCount: number }) {
  const classes = useSchoolClasses(schoolId, 'ACTIVE');
  const [targetId, setTargetId] = useState('');
  const merge = useApiMutation(
    () => api.post<{ moved: number }>(`/classes/${klass.id}/merge`, { targetClassId: targetId }),
    classKeys(schoolId),
  );
  const targets = classes.data?.filter((item) => item.id !== klass.id) ?? [];
  const target = targets.find((item) => item.id === targetId);

  return (
    <ConfirmDialog
      open
      title={`Merge ${klass.name}`}
      confirmLabel="Merge classes"
      danger
      busy={merge.isPending}
      error={merge.error}
      disabled={!target}
      onClose={onClose}
      onConfirm={() => merge.mutate(undefined, { onSuccess: onClose })}
    >
      <Field label="Merge into" hint="Its children move to the other class and this class ends.">
        {(id, describedBy) => (
          <Select
            id={id}
            aria-describedby={describedBy}
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
          >
            <option value="">Choose a class</option>
            {targets.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.campus.name} · {item.schoolYear}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {classes.error ? <ErrorNotice error={classes.error} /> : null}
      {target ? (
        <p>
          <strong>{childrenText(childCount)}</strong> {childCount === 1 ? 'moves' : 'move'} from {klass.name}{' '}
          to {target.name} today. {klass.name} ends and stays in the history as merged. This cannot be undone.
        </p>
      ) : null}
    </ConfirmDialog>
  );
}

function StopDialog({ klass, schoolId, childCount, onClose }: DialogProps & { childCount: number }) {
  const stop = useApiMutation(
    () => api.post<{ ended: number }>(`/classes/${klass.id}/stop`, {}),
    classKeys(schoolId),
  );
  return (
    <ConfirmDialog
      open
      title={`Stop ${klass.name}`}
      confirmLabel="Stop class"
      danger
      busy={stop.isPending}
      error={stop.error}
      onClose={onClose}
      onConfirm={() => stop.mutate(undefined, { onSuccess: onClose })}
    >
      <p>
        Stop the class when it does not go on, for example at year end. It ends today and its{' '}
        <strong>{childrenText(childCount)}</strong> {childCount === 1 ? 'leaves' : 'leave'} it. Children
        without a class lose access to the student app until they join another class.
      </p>
      <p>This cannot be undone.</p>
    </ConfirmDialog>
  );
}
