'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { SCHOOL_ROLES } from '@little-ants/shared';
import { Badge } from '@little-ants/ui/badge';
import { Button } from '@little-ants/ui/button';
import { Card, EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { Field, Select, TextInput } from '@little-ants/ui/field';
import { FormError } from '../../../components/form-error';
import { PageHeader } from '../../../components/page-header';
import { SchoolPage } from '../../../components/school-only';
import { api } from '../../../lib/api';
import { fieldErrors, formatDate, useApiMutation } from '../../../lib/hooks';
import { orgKeys, useSchoolStaff } from '../../../lib/org';
import { SCHOOLS_KEY } from '../../../lib/school';
import { useMe } from '../../../lib/session';
import type { School, SchoolInvite, SchoolRole, SchoolStaffMember } from '../../../lib/types';

const ROLE_LABEL: Record<SchoolRole, string> = {
  SCHOOL_ADMIN: 'School admin',
  TEACHER: 'Teacher',
};

const ROLE_HELP: Record<SchoolRole, string> = {
  SCHOOL_ADMIN: 'runs campuses, classes, children and staff of the school, and can teach',
  TEACHER: 'teaches the classes they are assigned to with the Teacher app',
};

export default function SchoolStaffPage() {
  return <SchoolPage>{(school) => <SchoolStaffView key={school.id} school={school} />}</SchoolPage>;
}

function SchoolStaffView({ school }: { school: School }) {
  const staff = useSchoolStaff(school.id);
  return (
    <div>
      <PageHeader eyebrow={school.name} title="School staff">
        Teachers and school admins of this school sign in with Google. Add their email; someone without an
        account gets an invite.
      </PageHeader>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          {staff.isPending ? <Spinner label="Loading school staff" /> : null}
          {staff.error ? <ErrorNotice error={staff.error} /> : null}
          {staff.data ? <Members schoolId={school.id} members={staff.data.members} /> : null}
          {staff.data ? <Invites schoolId={school.id} invites={staff.data.invites} /> : null}
        </div>
        <AddStaff schoolId={school.id} />
      </div>
    </div>
  );
}

function Members({ schoolId, members }: { schoolId: string; members: SchoolStaffMember[] }) {
  if (members.length === 0)
    return <EmptyState title="No staff yet">Add the first teacher by email.</EmptyState>;
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[40rem] text-sm">
        <thead className="bg-cream-100 text-left text-xs uppercase tracking-wide text-bark-500">
          <tr>
            <th className="px-4 py-2">Person</th>
            <th className="px-4 py-2">Role</th>
            <th className="px-4 py-2">Classes</th>
            <th className="px-4 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <MemberRow key={member.user.id} schoolId={schoolId} member={member} />
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function MemberRow({ schoolId, member }: { schoolId: string; member: SchoolStaffMember }) {
  const me = useMe();
  const { user } = member;
  const isMe = user.id === me.user.id;
  const keys = [orgKeys.schoolStaff(schoolId), orgKeys.allClasses, orgKeys.allClassDetails, SCHOOLS_KEY];
  const update = useApiMutation(
    (role: SchoolRole) => api.patch(`/schools/${schoolId}/staff/${user.id}`, { role }),
    keys,
  );
  const remove = useApiMutation(() => api.del(`/schools/${schoolId}/staff/${user.id}`), keys);

  return (
    <tr className="border-t border-cream-200 align-top">
      <td className="px-4 py-3">
        <p className="font-semibold">
          {user.name} {isMe ? <Badge>you</Badge> : null}{' '}
          {user.active ? null : <Badge tone="bark">account turned off</Badge>}
        </p>
        <p className="text-xs text-bark-500">{user.email}</p>
      </td>
      <td className="px-4 py-3">
        <Select
          aria-label={`Role of ${user.name}`}
          value={member.role}
          disabled={update.isPending}
          onChange={(event) => {
            const role = SCHOOL_ROLES.find((value) => value === event.target.value);
            if (role) update.mutate(role);
          }}
          className="w-40"
        >
          {SCHOOL_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABEL[role]}
            </option>
          ))}
        </Select>
        <FormError error={update.error} />
      </td>
      <td className="px-4 py-3 text-xs">
        {user.assignments.length
          ? user.assignments.map((item, index) => (
              <span key={item.class.id}>
                {index > 0 ? ', ' : null}
                <Link href={`/classes/${item.class.id}`} className="text-leaf-700 hover:underline">
                  {item.class.name}
                </Link>
              </span>
            ))
          : '—'}
      </td>
      <td className="px-4 py-3">
        <Button
          size="sm"
          variant="danger"
          busy={remove.isPending}
          onClick={() =>
            window.confirm(
              `Remove ${user.name} from the school? They stop teaching its classes and lose access to it.`,
            ) && remove.mutate(undefined)
          }
        >
          Remove
        </Button>
        <FormError error={remove.error} />
      </td>
    </tr>
  );
}

function Invites({ schoolId, invites }: { schoolId: string; invites: SchoolInvite[] }) {
  const cancel = useApiMutation(
    (id: string) => api.del(`/schools/${schoolId}/invites/${id}`),
    [orgKeys.schoolStaff(schoolId)],
  );
  return (
    <Card>
      <h2 className="mb-3 font-bold">Waiting for first sign-in</h2>
      {invites.length === 0 ? (
        <EmptyState title="No open invites" />
      ) : (
        <ul className="divide-y divide-cream-200">
          {invites.map((invite) => (
            <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>
                <span className="font-semibold">{invite.email}</span>
                <span className="text-bark-500">
                  {' '}
                  · {invite.schoolRole ? ROLE_LABEL[invite.schoolRole] : 'No role'} · invited{' '}
                  {formatDate(invite.createdAt)}
                </span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  window.confirm(`Cancel the invite for ${invite.email}?`) && cancel.mutate(invite.id)
                }
              >
                Cancel invite
              </Button>
            </li>
          ))}
        </ul>
      )}
      <FormError error={cancel.error} />
    </Card>
  );
}

type AddResult = { member: { userId: string } } | { invite: { email: string } };

function AddStaff({ schoolId }: { schoolId: string }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<SchoolRole>('TEACHER');
  const [message, setMessage] = useState('');
  const add = useApiMutation(
    () => api.post<AddResult>(`/schools/${schoolId}/staff`, { email, role }),
    [orgKeys.schoolStaff(schoolId), SCHOOLS_KEY],
  );
  const errors = fieldErrors(add.error);

  function submit(event: FormEvent): void {
    event.preventDefault();
    setMessage('');
    add.mutate(undefined, {
      onSuccess: (result) => {
        setMessage(
          'member' in result
            ? `${email} already has an account and is now on the staff.`
            : `Invited ${email}. They can now sign in with Google.`,
        );
        setEmail('');
      },
    });
  }

  return (
    <Card className="self-start">
      <h2 className="mb-3 font-bold">Add someone</h2>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Google email" error={errors.email}>
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-bark-700">Role</legend>
          {SCHOOL_ROLES.map((value) => (
            <label key={value} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="school-role"
                className="mt-1"
                checked={role === value}
                onChange={() => setRole(value)}
              />
              <span>
                <span className="font-semibold">{ROLE_LABEL[value]}</span>{' '}
                <span className="text-bark-500">— {ROLE_HELP[value]}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <Button type="submit" busy={add.isPending}>
          Add to school
        </Button>
        {message ? (
          <p role="status" className="text-sm text-leaf-700">
            {message}
          </p>
        ) : null}
        <FormError error={add.error} />
      </form>
    </Card>
  );
}
