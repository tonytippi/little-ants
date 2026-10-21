'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, type ReactNode } from 'react';
import { ApiError } from '@little-ants/ui/lib/api-client';
import type { StaffUser } from '@little-ants/ui/lib/auth-client';
import { ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { LoginPanel } from '@little-ants/ui/login-panel';
import { api, auth } from './api';

interface Me {
  user: StaffUser;
  classes: { id: string; name: string; schoolYear: string; campus: { name: string } }[];
}

const SessionContext = createContext<Me | null>(null);

/** The signed-in staff user. Only use inside <RequireStaff>. */
export function useMe(): Me {
  const me = useContext(SessionContext);
  if (!me) throw new Error('useMe must be used inside RequireStaff');
  return me;
}

export function useSignOut(): () => Promise<void> {
  const queryClient = useQueryClient();
  return async () => {
    await auth.signOut();
    queryClient.clear();
    // A full reload drops every cached query and shows the sign-in card.
    window.location.reload();
  };
}

/** Shows the sign-in card until there is a staff session. */
export function RequireStaff({ appName, children }: { appName: string; children: ReactNode }) {
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<Me>('/me'),
    retry: (count, error) => !(error instanceof ApiError && error.isUnauthorized) && count < 2,
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
  if (me.error) return <div className="p-8"><ErrorNotice error={me.error} /></div>;
  return <SessionContext.Provider value={me.data}>{children}</SessionContext.Provider>;
}
