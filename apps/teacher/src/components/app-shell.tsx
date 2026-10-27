'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Button } from '@little-ants/ui/button';
import { isIos, isStandalone } from '../lib/install';
import { flushOutbox, discardFailed } from '../lib/outbox';
import { InstallButton, InstallSteps } from './install-button';
import { useOnline, useOutboxState } from '../lib/hooks';
import { useMe, useSignOut } from '../lib/session';

function StatusPills() {
  const online = useOnline();
  const outbox = useOutboxState();
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${online ? 'bg-leaf-50 text-leaf-700' : 'bg-sun-100 text-bark-900'}`}
        aria-live="polite"
      >
        <span className={`size-2 rounded-full ${online ? 'bg-leaf-500' : 'bg-sun-500'}`} aria-hidden />
        {online ? 'Online' : 'Offline'}
      </span>
      {outbox.pending > 0 ? (
        <button
          type="button"
          onClick={() => void flushOutbox({ force: true })}
          className="rounded-full bg-cream-100 px-2.5 py-1 text-bark-700 hover:bg-cream-200"
          title="Records saved on this device that are not on the server yet"
        >
          {outbox.syncing ? 'Syncing…' : `${outbox.pending} to sync`}
        </button>
      ) : null}
      {outbox.needsSignIn ? (
        <span className="rounded-full bg-ant-50 px-2.5 py-1 text-ant-700">Sign in again to sync</span>
      ) : null}
      {outbox.failed > 0 ? (
        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                `${outbox.failed} records were refused by the server (${outbox.lastError ?? 'unknown reason'}). Remove them from this device?`,
              )
            ) {
              void discardFailed();
            }
          }}
          className="rounded-full bg-ant-50 px-2.5 py-1 text-ant-700"
        >
          {outbox.failed} not accepted
        </button>
      ) : null}
    </div>
  );
}

/** Tells iPad/iPhone users to add the app to the Home Screen so Safari keeps the offline data. */
function shouldShowInstallHint(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem('la-install-hint') === 'dismissed') return false;
  } catch {
    /* storage blocked */
  }
  return isIos() && !isStandalone();
}

function InstallHint() {
  // AppShell only renders in the browser (after the session check), so reading navigator here is safe.
  const [show, setShow] = useState(shouldShowInstallHint);
  const [steps, setSteps] = useState(false);
  if (!show) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-sun-100 px-4 py-3 text-sm text-bark-900">
      <p>
        <strong>Using an iPad?</strong> Add Little Ants to the Home Screen. Downloaded lessons then stay on
        the iPad and work without Wi-Fi.
      </p>
      <div className="flex shrink-0 items-center gap-3">
        <Button size="sm" onClick={() => setSteps(true)}>
          Show me how
        </Button>
        <button
          type="button"
          className="font-semibold text-bark-700 underline"
          onClick={() => {
            try {
              localStorage.setItem('la-install-hint', 'dismissed');
            } catch {
              /* ignore */
            }
            setShow(false);
          }}
        >
          Not now
        </button>
      </div>
      <InstallSteps open={steps} mode="steps-ios" onClose={() => setSteps(false)} />
    </div>
  );
}

export function AppShell({
  children,
  title,
  back,
}: {
  children: ReactNode;
  title?: string;
  back?: { href: string; label: string };
}) {
  const { user, offline } = useMe();
  const signOut = useSignOut();
  return (
    <div className="min-h-screen bg-cream-50">
      <InstallHint />
      <header className="sticky top-0 z-20 border-b border-cream-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-192.png" alt="" className="size-9 rounded-lg" />
            <span className="text-lg font-extrabold text-leaf-700">Little Ants</span>
          </Link>
          {back ? (
            <Link href={back.href} className="text-sm font-semibold text-bark-500 hover:text-bark-900">
              ← {back.label}
            </Link>
          ) : null}
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <StatusPills />
            <InstallButton />
            <span className="hidden text-sm text-bark-500 sm:inline">{user.name}</span>
            {offline ? null : (
              <Button variant="ghost" size="sm" onClick={() => void signOut()}>
                Sign out
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {title ? <h1 className="mb-5 text-2xl font-extrabold text-bark-900">{title}</h1> : null}
        {children}
      </main>
    </div>
  );
}
