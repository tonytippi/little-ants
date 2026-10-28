'use client';

import { useState } from 'react';
import { api } from '../../lib/api';
import { useApiMutation } from '../../lib/hooks';
import { CHILD_KEYS } from '../../lib/org';
import { ChildParentsDialog } from '../classes/child-parents';
import { ConfirmDialog } from '../confirm-dialog';
import { RowMenu } from '../row-menu';
import { ChangeClassDialog, EditChildDialog, type ChildRecord } from './student-dialogs';

type Open = 'edit' | 'parents' | 'move' | 'rejoin' | 'leave' | 'delete' | null;

/**
 * The ⋯ menu of a child and the dialogs behind it. `currentClassId` is the child's class now; without it the
 * child has left and can come back to a class.
 */
export function StudentActions({
  student,
  schoolId,
  currentClassId,
}: {
  student: ChildRecord;
  schoolId: string;
  currentClassId: string | null;
}) {
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);
  const leave = useApiMutation(() => api.post(`/students/${student.id}/leave`, {}), CHILD_KEYS);
  const remove = useApiMutation(() => api.del(`/students/${student.id}`), CHILD_KEYS);
  const name = student.displayName;

  return (
    <>
      <RowMenu
        label={`Actions for ${name}`}
        actions={[
          { label: 'Edit', onSelect: () => setOpen('edit') },
          { label: 'Parents', onSelect: () => setOpen('parents') },
          { label: 'Move to another class', onSelect: () => setOpen('move'), hidden: !currentClassId },
          { label: 'Back in a class', onSelect: () => setOpen('rejoin'), hidden: Boolean(currentClassId) },
          { label: 'Mark as left', onSelect: () => setOpen('leave'), hidden: !currentClassId },
          { label: 'Delete record', onSelect: () => setOpen('delete'), danger: true },
        ]}
      />
      {open === 'edit' ? <EditChildDialog student={student} onClose={close} /> : null}
      <ChildParentsDialog student={student} open={open === 'parents'} onClose={close} />
      {open === 'move' || open === 'rejoin' ? (
        <ChangeClassDialog
          student={student}
          schoolId={schoolId}
          mode={open}
          currentClassId={currentClassId ?? undefined}
          onClose={close}
        />
      ) : null}
      <ConfirmDialog
        open={open === 'leave'}
        title={`${name} has left`}
        confirmLabel="Mark as left"
        busy={leave.isPending}
        error={leave.error}
        onClose={close}
        onConfirm={() => leave.mutate(undefined, { onSuccess: close })}
      >
        <p>
          {name} leaves the class today. Their parents can no longer use the student app, unless they have
          another child in a class. The record stays, so the child can come back later.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={open === 'delete'}
        title={`Delete ${name}'s record`}
        confirmLabel="Delete for good"
        danger
        busy={remove.isPending}
        error={remove.error}
        onClose={close}
        onConfirm={() => remove.mutate(undefined, { onSuccess: close })}
      >
        <p>
          This deletes {name}&apos;s record, parent links and Show &amp; Share results for good. Use it when a
          parent asks for deletion; otherwise mark the child as left.
        </p>
      </ConfirmDialog>
    </>
  );
}
