'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Badge } from '@little-ants/ui/badge';
import { Button } from '@little-ants/ui/button';
import { Card, EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { Field, TextInput } from '@little-ants/ui/field';
import { AdminOnly } from '../../../components/admin-only';
import { FormError } from '../../../components/form-error';
import { PageHeader } from '../../../components/page-header';
import { api } from '../../../lib/api';
import { fieldErrors, useApiMutation } from '../../../lib/hooks';
import { SCHOOLS_KEY, useCurrentSchool } from '../../../lib/school';
import type { School } from '../../../lib/types';

export default function SchoolsPage() {
  return (
    <AdminOnly>
      <Schools />
    </AdminOnly>
  );
}

function Schools() {
  const query = useQuery({ queryKey: SCHOOLS_KEY, queryFn: () => api.get<School[]>('/schools') });
  return (
    <div>
      <PageHeader title="Schools">
        Partner schools using Little Ants. Each school runs its own campuses, classes and staff.
      </PageHeader>
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div>
          {query.isPending ? <Spinner label="Loading schools" /> : null}
          {query.error ? <ErrorNotice error={query.error} /> : null}
          {query.data?.length === 0 ? <EmptyState title="No schools yet" /> : null}
          {query.data?.length ? (
            <Card className="overflow-x-auto p-0">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="bg-cream-100 text-left text-xs uppercase tracking-wide text-bark-500">
                  <tr>
                    <th className="px-4 py-2">School</th>
                    <th className="px-4 py-2">Campuses</th>
                    <th className="px-4 py-2">Staff</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.map((school) => (
                    <SchoolRow key={school.id} school={school} />
                  ))}
                </tbody>
              </table>
            </Card>
          ) : null}
        </div>
        <NewSchool />
      </div>
    </div>
  );
}

function SchoolRow({ school }: { school: School }) {
  const router = useRouter();
  const { setSchoolId } = useCurrentSchool();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(school.name);
  const update = useApiMutation(
    (data: { name?: string; active?: boolean }) => api.patch<School>(`/schools/${school.id}`, data),
    [SCHOOLS_KEY],
  );

  function rename(event: FormEvent): void {
    event.preventDefault();
    update.mutate({ name }, { onSuccess: () => setEditing(false) });
  }

  function toggleActive(): void {
    if (
      school.active &&
      !window.confirm(
        `Deactivate ${school.name}? Its staff lose access to the school until it is activated again.`,
      )
    )
      return;
    update.mutate({ active: !school.active });
  }

  function openPage(href: string): void {
    setSchoolId(school.id);
    router.push(href);
  }

  return (
    <tr className="border-t border-cream-200 align-top">
      <td className="px-4 py-3">
        {editing ? (
          <form onSubmit={rename} className="flex flex-wrap items-center gap-2">
            <TextInput
              aria-label="School name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-56"
            />
            <Button type="submit" size="sm" busy={update.isPending}>
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setName(school.name);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{school.name}</span>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Rename
            </Button>
          </span>
        )}
        <FormError error={update.error} />
      </td>
      <td className="px-4 py-3">{school._count.campuses}</td>
      <td className="px-4 py-3">{school._count.staff}</td>
      <td className="px-4 py-3">
        {school.active ? <Badge tone="leaf">Active</Badge> : <Badge tone="bark">Inactive</Badge>}
        <Button
          size="sm"
          variant={school.active ? 'danger' : 'secondary'}
          className="mt-2 block"
          busy={update.isPending}
          onClick={toggleActive}
        >
          {school.active ? 'Deactivate' : 'Activate'}
        </Button>
      </td>
      <td className="px-4 py-3">
        <span className="flex flex-wrap gap-1">
          <Button size="sm" variant="secondary" onClick={() => openPage('/classes')}>
            Classes
          </Button>
          <Button size="sm" variant="secondary" onClick={() => openPage('/school-staff')}>
            Staff
          </Button>
        </span>
      </td>
    </tr>
  );
}

function NewSchool() {
  const [name, setName] = useState('');
  const create = useApiMutation(() => api.post<School>('/schools', { name }), [SCHOOLS_KEY]);
  const errors = fieldErrors(create.error);

  function submit(event: FormEvent): void {
    event.preventDefault();
    create.mutate(undefined, { onSuccess: () => setName('') });
  }

  return (
    <Card className="self-start">
      <h2 className="mb-3 font-bold">Add a school</h2>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="School name" error={errors.name}>
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>
        <Button type="submit" busy={create.isPending}>
          Add school
        </Button>
        {create.isSuccess ? (
          <p role="status" className="text-sm text-leaf-700">
            Added. Next, add its school admin on the School staff page.
          </p>
        ) : null}
        <FormError error={create.error} />
      </form>
    </Card>
  );
}
