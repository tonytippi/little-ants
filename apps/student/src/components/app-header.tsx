'use client';

import type { ReactNode } from 'react';
import { useOnline, useOutboxState } from '../lib/hooks';
import type { Mode } from '../lib/types';

/** The top bar: logo, the At home / At school switch (At school only for signed-in staff) and the account button. */
export function AppHeader({
  mode,
  canSchool,
  onMode,
  tv,
  account,
}: {
  mode: Mode;
  canSchool: boolean;
  onMode: (mode: Mode) => void;
  /** Watch on TV (At home only). */
  tv?: ReactNode;
  account: ReactNode;
}) {
  return (
    <header className="no-print sticky top-0 z-20 flex flex-wrap items-center gap-x-3 gap-y-2 bg-cream-50 pt-[max(10px,env(safe-area-inset-top))] pb-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- a small local logo, cached by the service worker */}
      <img src="/logo.png" alt="Little Ants English" className="h-[42px] w-auto" width={61} height={42} />
      <SyncStatus />
      <div
        role="group"
        aria-label="Where are you listening?"
        className="ml-auto flex gap-1 rounded-full bg-cream-200 p-1"
      >
        <ModeButton active={mode === 'home'} onClick={() => onMode('home')} disabled={false}>
          At home
        </ModeButton>
        <ModeButton
          active={mode === 'school'}
          onClick={() => onMode('school')}
          disabled={!canSchool}
          title={canSchool ? undefined : 'For teachers signed in to Little Ants'}
        >
          At school
        </ModeButton>
      </div>
      {tv}
      {account}
    </header>
  );
}

function ModeButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={`min-h-9 rounded-full px-3.5 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${active ? 'bg-leaf-600 text-white' : 'text-bark-500'}`}
    >
      {children}
    </button>
  );
}

/** Offline and "waiting to upload" hints, small enough not to worry a child. */
function SyncStatus() {
  const online = useOnline();
  const { pending, syncing } = useOutboxState();
  if (online && pending === 0) return null;
  return (
    <span role="status" className="rounded-full bg-cream-100 px-2.5 py-1 text-xs font-semibold text-bark-500">
      {online ? null : 'Offline · '}
      {pending > 0 ? (syncing ? 'Uploading…' : `${pending} to upload`) : 'Không có mạng'}
    </span>
  );
}
