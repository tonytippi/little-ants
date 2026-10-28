'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SCHOOL_ROLES } from '@little-ants/shared';
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

function staffKeys(schoolId: string) {
  return [orgKeys.schoolStaff(schoolId), orgKeys.allClasses, orgKeys.allClassDetails, SCHOOLS_KEY];
}

export default function SchoolStaffPage() {
  return <SchoolPage>{(school) => <SchoolStaffView key={school.id} school={school} />}</SchoolPage>;
}

function SchoolStaffView({ school }: { school: School }) {
  const staff = useSchoolStaff(school.id);
  const me = useMe();
  const [adding, setAdding] = useState(false);

  const memberColumns: Column<SchoolStaffMember>[] = [
    {
      header: 'Person',
      cell: ({ user }) => (
        <>
          <p className="font-semibold text-bark-900">
            {user.name} {user.id === me.user.id ? <Badge>you</Badge> : null}{' '}
            {user.active ? null : <Badge tone="bark">account turned off</Badge>}
          </p>
          <p className="text-xs text-bark-500">{user.email}</p>
        </>
      ),
    },
    {
      header: 'Role',
      cell: (member) => (
        <Badge tone={member.role === 'SCHOOL_ADMIN' ? 'leaf' : 'neutral'}>{ROLE_LABEL[member.role]}</Badge>
      ),
    },
    {
      header: 'Classes',
      cell: ({ user }) =>
        user.assignments.length ? (
          <span className="text-xs">
            {user.assignments.map((item, index) => (
              <span key={item.class.id}>
                {index > 0 ? ', ' : null}
                <Link href={`/classes/${item.class.id}`} className="text-leaf-700 hover:underline">
                  {item.class.name}
                </Link>
              </span>
            ))}
          </span>
        ) : (
          '—'
        ),
    },
  ];

  const inviteColumns: Column<SchoolInvite>[] = [
    {
      header: 'Email',
      cell: (invite) => <span className="font-semibold text-bark-900">{invite.email}</span>,
    },
    { header: 'Role', cell: (invite) => (invite.schoolRole ? ROLE_LABEL[invite.schoolRole] : 'No role') },
    { header: 'Invited', cell: (invite) => <span className="text-xs">{formatDate(invite.createdAt)}</span> },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={school.name}
        title="School staff"
        actions={<Button onClick={() => setAdding(true)}>+ Add staff</Button>}
      >
        Teachers and school admins of this school sign in with Google. Add their email; someone without an
        account gets an invite.
      </PageHeader>
      {staff.isPending ? <Spinner label="Loading school staff" /> : null}
      {staff.error ? <ErrorNotice error={staff.error} /> : null}
      {staff.data ? (
        <div className="flex flex-col gap-8">
          <DataTable
            label="School staff"
            columns={memberColumns}
            rows={staff.data.members}
            rowKey={(member) => member.user.id}
            muted={(member) => !member.user.active}
            empty={<EmptyState title="No staff yet">Add the first teacher with “+ Add staff”.</EmptyState>}
            actions={(member) => <MemberActions schoolId={school.id} member={member} />}
          />
          <section>
            <h2 className="mb-3 font-bold">Waiting for first sign-in</h2>
            <DataTable
              label="Open invites"
              columns={inviteColumns}
              rows={staff.data.invites}
              rowKey={(invite) => invite.id}
              minWidth="32rem"
              empty="No open invites"
              actions={(invite) => <InviteActions schoolId={school.id} invite={invite} />}
            />
          </section>
        </div>
      ) : null}
      {adding ? <AddStaffDialog schoolId={school.id} onClose={() => setAdding(false)} /> : null}
    </div>
  );
}

function RoleChoice({ value, onChange }: { value: SchoolRole; onChange: (role: SchoolRole) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold text-bark-700">Role</legend>
      {SCHOOL_ROLES.map((role) => (
        <label key={role} className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="school-role"
            className="mt-1"
            checked={value === role}
            onChange={() => onChange(role)}
          />
          <span>
            <span className="font-semibold">{ROLE_LABEL[role]}</span>{' '}
            <span className="text-bark-500">— {ROLE_HELP[role]}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function MemberActions({ schoolId, member }: { schoolId: string; member: SchoolStaffMember }) {
  const { user } = member;
  const [open, setOpen] = useState<'role' | 'remove' | null>(null);
  const [role, setRole] = useState(member.role);
  const update = useApiMutation(
    () => api.patch(`/schools/${schoolId}/staff/${user.id}`, { role }),
    staffKeys(schoolId),
  );
  const remove = useApiMutation(() => api.del(`/schools/${schoolId}/staff/${user.id}`), staffKeys(schoolId));
  const close = () => setOpen(null);

  return (
    <>
      <RowMenu
        label={`Actions for ${user.name}`}
        actions={[
          {
            label: 'Change role',
            onSelect: () => {
              setRole(member.role);
              setOpen('role');
            },
          },
          { label: 'Remove from school', onSelect: () => setOpen('remove'), danger: true },
        ]}
      />
      <FormDialog
        open={open === 'role'}
        title={`Role of ${user.name}`}
        submitLabel="Save"
        busy={update.isPending}
        error={update.error}
        disabled={role === member.role}
        onClose={close}
        onSubmit={() => update.mutate(undefined, { onSuccess: close })}
      >
        <RoleChoice value={role} onChange={setRole} />
      </FormDialog>
      <ConfirmDialog
        open={open === 'remove'}
        title={`Remove ${user.name}`}
        confirmLabel="Remove"
        danger
        busy={remove.isPending}
        error={remove.error}
        onClose={close}
        onConfirm={() => remove.mutate(undefined, { onSuccess: close })}
      >
        <p>They stop teaching this school&apos;s classes and lose access to it. Their account stays.</p>
      </ConfirmDialog>
    </>
  );
}

function InviteActions({ schoolId, invite }: { schoolId: string; invite: SchoolInvite }) {
  const [cancelling, setCancelling] = useState(false);
  const cancel = useApiMutation(
    () => api.del(`/schools/${schoolId}/invites/${invite.id}`),
    [orgKeys.schoolStaff(schoolId)],
  );
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

type AddResult = { member: { userId: string } } | { invite: { email: string } };

function AddStaffDialog({ schoolId, onClose }: { schoolId: string; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<SchoolRole>('TEACHER');
  const add = useApiMutation(
    () => api.post<AddResult>(`/schools/${schoolId}/staff`, { email, role }),
    [orgKeys.schoolStaff(schoolId), SCHOOLS_KEY],
  );
  const errors = fieldErrors(add.error);

  return (
    <FormDialog
      open
      title="Add staff"
      submitLabel="Add to school"
      busy={add.isPending}
      error={add.error}
      onClose={onClose}
      onSubmit={() => add.mutate(undefined, { onSuccess: onClose })}
    >
      <Field
        label="Google email"
        hint="Someone with an account joins at once; a new email gets an invite to sign in with Google."
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
      <RoleChoice value={role} onChange={setRole} />
    </FormDialog>
  );
}
