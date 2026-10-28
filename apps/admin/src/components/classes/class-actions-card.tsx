'use client';

import { useState } from 'react';
import { Button } from '@little-ants/ui/button';
import { Card, ErrorNotice } from '@little-ants/ui/feedback';
import { Field, Select } from '@little-ants/ui/field';
import { api } from '../../lib/api';
import { useApiMutation } from '../../lib/hooks';
import { orgKeys, useSchoolClasses } from '../../lib/org';
import type { ClassDetail } from '../../lib/types';
import { ConfirmDialog } from '../confirm-dialog';

const childrenText = (count: number): string => (count === 1 ? '1 child' : `${count} children`);

/** Ending a class: merge its children into another class of the school, or stop it. */
export function ClassActionsCard({ klass }: { klass: ClassDetail }) {
  const childCount = klass.enrollments.filter((enrollment) => !enrollment.endedOn).length;
  return (
    <Card>
      <h2 className="mb-3 font-bold">End this class</h2>
      <div className="flex flex-col gap-4">
        <MergeClass klass={klass} childCount={childCount} />
        <StopClass klass={klass} childCount={childCount} />
      </div>
    </Card>
  );
}

function MergeClass({ klass, childCount }: { klass: ClassDetail; childCount: number }) {
  const classes = useSchoolClasses(klass.campus.school.id, 'ACTIVE');
  const [targetId, setTargetId] = useState('');
  const [open, setOpen] = useState(false);
  const merge = useApiMutation(
    () => api.post<{ moved: number }>(`/classes/${klass.id}/merge`, { targetClassId: targetId }),
    [orgKeys.allClassDetails, orgKeys.allClasses, orgKeys.schoolStaff(klass.campus.school.id)],
  );
  const targets = classes.data?.filter((item) => item.id !== klass.id) ?? [];
  const target = targets.find((item) => item.id === targetId);

  function close(): void {
    setOpen(false);
    merge.reset();
  }

  return (
    <div>
      <Field label="Merge into…" hint="Its children move to the other class and this class ends.">
        {(id, describedBy) => (
          <div className="flex flex-wrap gap-2">
            <Select
              id={id}
              aria-describedby={describedBy}
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              className="min-w-0 flex-1"
            >
              <option value="">Choose a class</option>
              {targets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.campus.name} · {item.schoolYear}
                </option>
              ))}
            </Select>
            <Button variant="secondary" disabled={!target} onClick={() => setOpen(true)}>
              Merge
            </Button>
          </div>
        )}
      </Field>
      {classes.error ? <ErrorNotice error={classes.error} /> : null}
      <ConfirmDialog
        open={open && !!target}
        title={`Merge ${klass.name} into ${target?.name ?? ''}`}
        confirmLabel="Merge classes"
        busy={merge.isPending}
        error={merge.error}
        danger
        onClose={close}
        onConfirm={() => merge.mutate(undefined, { onSuccess: close })}
      >
        <p>
          <strong>{childrenText(childCount)}</strong> {childCount === 1 ? 'moves' : 'move'} from {klass.name}{' '}
          to {target?.name} today. {klass.name} ends and stays in the history as merged.
        </p>
        <p>This cannot be undone.</p>
      </ConfirmDialog>
    </div>
  );
}

function StopClass({ klass, childCount }: { klass: ClassDetail; childCount: number }) {
  const [open, setOpen] = useState(false);
  const stop = useApiMutation(
    () => api.post<{ ended: number }>(`/classes/${klass.id}/stop`, {}),
    [orgKeys.class(klass.id), orgKeys.allClasses, orgKeys.schoolStaff(klass.campus.school.id)],
  );

  function close(): void {
    setOpen(false);
    stop.reset();
  }

  return (
    <div>
      <p className="mb-2 text-sm text-bark-500">
        Stop the class when it does not go on, for example at year end.
      </p>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Stop class
      </Button>
      <ConfirmDialog
        open={open}
        title={`Stop ${klass.name}`}
        confirmLabel="Stop class"
        busy={stop.isPending}
        error={stop.error}
        danger
        onClose={close}
        onConfirm={() => stop.mutate(undefined, { onSuccess: close })}
      >
        <p>
          The class ends today and its <strong>{childrenText(childCount)}</strong>{' '}
          {childCount === 1 ? 'leaves' : 'leave'} it. Children without a class lose access to the student app
          until they join another class.
        </p>
        <p>This cannot be undone.</p>
      </ConfirmDialog>
    </div>
  );
}
