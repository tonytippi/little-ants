'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ROLES } from '@little-ants/shared';
import { Badge } from '@little-ants/ui/badge';
import { Button } from '@little-ants/ui/button';
import { ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { Field, TextInput } from '@little-ants/ui/field';
import { AdminOnly } from '../../../components/admin-only';
import { ConfirmDialog } from '../../../components/confirm-dialog';
import { DataTable, type Column } from '../../../components/data-table';
import { FormDialog } from '../../../components/form-dialog';
import { PageHeader } from '../../../components/page-header';
import { RowMenu } from '../../../components/row-menu';
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

/** HQ roles of an invite, or the school role when a school sent it. */
function inviteRoles(invite: StaffInvite): string {
  const roles = invite.roles.map((role) => humanize(role));
  if (invite.schoolRole) roles.push(`${humanize(invite.schoolRole)} (school invite)`);
  return roles.join(', ') || 'no role';
}

const INVITE_COLUMNS: Column<StaffInvite>[] = [
  { header: 'Email', cell: (invite) => <span className="font-semibold text-bark-900">{invite.email}</span> },
  { header: 'Roles', cell: (invite) => <span className="text-xs">{inviteRoles(invite)}</span> },
  { header: 'Invited', cell: (invite) => <span className="text-xs">{formatDate(invite.createdAt)}</span> },
];

function Staff() {
  const me = useMe();
  const [inviting, setInviting] = useState(false);
  const query = useQuery({
    queryKey: KEY,
    queryFn: () => api.get<{ users: StaffMember[]; invites: StaffInvite[] }>('/staff'),
  });

  const columns: Column<StaffMember>[] = [
    {
      header: 'Person',
      cell: (user) => (
        <>
          <p className="font-semibold text-bark-900">
            {user.name} {user.id === me.user.id ? <Badge>you</Badge> : null}
          </p>
          <p className="text-xs text-bark-500">{user.email}</p>
        </>
      ),
    },
    {
      header: 'Roles',
      cell: (user) => (
        <span className="flex flex-wrap gap-1">
          {user.roles.map((role) => (
            <Badge key={role} tone={role === 'ADMIN' ? 'leaf' : 'neutral'}>
              {humanize(role)}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      header: 'Classes',
      cell: (user) => (
        <span className="text-xs text-bark-500">
          {user.assignments.map((item) => item.class.name).join(', ') || '—'}
        </span>
      ),
    },
    {
      header: 'Account',
      cell: (user) =>
        user.active ? <Badge tone="leaf">Active</Badge> : <Badge tone="bark">Turned off</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader title="HQ staff" actions={<Button onClick={() => setInviting(true)}>+ Invite</Button>}>
        Little Ants HQ staff sign in with Google. Invite their email first; their roles come from the invite.
        Teachers and school admins are added per school on the School staff page.
      </PageHeader>
      {query.isPending ? <Spinner label="Loading staff" /> : null}
      {query.error ? <ErrorNotice error={query.error} /> : null}
      {query.data ? (
        <div className="flex flex-col gap-8">
          <DataTable
            label="HQ staff"
            columns={columns}
            rows={query.data.users}
            rowKey={(user) => user.id}
            muted={(user) => !user.active}
            minWidth="44rem"
            empty="No HQ staff yet"
            actions={(user) => <StaffActions user={user} isMe={user.id === me.user.id} />}
          />
          <section>
            <h2 className="mb-3 font-bold">Waiting for first sign-in</h2>
            <DataTable
              label="Open invites"
              columns={INVITE_COLUMNS}
              rows={query.data.invites}
              rowKey={(invite) => invite.id}
              minWidth="32rem"
              empty="No open invites"
              actions={(invite) => <InviteActions invite={invite} />}
            />
          </section>
        </div>
      ) : null}
      {inviting ? <InviteDialog onClose={() => setInviting(false)} /> : null}
    </div>
  );
}

function RoleChoice({ value, onChange }: { value: Role[]; onChange: (roles: Role[]) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold text-bark-700">Roles</legend>
      {ROLES.map((role) => (
        <label key={role} className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={value.includes(role)}
            onChange={(event) =>
              onChange(event.target.checked ? [...value, role] : value.filter((item) => item !== role))
            }
          />
          <span>
            <span className="font-semibold">{humanize(role)}</span>{' '}
            <span className="text-bark-500">— {ROLE_HELP[role]}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function StaffActions({ user, isMe }: { user: StaffMember; isMe: boolean }) {
  const [open, setOpen] = useState<'roles' | 'off' | null>(null);
  const [roles, setRoles] = useState<Role[]>(user.roles);
  const update = useApiMutation(
    (data: { roles?: Role[]; active?: boolean }) => api.patch(`/staff/${user.id}`, data),
    [KEY],
  );
  const close = () => setOpen(null);
  const unchanged = roles.slice().sort().join() === user.roles.slice().sort().join();

  return (
    <>
      <RowMenu
        label={`Actions for ${user.name}`}
        actions={[
          {
            label: 'Edit roles',
            onSelect: () => {
              setRoles(user.roles);
              setOpen('roles');
            },
          },
          {
            label: 'Turn account on',
            onSelect: () => update.mutate({ active: true }),
            hidden: isMe || user.active,
          },
          {
            label: 'Turn account off',
            onSelect: () => setOpen('off'),
            danger: true,
            hidden: isMe || !user.active,
          },
        ]}
      />
      <FormDialog
        open={open === 'roles'}
        title={`Roles of ${user.name}`}
        submitLabel="Save"
        busy={update.isPending}
        error={update.error}
        disabled={roles.length === 0 || unchanged}
        onClose={close}
        onSubmit={() => update.mutate({ roles }, { onSuccess: close })}
      >
        <RoleChoice value={roles} onChange={setRoles} />
      </FormDialog>
      <ConfirmDialog
        open={open === 'off'}
        title={`Turn off ${user.name}'s account`}
        confirmLabel="Turn off"
        danger
        busy={update.isPending}
        error={update.error}
        onClose={close}
        onConfirm={() => update.mutate({ active: false }, { onSuccess: close })}
      >
        <p>They are signed out everywhere at once and cannot sign in until the account is turned on again.</p>
      </ConfirmDialog>
    </>
  );
}

function InviteActions({ invite }: { invite: StaffInvite }) {
  const [cancelling, setCancelling] = useState(false);
  const cancel = useApiMutation(() => api.del(`/staff/invites/${invite.id}`), [KEY]);
  return (
    <>
      <RowMenu
        label={`Actions for ${invite.email}`}
        actions={[{ label: 'Cancel invite', onSelect: () => setCancelling(true), danger: true }]}
      />
      <ConfirmDialog
        open={cancelling}
        title="Cancel invite"
        confirmLabel="Cancel invite"
        danger
        busy={cancel.isPending}
        error={cancel.error}
        onClose={() => setCancelling(false)}
        onConfirm={() => cancel.mutate(undefined, { onSuccess: () => setCancelling(false) })}
      >
        <p>
          <strong>{invite.email}</strong> can no longer sign in with this invite.
        </p>
      </ConfirmDialog>
    </>
  );
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<Role[]>(['AUTHOR']);
  const invite = useApiMutation(() => api.post('/staff/invites', { email, roles }), [KEY]);
  const errors = fieldErrors(invite.error);

  return (
    <FormDialog
      open
      title="Invite HQ staff"
      submitLabel="Send invite"
      busy={invite.isPending}
      error={invite.error}
      disabled={roles.length === 0}
      onClose={onClose}
      onSubmit={() => invite.mutate(undefined, { onSuccess: onClose })}
    >
      <Field
        label="Google email"
        hint="They can sign in with Google as soon as the invite is sent."
        error={errors.email}
      >
        {(id, describedBy) => (
          <TextInput
            id={id}
            aria-describedby={describedBy}
            type="email"
            required
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        )}
      </Field>
      <RoleChoice value={roles} onChange={setRoles} />
    </FormDialog>
  );
}
