'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@little-ants/ui/badge';
import { Button } from '@little-ants/ui/button';
import { EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { Field, Select, TextInput } from '@little-ants/ui/field';
import { ConfirmDialog } from '../../../components/confirm-dialog';
import { DataTable, ListCount, Toolbar, type Column } from '../../../components/data-table';
import { FormDialog } from '../../../components/form-dialog';
import { PageHeader } from '../../../components/page-header';
import { RowMenu } from '../../../components/row-menu';
import { SchoolPage } from '../../../components/school-only';
import { SchoolSelect } from '../../../components/school-select';
import { api } from '../../../lib/api';
import { fieldErrors, useApiMutation } from '../../../lib/hooks';
import { orgKeys, useCampuses, useSchoolClasses } from '../../../lib/org';
import { SCHOOLS_KEY } from '../../../lib/school';
import type { Campus, School } from '../../../lib/types';

export default function CampusesPage() {
  return <SchoolPage>{(school) => <Campuses key={school.id} school={school} />}</SchoolPage>;
}

type Status = 'open' | 'closed' | 'all';

function Campuses({ school }: { school: School }) {
  const campuses = useCampuses(school.id);
  const classes = useSchoolClasses(school.id, 'ACTIVE');
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Status>('open');

  const classCount = new Map<string, number>();
  for (const item of classes.data ?? [])
    classCount.set(item.campus.id, (classCount.get(item.campus.id) ?? 0) + 1);
  const all = campuses.data ?? [];
  const term = search.trim().toLowerCase();
  const shown = all.filter(
    (campus) =>
      (!term || `${campus.name} ${campus.address}`.toLowerCase().includes(term)) &&
      (status === 'all' || (status === 'open') === campus.active),
  );

  const columns: Column<Campus>[] = [
    {
      header: 'Campus',
      cell: (campus) => <span className="font-semibold text-bark-900">{campus.name}</span>,
    },
    { header: 'Address', cell: (campus) => campus.address || '—' },
    {
      header: 'Active classes',
      cell: (campus) => {
        const count = classCount.get(campus.id) ?? 0;
        return count ? (
          <Link href={`/classes?campus=${campus.id}`} className="font-semibold text-leaf-700 hover:underline">
            {count}
          </Link>
        ) : (
          '—'
        );
      },
    },
    {
      header: 'Status',
      cell: (campus) => (campus.active ? <Badge tone="leaf">Open</Badge> : <Badge tone="bark">Closed</Badge>),
    },
  ];

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
        <>
          <Toolbar>
            <SchoolSelect />
            <TextInput
              type="search"
              aria-label="Search campuses"
              placeholder="Search name or address"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select
              aria-label="Status"
              value={status}
              onChange={(event) => setStatus(event.target.value as Status)}
            >
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="all">All campuses</option>
            </Select>
          </Toolbar>
          <ListCount shown={shown.length} total={all.length} noun="campuses" />
          <DataTable
            label="Campuses"
            columns={columns}
            rows={shown}
            rowKey={(campus) => campus.id}
            muted={(campus) => !campus.active}
            minWidth="36rem"
            empty={
              all.length === 0 ? (
                <EmptyState title="No campuses yet">Add the first campus before creating classes.</EmptyState>
              ) : (
                'No campus matches these filters'
              )
            }
            actions={(campus) => <CampusActions schoolId={school.id} campus={campus} />}
          />
        </>
      ) : null}
      {adding ? <CampusDialog schoolId={school.id} onClose={() => setAdding(false)} /> : null}
    </div>
  );
}

function campusKeys(schoolId: string) {
  return [orgKeys.campuses(schoolId), orgKeys.allClasses, SCHOOLS_KEY];
}

function CampusActions({ schoolId, campus }: { schoolId: string; campus: Campus }) {
  const router = useRouter();
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
          { label: 'View classes', onSelect: () => router.push(`/classes?campus=${campus.id}`) },
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
