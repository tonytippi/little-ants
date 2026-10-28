'use client';

import { useState, type FormEvent } from 'react';
import { Badge } from '@little-ants/ui/badge';
import { Button } from '@little-ants/ui/button';
import { Card, EmptyState } from '@little-ants/ui/feedback';
import { TextInput } from '@little-ants/ui/field';
import { api } from '../../lib/api';
import { useApiMutation } from '../../lib/hooks';
import { orgKeys } from '../../lib/org';
import type { Campus } from '../../lib/types';
import { FormError } from '../form-error';

/** A school's campuses: list, rename and add. */
export function CampusesCard({ schoolId, campuses }: { schoolId: string; campuses: Campus[] }) {
  return (
    <Card>
      <h2 className="mb-3 font-bold">Campuses ({campuses.length})</h2>
      {campuses.length === 0 ? (
        <EmptyState title="No campuses yet">Add the first campus before creating classes.</EmptyState>
      ) : (
        <ul className="mb-4 divide-y divide-cream-200">
          {campuses.map((campus) => (
            <CampusRow key={campus.id} schoolId={schoolId} campus={campus} />
          ))}
        </ul>
      )}
      <CampusForm schoolId={schoolId} />
    </Card>
  );
}

function CampusRow({ schoolId, campus }: { schoolId: string; campus: Campus }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(campus.name);
  const [address, setAddress] = useState(campus.address);
  const update = useApiMutation(
    () => api.patch<Campus>(`/schools/${schoolId}/campuses/${campus.id}`, { name, address }),
    [orgKeys.campuses(schoolId), orgKeys.allClasses],
  );

  function submit(event: FormEvent): void {
    event.preventDefault();
    update.mutate(undefined, { onSuccess: () => setEditing(false) });
  }

  if (editing)
    return (
      <li className="py-2">
        <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
          <TextInput
            aria-label="Campus name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-48"
          />
          <TextInput
            aria-label="Address"
            placeholder="Address (optional)"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            className="w-64"
          />
          <Button type="submit" size="sm" busy={update.isPending}>
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setName(campus.name);
              setAddress(campus.address);
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </form>
        <FormError error={update.error} />
      </li>
    );

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <span>
        <span className="font-semibold">{campus.name}</span>
        {campus.address ? <span className="text-bark-500"> · {campus.address}</span> : null}{' '}
        {campus.active ? null : <Badge tone="bark">inactive</Badge>}
      </span>
      <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
        Rename
      </Button>
    </li>
  );
}

function CampusForm({ schoolId }: { schoolId: string }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const create = useApiMutation(
    () => api.post<Campus>(`/schools/${schoolId}/campuses`, { name, address }),
    [orgKeys.campuses(schoolId)],
  );

  function submit(event: FormEvent): void {
    event.preventDefault();
    create.mutate(undefined, {
      onSuccess: () => {
        setName('');
        setAddress('');
      },
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <TextInput
        aria-label="New campus name"
        placeholder="Campus name"
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="w-56"
      />
      <TextInput
        aria-label="New campus address"
        placeholder="Address (optional)"
        value={address}
        onChange={(event) => setAddress(event.target.value)}
        className="w-72"
      />
      <Button type="submit" variant="secondary" busy={create.isPending}>
        Add campus
      </Button>
      <div className="w-full">
        <FormError error={create.error} />
      </div>
    </form>
  );
}
