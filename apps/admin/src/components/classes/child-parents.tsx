'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Button } from '@little-ants/ui/button';
import { EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { TextInput } from '@little-ants/ui/field';
import { api } from '../../lib/api';
import { fieldErrors, formatDate, useApiMutation } from '../../lib/hooks';
import { orgKeys } from '../../lib/org';
import type { Student, StudentParent } from '../../lib/types';
import { ConfirmDialog } from '../confirm-dialog';
import { Dialog } from '../dialog';
import { FormError } from '../form-error';

/** The parent emails of a child, opened from the child's actions menu. */
export function ChildParentsDialog({
  student,
  open,
  onClose,
}: {
  student: Pick<Student, 'id' | 'displayName'>;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={`Parents of ${student.displayName}`}>
      <ChildParents student={student} />
    </Dialog>
  );
}

function ChildParents({ student }: { student: Pick<Student, 'id' | 'displayName'> }) {
  const [removing, setRemoving] = useState<StudentParent['parent'] | null>(null);
  const key = orgKeys.parents(student.id);
  const parents = useQuery({
    queryKey: key,
    queryFn: () => api.get<StudentParent[]>(`/students/${student.id}/parents`),
  });
  const remove = useApiMutation(
    (parentId: string) => api.del(`/students/${student.id}/parents/${parentId}`),
    [key, orgKeys.allSchoolParents, orgKeys.allSchoolStudents],
  );

  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="text-bark-500">
        Parents sign in to the Listening Time app with the Google account of this email.
      </p>
      {parents.isPending ? <Spinner label="Loading parents" /> : null}
      {parents.error ? <ErrorNotice error={parents.error} /> : null}
      {parents.data?.length === 0 ? <EmptyState title="No parent emails yet" /> : null}
      {parents.data?.length ? (
        <ul className="divide-y divide-cream-200">
          {parents.data.map(({ parent, relationship }) => (
            <li key={parent.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <span className="font-semibold">{parent.email}</span>
                {relationship ? <span className="text-bark-500"> · {relationship}</span> : null}
                <span className="block text-xs text-bark-500">
                  {parent.lastSignInAt ? `signed in ${formatDate(parent.lastSignInAt)}` : 'not signed in yet'}
                </span>
              </span>
              <Button size="sm" variant="ghost" onClick={() => setRemoving(parent)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <AddParent studentId={student.id} />
      <ConfirmDialog
        open={removing !== null}
        title="Remove parent"
        confirmLabel="Remove"
        danger
        busy={remove.isPending}
        error={remove.error}
        onClose={() => setRemoving(null)}
        onConfirm={() => remove.mutate(removing!.id, { onSuccess: () => setRemoving(null) })}
      >
        <p>
          Remove <strong>{removing?.email}</strong> from {student.displayName}? They can no longer open this
          child&apos;s listening.
        </p>
      </ConfirmDialog>
    </div>
  );
}

function AddParent({ studentId }: { studentId: string }) {
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState('');
  const add = useApiMutation(
    () => api.post(`/students/${studentId}/parents`, { email, relationship }),
    [orgKeys.parents(studentId), orgKeys.allSchoolParents, orgKeys.allSchoolStudents],
  );
  const errors = fieldErrors(add.error);

  function submit(event: FormEvent): void {
    event.preventDefault();
    add.mutate(undefined, {
      onSuccess: () => {
        setEmail('');
        setRelationship('');
      },
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 rounded-xl bg-cream-50 p-3">
      <TextInput
        aria-label="Parent email"
        aria-invalid={errors.email ? true : undefined}
        type="email"
        placeholder="Parent's Google email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="w-60"
      />
      <TextInput
        aria-label="Relationship"
        placeholder="Relationship (e.g. Mother)"
        maxLength={40}
        value={relationship}
        onChange={(event) => setRelationship(event.target.value)}
        className="w-48"
      />
      <Button type="submit" variant="secondary" busy={add.isPending}>
        Add parent
      </Button>
      <div className="w-full">
        <FormError error={add.error} />
      </div>
    </form>
  );
}
