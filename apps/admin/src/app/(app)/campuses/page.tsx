'use client';

import { useState } from 'react';
import { Badge } from '@little-ants/ui/badge';
import { Button } from '@little-ants/ui/button';
import { EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { Field, TextInput } from '@little-ants/ui/field';
import { ConfirmDialog } from '../../../components/confirm-dialog';
import { DataTable, type Column } from '../../../components/data-table';
import { FormDialog } from '../../../components/form-dialog';
import { PageHeader } from '../../../components/page-header';
import { RowMenu } from '../../../components/row-menu';
import { SchoolPage } from '../../../components/school-only';
import { api } from '../../../lib/api';
import { fieldErrors, useApiMutation } from '../../../lib/hooks';
import { orgKeys, useCampuses } from '../../../lib/org';
import { SCHOOLS_KEY } from '../../../lib/school';
import type { Campus, School } from '../../../lib/types';

export default function CampusesPage() {
  return <SchoolPage>{(school) => <Campuses key={school.id} school={school} />}</SchoolPage>;
}

const COLUMNS: Column<Campus>[] = [
  { header: 'Campus', cell: (campus) => <span className="font-semibold text-bark-900">{campus.name}</span> },
  { header: 'Address', cell: (campus) => campus.address || '—' },
  {
    header: 'Status',
    cell: (campus) => (campus.active ? <Badge tone="leaf">Active</Badge> : <Badge tone="bark">Closed</Badge>),
  },
];

function Campuses({ school }: { school: School }) {
  const campuses = useCampuses(school.id);
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <PageHeader
        eyebrow={school.name}
        title="Campuses"
        actions={<Button onClick={() => setAdding(true)}>+ Add campus</Button>}
      >
        The places where this school teaches. Every class belongs to a campus.
      </PageHeader>
      {campuses.isPending ? <Spinner label="Loading campuses" /> : null}
      {campuses.error ? <ErrorNotice error={campuses.error} /> : null}
      {campuses.data ? (
        <DataTable
          label="Campuses"
          columns={COLUMNS}
          rows={campuses.data}
          rowKey={(campus) => campus.id}
          muted={(campus) => !campus.active}
          minWidth="32rem"
          empty={
            <EmptyState title="No campuses yet">Add the first campus before creating classes.</EmptyState>
          }
          actions={(campus) => <CampusActions schoolId={school.id} campus={campus} />}
        />
      ) : null}
      {adding ? <CampusDialog schoolId={school.id} onClose={() => setAdding(false)} /> : null}
    </div>
  );
}

function campusKeys(schoolId: string) {
  return [orgKeys.campuses(schoolId), orgKeys.allClasses, SCHOOLS_KEY];
}

function CampusActions({ schoolId, campus }: { schoolId: string; campus: Campus }) {
  const [open, setOpen] = useState<'edit' | 'close' | null>(null);
  const toggle = useApiMutation(
    (active: boolean) => api.patch<Campus>(`/schools/${schoolId}/campuses/${campus.id}`, { active }),
    campusKeys(schoolId),
  );
  return (
    <>
      <RowMenu
        label={`Actions for ${campus.name}`}
        actions={[
          { label: 'Edit', onSelect: () => setOpen('edit') },
          { label: 'Reopen', onSelect: () => toggle.mutate(true), hidden: campus.active },
          { label: 'Close campus', onSelect: () => setOpen('close'), danger: true, hidden: !campus.active },
        ]}
      />
      {open === 'edit' ? (
        <CampusDialog schoolId={schoolId} campus={campus} onClose={() => setOpen(null)} />
      ) : null}
      <ConfirmDialog
        open={open === 'close'}
        title={`Close ${campus.name}`}
        confirmLabel="Close campus"
        danger
        busy={toggle.isPending}
        error={toggle.error}
        onClose={() => setOpen(null)}
        onConfirm={() => toggle.mutate(false, { onSuccess: () => setOpen(null) })}
      >
        <p>New classes can no longer be created at this campus. Its classes and records stay as they are.</p>
      </ConfirmDialog>
    </>
  );
}

/** Add a campus, or edit one when `campus` is given. */
function CampusDialog({
  schoolId,
  campus,
  onClose,
}: {
  schoolId: string;
  campus?: Campus;
  onClose: () => void;
}) {
  const [name, setName] = useState(campus?.name ?? '');
  const [address, setAddress] = useState(campus?.address ?? '');
  const save = useApiMutation(
    () =>
      campus
        ? api.patch<Campus>(`/schools/${schoolId}/campuses/${campus.id}`, { name, address })
        : api.post<Campus>(`/schools/${schoolId}/campuses`, { name, address }),
    campusKeys(schoolId),
  );
  const errors = fieldErrors(save.error);

  return (
    <FormDialog
      open
      title={campus ? `Edit ${campus.name}` : 'Add a campus'}
      submitLabel={campus ? 'Save' : 'Add campus'}
      busy={save.isPending}
      error={save.error}
      onClose={onClose}
      onSubmit={() => save.mutate(undefined, { onSuccess: onClose })}
    >
      <Field label="Campus name" error={errors.name}>
        {(id, describedBy) => (
          <TextInput
            id={id}
            aria-describedby={describedBy}
            required
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        )}
      </Field>
      <Field label="Address (optional)" error={errors.address}>
        {(id, describedBy) => (
          <TextInput
            id={id}
            aria-describedby={describedBy}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
        )}
      </Field>
    </FormDialog>
  );
}
