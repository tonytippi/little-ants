'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Badge } from '@little-ants/ui/badge';
import { Button } from '@little-ants/ui/button';
import { Card, EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { TextInput } from '@little-ants/ui/field';
import { AdminOnly } from '../../../components/admin-only';
import { ClassForm } from '../../../components/classes/class-form';
import { FormError } from '../../../components/form-error';
import { PageHeader } from '../../../components/page-header';
import { api } from '../../../lib/api';
import { useApiMutation } from '../../../lib/hooks';
import type { Campus, ClassSummary, LevelOption } from '../../../lib/types';

export default function ClassesPage() {
  return (
    <AdminOnly>
      <Classes />
    </AdminOnly>
  );
}

function Classes() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const campuses = useQuery({ queryKey: ['campuses'], queryFn: () => api.get<Campus[]>('/campuses') });
  const levels = useQuery({ queryKey: ['levels'], queryFn: () => api.get<LevelOption[]>('/levels') });
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => api.get<ClassSummary[]>('/classes') });
  const create = useApiMutation((values: object) => api.post<{ id: string }>('/classes', values), [['classes']]);

  if (campuses.isPending || levels.isPending || classes.isPending) return <Spinner label="Loading classes" />;
  const error = campuses.error ?? levels.error ?? classes.error;
  if (error) return <ErrorNotice error={error} />;
  const showCampus = campuses.data!.length > 1;

  return (
    <div>
      <PageHeader
        title="Classes"
        actions={
          campuses.data!.length ? (
            <Button onClick={() => setCreating((value) => !value)} variant={creating ? 'secondary' : 'primary'}>
              {creating ? 'Close' : '+ New class'}
            </Button>
          ) : null
        }
      >
        Classes, their teachers and children. Children&apos;s records hold a display name and birth year only.
      </PageHeader>

      {campuses.data!.length === 0 ? (
        <Card className="mb-6">
          <h2 className="mb-2 font-bold">First, add your campus</h2>
          <CampusForm />
        </Card>
      ) : null}

      {creating ? (
        <Card className="mb-6">
          <h2 className="mb-4 font-bold">New class</h2>
          <ClassForm
            campuses={campuses.data!}
            levels={levels.data!}
            submitLabel="Create class"
            busy={create.isPending}
            error={create.error}
            onSubmit={(values) => create.mutate(values, { onSuccess: (created) => router.push(`/classes/${created.id}`) })}
          />
        </Card>
      ) : null}

      {classes.data!.length === 0 ? (
        <EmptyState title="No classes yet" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="bg-cream-100 text-left text-xs uppercase tracking-wide text-bark-500">
              <tr>
                <th className="px-4 py-2">Class</th>
                {showCampus ? <th className="px-4 py-2">Campus</th> : null}
                <th className="px-4 py-2">Level</th>
                <th className="px-4 py-2">Now teaching</th>
                <th className="px-4 py-2">Teachers</th>
                <th className="px-4 py-2">Children</th>
              </tr>
            </thead>
            <tbody>
              {classes.data!.map((item) => (
                <tr key={item.id} className="border-t border-cream-200">
                  <td className="px-4 py-3">
                    <Link href={`/classes/${item.id}`} className="font-semibold text-leaf-700 hover:underline">
                      {item.name}
                    </Link>
                    <span className="block text-xs text-bark-500">
                      {item.schoolYear} {item.active ? null : <Badge tone="bark">inactive</Badge>}
                    </span>
                  </td>
                  {showCampus ? <td className="px-4 py-3">{item.campus.name}</td> : null}
                  <td className="px-4 py-3">
                    {item.level.number} · {item.level.name}
                  </td>
                  <td className="px-4 py-3">{item.currentUnit ? `${item.currentUnit.code} · lesson ${item.nextLesson}` : '—'}</td>
                  <td className="px-4 py-3 text-bark-500">{item.teachers.map((teacher) => teacher.user.name).join(', ') || '—'}</td>
                  <td className="px-4 py-3">{item._count?.students ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {campuses.data!.length ? (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-semibold text-bark-700">Campuses ({campuses.data!.length})</summary>
          <Card className="mt-3">
            <ul className="mb-4 text-sm">
              {campuses.data!.map((campus) => (
                <li key={campus.id}>
                  {campus.name}
                  {campus.address ? <span className="text-bark-500"> · {campus.address}</span> : null}
                </li>
              ))}
            </ul>
            <CampusForm />
          </Card>
        </details>
      ) : null}
    </div>
  );
}

function CampusForm() {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const create = useApiMutation(() => api.post('/campuses', { name, address }), [['campuses']]);
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
      <TextInput aria-label="Campus name" placeholder="Campus name" required value={name} onChange={(event) => setName(event.target.value)} className="w-56" />
      <TextInput aria-label="Address" placeholder="Address (optional)" value={address} onChange={(event) => setAddress(event.target.value)} className="w-72" />
      <Button type="submit" variant="secondary" busy={create.isPending}>
        Add campus
      </Button>
      <div className="w-full">
        <FormError error={create.error} />
      </div>
    </form>
  );
}
