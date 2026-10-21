'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, type ReactNode } from 'react';
import { ApiError } from '@little-ants/ui/lib/api-client';
import type { StaffUser } from '@little-ants/ui/lib/auth-client';
import { ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { LoginPanel } from '@little-ants/ui/login-panel';
import { api, auth } from './api';
import { clearPersonalData, kvGet, kvSet } from './local-db';
import { flushOutbox, myOutboxItems, removeMyOutboxItems } from './outbox';

interface Me {
  user: StaffUser;
  classes: { id: string; name: string; schoolYear: string; campus: { name: string } }[];
  /** True when the server could not be reached and the last known sign-in is used. */
  offline?: boolean;
}

const SessionContext = createContext<Me | null>(null);

/** The signed-in staff user. Only use inside <RequireStaff>. */
export function useMe(): Me {
  const me = useContext(SessionContext);
  if (!me) throw new Error('useMe must be used inside RequireStaff');
  return me;
}

/**
 * Sign out and remove this teacher's data from the device (classrooms share tablets).
 * Records not uploaded yet are tried once more; if some remain, the teacher must confirm losing them.
 */
export function useSignOut(): () => Promise<void> {
  const queryClient = useQueryClient();
  return async () => {
    await flushOutbox({ force: true });
    const waiting = (await myOutboxItems()).length;
    if (
      waiting > 0 &&
      !window.confirm(
        `${waiting} lesson record(s) have not been uploaded yet. Signing out removes them from this device. Sign out anyway?`,
      )
    ) {
      return;
    }
    await removeMyOutboxItems();
    await clearPersonalData();
    await auth.signOut();
    queryClient.clear();
    // Full reload so no data from the previous user stays in memory.
    window.location.replace(window.location.origin);
  };
}

/** /me, falling back to the last signed-in user when the device is offline (classrooms often lose Wi-Fi). */
async function loadMe(): Promise<Me> {
  try {
    const me = await api.get<Me>('/me');
    await kvSet('me', me);
    return me;
  } catch (error) {
    if (error instanceof ApiError && error.status !== 0) throw error;
    const cached = await kvGet<Me | null>('me');
    if (cached) return { ...cached, offline: true };
    throw error;
  }
}

/** Shows the sign-in card until there is a staff session. */
export function RequireStaff({ appName, children }: { appName: string; children: ReactNode }) {
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: loadMe,
    retry: (count, error) => !(error instanceof ApiError && error.isUnauthorized) && count < 1,
  });
  if (me.isPending) return <Spinner label="Checking your sign-in" />;
  if (me.error instanceof ApiError && me.error.isUnauthorized) {
    return (
      <LoginPanel
        appName={appName}
        api={api}
        auth={auth}
        callbackUrl={`${window.location.origin}/`}
        onSignedIn={() => void queryClient.invalidateQueries({ queryKey: ['me'] })}
      />
    );
  }
  if (me.error) {
    return (
      <div className="p-8">
        <ErrorNotice
          error={
            new Error(
              'Cannot reach the server, and this device has not signed in before. Connect to the internet and try again.',
            )
          }
        />
      </div>
    );
  }
  return <SessionContext.Provider value={me.data}>{children}</SessionContext.Provider>;
}
