'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { ApiError } from '@little-ants/ui/lib/api-client';
import { Button } from '@little-ants/ui/button';
import { ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import {
  remember,
  rememberSignedIn,
  useParentMe,
  useRefreshAfterSync,
  useRemembered,
  useStaffMe,
} from '../lib/hooks';
import type { Mode } from '../lib/types';
import { AccountMenu } from './account-menu';
import { AppHeader } from './app-header';
import { CHILD_KEY, HomeMode } from './home-mode';
import { SchoolMode } from './school-mode';
import { TvButton } from './tv/tv-button';

const MODE_KEY = 'la-student-mode';

/**
 * The app: a parent signed in → At home; a staff user signed in (shared staff session) → At school is offered;
 * nobody signed in → the sign-in screen.
 */
export function ListeningApp() {
  const router = useRouter();
  const parent = useParentMe();
  const staff = useStaffMe();
  const [storedMode, setMode] = useRemembered<Mode>(MODE_KEY);
  useRefreshAfterSync();

  const parentMe = parent.data ?? null;
  const staffMe = staff.data ?? null;
  const parentSignedOut = parent.error instanceof ApiError && parent.error.isUnauthorized;
  const nobody = !parent.isPending && !staff.isPending && !parentMe && !staffMe;

  useEffect(() => {
    if (nobody && parentSignedOut) router.replace('/signin');
  }, [nobody, parentSignedOut, router]);

  // The landing page sends a signed-in device straight here.
  const signedIn = !!parentMe || !!staffMe;
  useEffect(() => {
    if (signedIn) rememberSignedIn(true);
    else if (nobody && parentSignedOut) rememberSignedIn(false);
  }, [signedIn, nobody, parentSignedOut]);

  if (parent.isPending || staff.isPending || (nobody && parentSignedOut))
    return (
      <Frame>
        <Spinner label="Opening Listening Time" />
      </Frame>
    );
  if (nobody)
    return (
      <Frame>
        <div className="mx-auto mt-10 flex max-w-md flex-col gap-3">
          <ErrorNotice error={parent.error} />
          <Button onClick={() => void parent.refetch()}>Try again · Thử lại</Button>
        </div>
      </Frame>
    );

  const mode: Mode = !staffMe ? 'home' : !parentMe ? 'school' : (storedMode ?? 'home');
  const changeMode = (next: Mode): void => {
    // At home needs a parent account: a teacher without one is sent to the parent sign-in.
    if (next === 'home' && !parentMe) router.push('/signin');
    else setMode(next);
  };
  const changeChild =
    parentMe && parentMe.children.length > 1 && mode === 'home' ? () => remember(CHILD_KEY, null) : undefined;

  return (
    <Frame
      header={
        <AppHeader
          mode={mode}
          canSchool={!!staffMe}
          onMode={changeMode}
          tv={mode === 'home' && parentMe ? <TvButton /> : undefined}
          account={<AccountMenu parent={parentMe} staff={staffMe} onChangeChild={changeChild} />}
        />
      }
    >
      {mode === 'home' && parentMe ? <HomeMode me={parentMe} /> : null}
      {mode === 'school' && staffMe ? <SchoolMode staff={staffMe} /> : null}
    </Frame>
  );
}

function Frame({ header, children }: { header?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1180px] flex-col px-[max(16px,env(safe-area-inset-left))] 2xl:max-w-[1600px]">
      {header}
      <main className="min-w-0 flex-1 pt-1.5 pb-20">{children}</main>
    </div>
  );
}
