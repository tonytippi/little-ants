'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@little-ants/ui/button';
import { ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { InstallButton } from '@little-ants/ui/install-button';
import { TEACHER_APP_URL, api } from '../lib/api';
import { signOutParent, useDevices } from '../lib/hooks';
import type { ParentMe, StaffMe } from '../lib/types';
import { Vi, lastUsed } from './bits';
import { UserIcon } from './icons';

export const INSTALL_COPY = {
  appName: 'Listening',
  description:
    'The app then opens from its own icon, full screen, and keeps downloaded units for listening without internet.',
};

/** The account button and its menu: who is signed in, devices, sign out. */
export function AccountMenu({
  parent,
  staff,
  onChangeChild,
}: {
  parent: ParentMe | null;
  staff: StaffMe | null;
  /** Shown when the family has more than one child. */
  onChangeChild?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);
  const name = parent?.parent.name ?? parent?.parent.email ?? staff?.user.name ?? 'Account';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Account: ${name}`}
        className="grid size-11 place-items-center rounded-full bg-cream-200 text-bark-700 hover:bg-cream-100"
      >
        <UserIcon className="size-6" />
      </button>
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        aria-labelledby="account-title"
        className="m-auto w-[min(30rem,calc(100%-2rem))] rounded-[var(--radius-card)] bg-white p-6 text-bark-900 shadow-xl backdrop:bg-bark-900/40"
      >
        <h2 id="account-title" className="font-display text-2xl font-extrabold text-ant-500">
          Account
        </h2>
        {parent ? (
          <Section title="Parent">
            <p className="font-semibold">{parent.parent.name ?? 'Parent'}</p>
            <p className="text-sm text-bark-500">{parent.parent.email}</p>
            {onChangeChild ? (
              <Button
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setOpen(false);
                  onChangeChild();
                }}
              >
                Change child · Đổi bé
              </Button>
            ) : null}
          </Section>
        ) : null}
        {parent && open ? <DevicesSection /> : null}
        {staff ? (
          <Section title="Teacher (At school)">
            <p className="font-semibold">{staff.user.name}</p>
            <p className="text-sm text-bark-500">{staff.user.email}</p>
            <p className="mt-1 text-sm text-bark-500">
              You are signed in with the{' '}
              <a href={TEACHER_APP_URL} className="font-semibold text-leaf-700 underline">
                Teacher app
              </a>
              ; sign out there.
            </p>
          </Section>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <InstallButton {...INSTALL_COPY} />
          {parent ? (
            <Button variant="danger" onClick={() => void signOutParent()}>
              Sign out · Đăng xuất
            </Button>
          ) : null}
          <Button onClick={() => setOpen(false)}>Close</Button>
        </div>
      </dialog>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4 border-t border-cream-200 pt-3">
      <h3 className="text-xs font-bold tracking-wider text-bark-500 uppercase">{title}</h3>
      <div className="mt-1">{children}</div>
    </section>
  );
}

/** The parent's signed-in devices (at most two); any other device can be signed out from here. */
function DevicesSection() {
  const devices = useDevices(true);
  const queryClient = useQueryClient();
  const signOut = useMutation({
    mutationFn: (id: string) => api.del(`/parent/devices/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  });
  return (
    <Section title="Devices · Thiết bị">
      <p className="text-sm text-bark-500">
        You can use Listening on two devices.
        <Vi>Có thể đăng nhập trên tối đa 2 thiết bị.</Vi>
      </p>
      {devices.isPending ? <Spinner label="Loading devices" /> : null}
      {devices.error ? <ErrorNotice error={devices.error} /> : null}
      <ul className="mt-2 flex flex-col gap-2">
        {devices.data?.map((device) => (
          <li key={device.id} className="flex items-center gap-3 rounded-xl bg-cream-100 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                {device.deviceLabel ?? 'Device'}
                {device.current ? ' · this device' : ''}
              </p>
              <p className="text-xs text-bark-500">Last used {lastUsed(device.lastSeenAt)}</p>
            </div>
            {device.current ? null : (
              <Button
                variant="danger"
                size="sm"
                busy={signOut.isPending && signOut.variables === device.id}
                onClick={() => signOut.mutate(device.id)}
              >
                Sign out
              </Button>
            )}
          </li>
        ))}
      </ul>
      {signOut.error ? <ErrorNotice error={signOut.error} /> : null}
    </Section>
  );
}
