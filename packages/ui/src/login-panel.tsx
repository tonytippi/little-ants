'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button } from './button';
import { Field, TextInput } from './field';
import type { ApiClient } from './lib/api-client';
import type { StaffAuthClient } from './lib/auth-client';

interface LoginPanelProps {
  appName: string;
  api: ApiClient;
  auth: StaffAuthClient;
  /** Where to land after signing in (absolute URL of this app). */
  callbackUrl: string;
  onSignedIn: () => void;
}

const ERRORS: Record<string, string> = {
  not_invited: 'This Google account has not been invited. Ask an admin to invite your email.',
  deactivated: 'This account is turned off. Ask an admin for help.',
};

/** Sign-in card: Google for staff, plus email + password when the API allows it in development. */
export function LoginPanel({ appName, api, auth, callbackUrl, onSignedIn }: LoginPanelProps) {
  const [methods, setMethods] = useState<{ google: boolean; devPassword: boolean } | null>(null);
  // An OAuth failure comes back as ?error=<code>.
  const [error, setError] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const code = new URLSearchParams(window.location.search).get('error');
    return code ? (ERRORS[code.toLowerCase()] ?? 'Sign-in failed. Please try again.') : null;
  });
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    api
      .get<{ google: boolean; devPassword: boolean }>('/auth-config')
      .then(setMethods, () => setError('Cannot reach the server.'));
  }, [api]);

  async function google(): Promise<void> {
    setBusy(true);
    setError(null);
    await auth.signIn.social({
      provider: 'google',
      callbackURL: callbackUrl,
      errorCallbackURL: `${callbackUrl}login`,
    });
  }

  async function withPassword(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await auth.signIn.email({ email, password });
    setBusy(false);
    if (result.error)
      setError(ERRORS[result.error.message ?? ''] ?? result.error.message ?? 'Sign-in failed');
    else onSignedIn();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream-100 p-6">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-sm ring-1 ring-cream-200">
        <p className="text-sm font-bold uppercase tracking-wider text-ant-500">Little Ants English</p>
        <h1 className="mt-1 text-2xl font-extrabold text-leaf-700">{appName}</h1>
        <p className="mt-2 text-sm text-bark-500">Sign in with the Google account your school invited.</p>

        {error ? (
          <p role="alert" className="mt-5 rounded-lg bg-ant-50 px-3 py-2 text-sm text-ant-700">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3">
          {methods?.google ? (
            <Button size="lg" onClick={google} busy={busy}>
              Continue with Google
            </Button>
          ) : null}
          {methods && !methods.google && !methods.devPassword ? (
            <p className="text-sm text-bark-500">Google sign-in is not set up on this server yet.</p>
          ) : null}
        </div>

        {methods?.devPassword ? (
          <form onSubmit={withPassword} className="mt-6 flex flex-col gap-3 border-t border-cream-200 pt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-bark-500">Development sign-in</p>
            <Field label="Email">
              {(id) => (
                <TextInput
                  id={id}
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              )}
            </Field>
            <Field label="Password">
              {(id) => (
                <TextInput
                  id={id}
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              )}
            </Field>
            <Button type="submit" variant="secondary" busy={busy}>
              Sign in
            </Button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
