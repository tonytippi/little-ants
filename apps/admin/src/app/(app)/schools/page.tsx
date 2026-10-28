'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@little-ants/ui/badge';
import { Button } from '@little-ants/ui/button';
import { EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { Field, TextInput } from '@little-ants/ui/field';
import { AdminOnly } from '../../../components/admin-only';
import { ConfirmDialog } from '../../../components/confirm-dialog';
import { DataTable, type Column } from '../../../components/data-table';
import { FormDialog } from '../../../components/form-dialog';
import { PageHeader } from '../../../components/page-header';
import { RowMenu } from '../../../components/row-menu';
import { api } from '../../../lib/api';
import { fieldErrors, formatDate, useApiMutation } from '../../../lib/hooks';
import { SCHOOLS_KEY, useCurrentSchool } from '../../../lib/school';
import type { School } from '../../../lib/types';

export default function SchoolsPage() {
  return (
    <AdminOnly>
      <Schools />
    </AdminOnly>
  );
}

const COLUMNS: Column<School>[] = [
  { header: 'School', cell: (school) => <span className="font-semibold text-bark-900">{school.name}</span> },
  { header: 'Campuses', cell: (school) => school._count.campuses },
  { header: 'Staff', cell: (school) => school._count.staff },
  {
    header: 'Status',
    cell: (school) =>
      school.active ? <Badge tone="leaf">Active</Badge> : <Badge tone="bark">Inactive</Badge>,
  },
  { header: 'Added', cell: (school) => <span className="text-xs">{formatDate(school.createdAt)}</span> },
];

function Schools() {
  const query = useQuery({ queryKey: SCHOOLS_KEY, queryFn: () => api.get<School[]>('/schools') });
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <PageHeader title="Schools" actions={<Button onClick={() => setAdding(true)}>+ Add school</Button>}>
        Partner schools using Little Ants. Each school runs its own campuses, classes and staff.
      </PageHeader>
      {query.isPending ? <Spinner label="Loading schools" /> : null}
      {query.error ? <ErrorNotice error={query.error} /> : null}
      {query.data ? (
        <DataTable
          label="Schools"
          columns={COLUMNS}
          rows={query.data}
          rowKey={(school) => school.id}
          muted={(school) => !school.active}
          empty={
            <EmptyState title="No schools yet">Add the first partner school with “+ Add school”.</EmptyState>
          }
          actions={(school) => <SchoolActions school={school} />}
        />
      ) : null}
      {adding ? <SchoolDialog onClose={() => setAdding(false)} /> : null}
    </div>
  );
}

function SchoolActions({ school }: { school: School }) {
  const router = useRouter();
  const { setSchoolId } = useCurrentSchool();
  const [open, setOpen] = useState<'edit' | 'deactivate' | null>(null);
  const toggle = useApiMutation(
    (active: boolean) => api.patch<School>(`/schools/${school.id}`, { active }),
    [SCHOOLS_KEY],
  );

  function openPage(href: string): void {
    setSchoolId(school.id);
    router.push(href);
  }

  return (
    <>
      <RowMenu
        label={`Actions for ${school.name}`}
        actions={[
          { label: 'Edit', onSelect: () => setOpen('edit') },
          { label: 'Open classes', onSelect: () => openPage('/classes') },
          { label: 'Open school staff', onSelect: () => openPage('/school-staff') },
          { label: 'Activate', onSelect: () => toggle.mutate(true), hidden: school.active },
          {
            label: 'Deactivate',
            onSelect: () => setOpen('deactivate'),
            danger: true,
            hidden: !school.active,
          },
        ]}
      />
      {open === 'edit' ? <SchoolDialog school={school} onClose={() => setOpen(null)} /> : null}
      <ConfirmDialog
        open={open === 'deactivate'}
        title={`Deactivate ${school.name}`}
        confirmLabel="Deactivate"
        danger
        busy={toggle.isPending}
        error={toggle.error}
        onClose={() => setOpen(null)}
        onConfirm={() => toggle.mutate(false, { onSuccess: () => setOpen(null) })}
      >
        <p>
          Its staff lose access to the school and its parents can no longer use the student app, until the
          school is activated again. Nothing is deleted.
        </p>
      </ConfirmDialog>
    </>
  );
}

/** Add a school, or rename one when `school` is given. */
function SchoolDialog({ school, onClose }: { school?: School; onClose: () => void }) {
  const [name, setName] = useState(school?.name ?? '');
  const save = useApiMutation(
    () =>
      school ? api.patch<School>(`/schools/${school.id}`, { name }) : api.post<School>('/schools', { name }),
    [SCHOOLS_KEY],
  );
  const errors = fieldErrors(save.error);

  return (
    <FormDialog
      open
      title={school ? `Edit ${school.name}` : 'Add a school'}
      submitLabel={school ? 'Save' : 'Add school'}
      busy={save.isPending}
      error={save.error}
      onClose={onClose}
      onSubmit={() => save.mutate(undefined, { onSuccess: onClose })}
    >
      <Field
        label="School name"
        hint={school ? undefined : 'Next, add its campuses and its school admin on the School staff page.'}
        error={errors.name}
      >
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
    </FormDialog>
  );
}
