'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ROLES } from '@little-ants/shared';
import { Badge } from '@little-ants/ui/badge';
import { Button } from '@little-ants/ui/button';
import { Card, EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { Field, TextInput } from '@little-ants/ui/field';
import { AdminOnly } from '../../../components/admin-only';
import { FormError } from '../../../components/form-error';
import { PageHeader } from '../../../components/page-header';
import { api } from '../../../lib/api';
import { fieldErrors, formatDate, humanize, useApiMutation } from '../../../lib/hooks';
import { useMe } from '../../../lib/session';
import type { Role, StaffInvite, StaffMember } from '../../../lib/types';

const ROLE_HELP: Record<Role, string> = {
  ADMIN: 'everything, including schools, HQ staff and Drive sync',
  AUTHOR: 'edit content and upload files',
  REVIEWER: 'approve content and publish units',
};

const KEY = ['staff'];

export default function StaffPage() {
  return (
    <AdminOnly>
      <Staff />
    </AdminOnly>
  );
}

function Staff() {
  const query = useQuery({
    queryKey: KEY,
    queryFn: () => api.get<{ users: StaffMember[]; invites: StaffInvite[] }>('/staff'),
  });
  return (
    <div>
      <PageHeader title="HQ staff">
        Little Ants HQ staff sign in with Google. Invite their email first; their roles come from the invite.
        Teachers and school admins are added per school on the School staff page.
      </PageHeader>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          {query.isPending ? <Spinner label="Loading staff" /> : null}
          {query.error ? <ErrorNotice error={query.error} /> : null}
          {query.data ? (
            <Card className="overflow-x-auto p-0">
              <table className="w-full min-w-[44rem] text-sm">
                <thead className="bg-cream-100 text-left text-xs uppercase tracking-wide text-bark-500">
                  <tr>
                    <th className="px-4 py-2">Person</th>
                    <th className="px-4 py-2">Roles</th>
                    <th className="px-4 py-2">Classes</th>
                    <th className="px-4 py-2">Account</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.users.map((user) => (
                    <StaffRow key={user.id} user={user} />
                  ))}
                </tbody>
              </table>
            </Card>
          ) : null}
          {query.data ? <Invites invites={query.data.invites} /> : null}
        </div>
        <InviteForm />
      </div>
    </div>
  );
}

function StaffRow({ user }: { user: StaffMember }) {
  const me = useMe();
  const [roles, setRoles] = useState<Role[]>(user.roles);
  const update = useApiMutation(
    (data: { roles?: Role[]; active?: boolean }) => api.patch(`/staff/${user.id}`, data),
    [KEY],
  );
  const dirty = roles.slice().sort().join() !== user.roles.slice().sort().join();
  const isMe = user.id === me.user.id;

  return (
    <tr className="border-t border-cream-200 align-top">
      <td className="px-4 py-3">
        <p className="font-semibold">
          {user.name} {isMe ? <Badge>you</Badge> : null}
        </p>
        <p className="text-xs text-bark-500">{user.email}</p>
      </td>
      <td className="px-4 py-3">
        <fieldset className="flex flex-wrap gap-x-3 gap-y-1">
          <legend className="sr-only">Roles for {user.name}</legend>
          {ROLES.map((role) => (
            <label key={role} className="flex items-center gap-1 text-xs" title={ROLE_HELP[role]}>
              <input
                type="checkbox"
                checked={roles.includes(role)}
                onChange={(event) =>
                  setRoles((current) =>
                    event.target.checked ? [...current, role] : current.filter((item) => item !== role),
                  )
                }
              />
              {humanize(role)}
            </label>
          ))}
        </fieldset>
        {dirty ? (
          <div className="mt-2 flex gap-1">
            <Button size="sm" busy={update.isPending} onClick={() => update.mutate({ roles })}>
              Save roles
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRoles(user.roles)}>
              Undo
            </Button>
          </div>
        ) : null}
        <FormError error={update.error} />
      </td>
      <td className="px-4 py-3 text-xs text-bark-500">
        {user.assignments.map((item) => item.class.name).join(', ') || '—'}
      </td>
      <td className="px-4 py-3">
        {user.active ? <Badge tone="leaf">Active</Badge> : <Badge tone="bark">Turned off</Badge>}
        {!isMe ? (
          <Button
            size="sm"
            variant={user.active ? 'danger' : 'secondary'}
            className="mt-2"
            onClick={() => {
              if (
                user.active &&
                !window.confirm(`Turn off ${user.name}'s account? They are signed out everywhere at once.`)
              )
                return;
              update.mutate({ active: !user.active });
            }}
          >
            {user.active ? 'Turn off' : 'Turn on'}
          </Button>
        ) : null}
      </td>
    </tr>
  );
}

/** HQ roles of an invite, or the school role when a school sent it. */
function inviteRoles(invite: StaffInvite): string {
  const roles = invite.roles.map((role) => humanize(role));
  if (invite.schoolRole) roles.push(`${humanize(invite.schoolRole)} (school invite)`);
  return roles.join(', ') || 'no role';
}

function Invites({ invites }: { invites: StaffInvite[] }) {
  const cancel = useApiMutation((id: string) => api.del(`/staff/invites/${id}`), [KEY]);
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
                  · {inviteRoles(invite)} · invited {formatDate(invite.createdAt)}
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

function InviteForm() {
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<Role[]>(['AUTHOR']);
  const invite = useApiMutation(() => api.post('/staff/invites', { email, roles }), [KEY]);
  const errors = fieldErrors(invite.error);

  function submit(event: FormEvent): void {
    event.preventDefault();
    invite.mutate(undefined, { onSuccess: () => setEmail('') });
  }

  return (
    <Card className="self-start">
      <h2 className="mb-3 font-bold">Invite someone</h2>
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
          <legend className="mb-1 text-sm font-semibold text-bark-700">Roles</legend>
          {ROLES.map((role) => (
            <label key={role} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={roles.includes(role)}
                onChange={(event) =>
                  setRoles((current) =>
                    event.target.checked ? [...current, role] : current.filter((item) => item !== role),
                  )
                }
              />
              <span>
                <span className="font-semibold">{humanize(role)}</span>{' '}
                <span className="text-bark-500">— {ROLE_HELP[role]}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <Button type="submit" busy={invite.isPending} disabled={roles.length === 0}>
          Send invite
        </Button>
        {invite.isSuccess ? (
          <p role="status" className="text-sm text-leaf-700">
            Invited. They can now sign in with Google.
          </p>
        ) : null}
        <FormError error={invite.error} />
      </form>
    </Card>
  );
}
