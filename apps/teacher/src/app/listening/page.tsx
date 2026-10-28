'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import QRCode from 'qrcode';
import { Suspense, useEffect, useState } from 'react';
import { Button } from '@little-ants/ui/button';
import { ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { AppShell } from '../../components/app-shell';
import { api } from '../../lib/api';
import { useTeachClasses } from '../../lib/queries';
import { RequireStaff } from '../../lib/session';

/** The student (Listening Time) app that parents open (set NEXT_PUBLIC_STUDENT_APP_URL in production). */
const STUDENT_APP_URL = process.env.NEXT_PUBLIC_STUDENT_APP_URL ?? 'http://localhost:3003';
/** The program's class goal: this share of children listen on 4+ days a week. */
const CLASS_GOAL = 0.8;

interface ClassListening {
  goalDays: number;
  reachedThisWeek: number;
  children: {
    id: string;
    displayName: string;
    hasParent: boolean;
    weeks: { weekStart: string; days: number }[];
  }[];
}

/** Today on this device, as the API expects (YYYY-MM-DD). */
function localDay(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function shortDate(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function HomeListening() {
  const params = useSearchParams();
  const classId = params.get('class') ?? '';
  const classes = useTeachClasses();
  const klass = classes.data?.data.find((item) => item.id === classId);
  const listening = useQuery({
    queryKey: ['teach', 'listening', classId],
    queryFn: () => api.get<ClassListening>(`/teach/classes/${classId}/listening?today=${localDay()}`),
    enabled: Boolean(classId),
  });

  return (
    <AppShell back={{ href: '/', label: 'Today' }}>
      <p className="text-sm font-bold uppercase tracking-wide text-ant-600">Listening Time</p>
      <h1 className="font-display text-4xl font-extrabold text-ant-500">Home listening</h1>
      <p className="mt-1 text-bark-700">
        {klass ? `${klass.name} · ` : ''}Goal: every child listens on {listening.data?.goalDays ?? 4} or more
        days a week, and {Math.round(CLASS_GOAL * 100)}% of the class reaches it.
      </p>
      {listening.isPending ? <Spinner label="Loading home listening" /> : null}
      {listening.error ? <ErrorNotice error={listening.error} /> : null}
      {listening.data ? <Progress data={listening.data} /> : null}
      <ShareCard />
    </AppShell>
  );
}

function Progress({ data }: { data: ClassListening }) {
  const total = data.children.length;
  const share = total ? data.reachedThisWeek / total : 0;
  const weeks = data.children[0]?.weeks ?? [];
  return (
    <>
      <section className="mt-6 rounded-[var(--radius-card)] border border-cream-200 bg-white p-5">
        <p className="font-display text-2xl font-bold text-bark-900">
          {data.reachedThisWeek} of {total} children reached {data.goalDays} days this week
        </p>
        <div
          className="mt-3 h-3 overflow-hidden rounded-full bg-cream-200"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(share * 100)}
          aria-label="Share of the class that reached the goal"
        >
          <div
            className={`h-full rounded-full ${share >= CLASS_GOAL ? 'bg-leaf-600' : 'bg-sun-400'}`}
            style={{ width: `${Math.round(share * 100)}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-bark-500">
          {share >= CLASS_GOAL
            ? 'The class reached its goal this week. Celebrate it together!'
            : `${Math.round(share * 100)}% so far; the class goal is ${Math.round(CLASS_GOAL * 100)}%.`}{' '}
          Families with 0–1 days are highlighted: send them a kind tip and offer help with the app.
        </p>
      </section>

      <section className="mt-6 overflow-x-auto rounded-[var(--radius-card)] border border-cream-200 bg-white">
        <table className="w-full min-w-[40rem] text-sm">
          <caption className="sr-only">Days with home listening per week</caption>
          <thead className="bg-cream-100 text-left text-xs uppercase tracking-wide text-bark-500">
            <tr>
              <th className="px-4 py-2">Child</th>
              {weeks.map((week, index) => (
                <th key={week.weekStart} className="px-2 py-2 text-center">
                  {index === 0 ? 'This week' : shortDate(week.weekStart)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.children.map((child) => {
              const now = child.weeks[0]?.days ?? 0;
              return (
                <tr key={child.id} className={`border-t border-cream-200 ${now <= 1 ? 'bg-sun-100/60' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-bark-900">{child.displayName}</span>
                    {child.hasParent ? null : (
                      <span className="block text-xs text-bark-500">
                        No parent email yet (ask the school admin)
                      </span>
                    )}
                  </td>
                  {child.weeks.map((week) => (
                    <td key={week.weekStart} className="px-2 py-3 text-center">
                      {week.days >= data.goalDays ? (
                        <span className="font-bold text-leaf-700" title={`${week.days} days`}>
                          ★ {week.days}
                        </span>
                      ) : (
                        <span className={week.days === 0 ? 'text-bark-500' : 'text-bark-900'}>
                          {week.days}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}

/** The link and QR code teachers send to the class group (Zalo) before Lesson 1. */
function ShareCard() {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    void QRCode.toDataURL(STUDENT_APP_URL, {
      margin: 1,
      width: 360,
      color: { dark: '#4a2e20', light: '#ffffff' },
    }).then(setQr);
  }, []);
  return (
    <section className="mt-6 grid gap-6 rounded-[var(--radius-card)] border border-cream-200 bg-white p-5 sm:grid-cols-[auto_1fr]">
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="QR code of the Listening Time app" className="size-44 rounded-xl" />
      ) : null}
      <div>
        <h2 className="font-display text-2xl font-bold text-bark-900">Listening Time link for parents</h2>
        <p className="mt-1 text-sm text-bark-700">
          Send this link or QR code to the class group. Parents sign in with the Google account whose email
          the school entered for their child.
        </p>
        <p className="mt-1 text-sm text-bark-500">
          Gửi đường link hoặc mã QR này vào nhóm lớp. Phụ huynh đăng nhập bằng tài khoản Google có email mà
          nhà trường đã đăng ký cho con.
        </p>
        <p className="mt-3 break-all font-semibold text-leaf-700">{STUDENT_APP_URL}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              void navigator.clipboard.writeText(STUDENT_APP_URL).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              })
            }
          >
            {copied ? 'Copied' : 'Copy link'}
          </Button>
          {qr ? (
            <a
              href={qr}
              download="listening-time-qr.png"
              className="text-sm font-semibold text-bark-700 underline"
            >
              Download QR code
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default function ListeningPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <RequireStaff appName="Teacher">
        <HomeListening />
      </RequireStaff>
    </Suspense>
  );
}
