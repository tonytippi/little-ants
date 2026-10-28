'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@little-ants/ui/button';
import { Card, EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { api } from '../../lib/api';
import { useApiMutation } from '../../lib/hooks';
import { orgKeys, useSchoolStaff } from '../../lib/org';
import type { ClassDetail } from '../../lib/types';
import { FormError } from '../form-error';

const sameIds = (a: string[], b: string[]): boolean => a.slice().sort().join() === b.slice().sort().join();

/** Teachers of a class, chosen among the people who work at its school. */
export function TeachersCard({ klass }: { klass: ClassDetail }) {
  const assigned = klass.teachers.map((item) => item.user.id);
  if (klass.status !== 'ACTIVE')
    return (
      <Card>
        <h2 className="mb-3 font-bold">Teachers</h2>
        <p className="text-sm text-bark-500">
          {klass.teachers.map((item) => item.user.name).join(', ') || 'No teachers'}
        </p>
      </Card>
    );
  return <TeacherPicker key={assigned.join()} klass={klass} assigned={assigned} />;
}

function TeacherPicker({ klass, assigned }: { klass: ClassDetail; assigned: string[] }) {
  const schoolId = klass.campus.school.id;
  const staff = useSchoolStaff(schoolId);
  const [chosen, setChosen] = useState(assigned);
  const save = useApiMutation(
    () => api.put(`/classes/${klass.id}/teachers`, { userIds: chosen }),
    [orgKeys.class(klass.id), orgKeys.allClasses, orgKeys.schoolStaff(schoolId)],
  );
  const members =
    staff.data?.members.filter((member) => member.user.active || chosen.includes(member.user.id)) ?? [];

  return (
    <Card>
      <h2 className="mb-3 font-bold">Teachers</h2>
      {staff.isPending ? <Spinner label="Loading school staff" /> : null}
      {staff.error ? <ErrorNotice error={staff.error} /> : null}
      {staff.data && members.length === 0 ? (
        <EmptyState title="No school staff yet">
          Add teachers on the{' '}
          <Link href="/school-staff" className="font-semibold text-leaf-700 hover:underline">
            School staff
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
      {sameIds(chosen, assigned) ? null : (
        <Button size="sm" className="mt-3" busy={save.isPending} onClick={() => save.mutate(undefined)}>
          Save teachers
        </Button>
      )}
      <FormError error={save.error} />
    </Card>
  );
}
