'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@little-ants/ui/button';
import { ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { ctaClass } from '@little-ants/ui/storybook';
import { TEACHER_APP_URL, api, parentSignInUrl } from '../lib/api';
import { useParentMe, useStaffMe } from '../lib/hooks';
import type { PendingDevices } from '../lib/types';
import { Notice, Vi, lastUsed } from './bits';

/** Why the API sent the parent back here (`/signin?error=…`), in English and Vietnamese. */
const ERRORS: Record<string, { en: string; vi: string }> = {
  expired: {
    en: 'The sign-in took too long or was already used. Please sign in again.',
    vi: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  },
  'not-registered': {
    en: 'This Google account is not registered with the school. Sign in with the email you gave the school, or ask the teacher to add it.',
    vi: 'Tài khoản Google này chưa được nhà trường đăng ký. Hãy đăng nhập bằng email đã đưa cho trường, hoặc nhờ cô thêm email.',
  },
  'other-account': {
    en: 'This email is already linked to a different Google account. Sign in with that account, or ask the school for help.',
    vi: 'Email này đã gắn với một tài khoản Google khác. Hãy đăng nhập bằng tài khoản đó, hoặc nhờ nhà trường hỗ trợ.',
  },
  'no-active-child': {
    en: 'None of your children is in a class at the moment, so Listening Time is closed. Ask the school if this is not right.',
    vi: 'Hiện chưa có bé nào trong lớp nên chưa thể nghe. Vui lòng liên hệ nhà trường nếu chưa đúng.',
  },
  google: {
    en: 'Google sign-in did not work. Please try again.',
    vi: 'Đăng nhập Google không thành công. Vui lòng thử lại.',
  },
  cancelled: {
    en: 'Sign-in was cancelled.',
    vi: 'Bạn đã huỷ đăng nhập.',
  },
};

const OTHER_ERROR = {
  en: 'Something went wrong while signing in. Please try again.',
  vi: 'Đăng nhập không thành công. Vui lòng thử lại.',
};

/** The parent sign-in screen: Google, the reason a sign-in failed, and the two-device chooser. */
export function SignInScreen() {
  const params = useSearchParams();
  const error = params.get('error');
  const pendingToken = params.get('devices');
  const router = useRouter();
  const parent = useParentMe();
  // Already signed in (e.g. pressed Sign in on the landing page): go straight to the app.
  const signedIn = !!parent.data && !error && !pendingToken;
  useEffect(() => {
    if (signedIn) router.replace('/app');
  }, [signedIn, router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center px-5 pt-[max(24px,env(safe-area-inset-top))] pb-10 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- a small local logo, cached by the service worker */}
      <img src="/logo.png" alt="Little Ants English" className="h-28 w-auto" width={163} height={112} />
      <h1 className="mt-4 font-display text-5xl leading-none font-extrabold text-ant-500">Listening Time</h1>
      <p className="mt-2 text-bark-500">
        Songs, stories and rhymes from class, a few minutes a day.
        <Vi>Bài hát, câu chuyện và vè ở lớp, mỗi ngày vài phút.</Vi>
      </p>
      <div className="mt-8 w-full">
        {pendingToken ? <DeviceChooser token={pendingToken} /> : <SignInCard error={error} />}
      </div>
    </main>
  );
}

function SignInCard({ error }: { error: string | null }) {
  const staff = useStaffMe();
  const message = error ? (ERRORS[error] ?? OTHER_ERROR) : null;
  return (
    <div className="flex flex-col items-center gap-5">
      {message ? (
        <Notice tone="warn" className="w-full text-left">
          {message.en}
          <Vi>{message.vi}</Vi>
        </Notice>
      ) : null}
      <a href={parentSignInUrl('/app')} className={`${ctaClass} min-h-14 w-full max-w-sm`}>
        <GoogleMark />
        <span className="flex flex-col items-start text-left leading-tight">
          Sign in with Google
          <span lang="vi" className="font-sans text-sm font-semibold opacity-90">
            Đăng nhập bằng Google
          </span>
        </span>
      </a>
      <p className="text-sm text-bark-500">
        Use the email address you gave the school.
        <Vi>Dùng địa chỉ email phụ huynh đã đăng ký với nhà trường.</Vi>
      </p>
      <section className="mt-4 w-full rounded-2xl bg-cream-100 p-4 text-left text-sm">
        <h2 className="font-bold">Teachers</h2>
        {staff.data ? (
          <p className="mt-1">
            You are signed in as {staff.data.user.name}.{' '}
            <Link href="/app" className="font-semibold text-leaf-700 underline">
              Open At school
            </Link>
          </p>
        ) : (
          <p className="mt-1 text-bark-500">
            Sign in to the{' '}
            <a href={TEACHER_APP_URL} className="font-semibold text-leaf-700 underline">
              Teacher app
            </a>{' '}
            first, then come back here to play Listening Time on the classroom screen (At school).
          </p>
        )}
      </section>
    </div>
  );
}

/** Two devices are already signed in: pick one to sign out, then this device is signed in. */
function DeviceChooser({ token }: { token: string }) {
  const pending = useQuery({
    queryKey: ['pending-devices', token],
    queryFn: () => api.get<PendingDevices>(`/parent/auth/pending/${encodeURIComponent(token)}`),
    retry: false,
  });
  const [chosen, setChosen] = useState<string | null>(null);
  const replace = useMutation({
    mutationFn: (signOutSessionId: string) =>
      api.post(`/parent/auth/pending/${encodeURIComponent(token)}`, { signOutSessionId }),
    onSuccess: () => window.location.replace('/app'),
  });

  if (pending.isPending) return <Spinner label="Loading your devices" />;
  if (pending.error)
    return (
      <Expired>
        <ErrorNotice error={pending.error} />
      </Expired>
    );

  return (
    <div className="flex flex-col gap-4 text-left">
      <Notice>
        Listening can be used on two devices. Choose one to sign out, and this device
        {pending.data.newDevice ? ` (${pending.data.newDevice})` : ''} is signed in instead.
        <Vi>
          Mỗi tài khoản dùng được trên 2 thiết bị. Chọn một thiết bị để đăng xuất, thiết bị này sẽ được đăng
          nhập.
        </Vi>
      </Notice>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-bold">Sign out this device · Đăng xuất thiết bị</legend>
        {pending.data.devices.map((device) => (
          <label
            key={device.id}
            className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 ring-2 ${chosen === device.id ? 'bg-sun-100 ring-sun-400' : 'bg-cream-100 ring-transparent'}`}
          >
            <input
              type="radio"
              name="device"
              value={device.id}
              checked={chosen === device.id}
              onChange={() => setChosen(device.id)}
              className="size-5 accent-leaf-600"
            />
            <span>
              <span className="block font-semibold">{device.deviceLabel ?? 'Device'}</span>
              <span className="text-sm text-bark-500">
                Last used · Dùng lần cuối: {lastUsed(device.lastSeenAt)}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      {replace.error ? <ErrorNotice error={replace.error} /> : null}
      <Button
        size="xl"
        disabled={!chosen}
        busy={replace.isPending}
        onClick={() => chosen && replace.mutate(chosen)}
        className="rounded-full"
      >
        Sign out that device and continue · Tiếp tục
      </Button>
      <Link href="/signin" className="text-center text-sm font-semibold text-bark-500 underline">
        Cancel · Huỷ
      </Link>
    </div>
  );
}

function Expired({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4">
      {children}
      <p className="text-sm text-bark-500">
        This sign-in has expired. Please sign in again.
        <Vi>Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.</Vi>
      </p>
      <Link href="/signin" className={ctaClass}>
        Sign in again · Đăng nhập lại
      </Link>
    </div>
  );
}

/** Google's "G", drawn on white so it stays recognisable on the red button. */
function GoogleMark() {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white" aria-hidden>
      <svg viewBox="0 0 48 48" className="size-6">
        <path
          fill="#EA4335"
          d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.8 6C12.4 13.6 17.7 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"
        />
        <path
          fill="#FBBC05"
          d="M10.5 28.8c-.5-1.4-.8-3-.8-4.8s.3-3.3.8-4.8l-7.8-6C1 16.5 0 20.1 0 24s1 7.5 2.7 10.8l7.8-6z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.7l-7.8 6C6.6 42.6 14.6 48 24 48z"
        />
      </svg>
    </span>
  );
}
