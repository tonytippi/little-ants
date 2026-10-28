'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge, StatusBadge } from '@little-ants/ui/badge';
import { Card, EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { ListeningChart } from '../../components/dashboard/listening-chart';
import { DataTable, type Column } from '../../components/data-table';
import { NavIcon, type NavIconName } from '../../components/nav-icons';
import { PageHeader } from '../../components/page-header';
import { TEACHER_APP_URL, api } from '../../lib/api';
import { formatDate, usePermissions } from '../../lib/hooks';
import { useCurrentSchool } from '../../lib/school';
import { useMe } from '../../lib/session';
import type { ContentStatus, Dashboard, ImportRunStatus } from '../../lib/types';

/** Lessons in every unit. */
const UNIT_LESSONS = 40;

type SchoolPart = NonNullable<Dashboard['school']>;
type ClassRow = SchoolPart['classes'][number];

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

/** The Admin home page for HQ staff and school admins; teachers are pointed to the Teacher app. */
export default function DashboardPage() {
  const { hasHqRole, runsSchools } = usePermissions();
  if (!hasHqRole && !runsSchools)
    return (
      <EmptyState title="Nothing to manage here">
        Teachers work in the{' '}
        <a href={TEACHER_APP_URL} className="font-semibold text-leaf-700 hover:underline">
          Teacher app
        </a>
        .
      </EmptyState>
    );
  return <DashboardView />;
}

function DashboardView() {
  const { user } = useMe();
  const { runsSchools } = usePermissions();
  const { school, isPending: schoolPending } = useCurrentSchool();
  const schoolId = runsSchools ? school?.id : undefined;
  const query = useQuery({
    queryKey: ['dashboard', schoolId ?? null],
    queryFn: () => api.get<Dashboard>(`/dashboard${schoolId ? `?schoolId=${schoolId}` : ''}`),
    enabled: !runsSchools || !schoolPending,
  });

  return (
    <div>
      <PageHeader
        eyebrow={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={`${greeting()}, ${user.name.split(' ')[0] || user.name}`}
      >
        What is happening across Little Ants today.
      </PageHeader>
      {query.isPending ? <Spinner label="Loading the dashboard" /> : null}
      {query.error ? <ErrorNotice error={query.error} /> : null}
      {query.data ? (
        <div className="flex flex-col gap-10">
          {query.data.network ? <NetworkSection network={query.data.network} /> : null}
          {query.data.school && school ? <SchoolSection name={school.name} data={query.data.school} /> : null}
          {query.data.content ? <ContentSection content={query.data.content} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-extrabold text-bark-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatTile({
  label,
  value,
  detail,
  icon,
  href,
}: {
  label: string;
  value: number;
  detail?: string;
  icon: NavIconName;
  href?: string;
}) {
  const body = (
    <>
      <span className="flex items-center justify-between gap-2 text-sm font-semibold text-bark-500">
        {label}
        <span className="rounded-lg bg-leaf-50 p-1.5 text-leaf-600">
          <NavIcon name={icon} className="size-4" />
        </span>
      </span>
      <span className="mt-2 block text-3xl font-extrabold text-bark-900">
        {value.toLocaleString('en-GB')}
      </span>
      {detail ? <span className="mt-0.5 block text-xs text-bark-500">{detail}</span> : null}
    </>
  );
  const className =
    'la-card block p-4 transition-colors' +
    (href ? ' hover:border-leaf-500 focus-visible:border-leaf-500' : '');
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function NetworkSection({ network }: { network: NonNullable<Dashboard['network']> }) {
  return (
    <Section
      title="All schools"
      action={
        <Link href="/schools" className="text-sm font-semibold text-leaf-700 hover:underline">
          Manage schools
        </Link>
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          label="Schools"
          value={network.activeSchools}
          detail={
            network.schools > network.activeSchools
              ? `${network.schools - network.activeSchools} inactive`
              : 'all active'
          }
          icon="schools"
          href="/schools"
        />
        <StatTile label="Campuses" value={network.campuses} icon="campuses" />
        <StatTile label="Active classes" value={network.activeClasses} icon="classes" />
        <StatTile label="Children in class" value={network.childrenInClass} icon="students" />
        <StatTile label="Parents" value={network.parents} detail="of children in class" icon="parents" />
      </div>
    </Section>
  );
}

function SchoolSection({ name, data }: { name: string; data: SchoolPart }) {
  const { totals } = data;
  const week = data.listening.slice(-7);
  const weekLeaves = week.reduce((sum, day) => sum + day.leaves, 0);

  return (
    <Section title={name}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Children in class" value={totals.childrenInClass} icon="students" href="/students" />
        <StatTile label="Active classes" value={totals.activeClasses} icon="classes" href="/classes" />
        <StatTile
          label="Parents"
          value={totals.parents}
          detail={`${totals.parentsSignedIn} signed in on a device`}
          icon="parents"
          href="/parents"
        />
        <StatTile label="Staff" value={totals.staff} icon="schoolStaff" href="/school-staff" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="font-bold">Home listening</h3>
              <p className="text-xs text-bark-500">
                Leaves finished per day in the student app · last 14 days
              </p>
            </div>
            <p className="text-sm text-bark-500">
              <strong className="text-bark-900">{weekLeaves}</strong> leaves in the last 7 days
            </p>
          </div>
          <ListeningChart days={data.listening} />
        </Card>
        <AttentionCard attention={data.attention} />
      </div>

      <h3 className="mt-6 mb-3 font-bold">Class progress</h3>
      <DataTable
        label="Class progress"
        columns={CLASS_COLUMNS}
        rows={data.classes}
        rowKey={(klass) => klass.id}
        minWidth="40rem"
        empty={
          <EmptyState title="No active classes">
            Create one on the{' '}
            <Link href="/classes" className="font-semibold text-leaf-700 hover:underline">
              Classes
            </Link>{' '}
            page.
          </EmptyState>
        }
      />
    </Section>
  );
}

function AttentionCard({ attention }: { attention: SchoolPart['attention'] }) {
  const items = [
    { count: attention.noConsent, text: 'children without a consent date', href: '/students' },
    { count: attention.noParent, text: 'children without a parent email', href: '/students' },
    { count: attention.classesWithoutTeacher, text: 'classes without a teacher', href: '/classes' },
    { count: attention.classesWithoutUnit, text: 'classes without a unit started', href: '/classes' },
  ].filter((item) => item.count > 0);

  return (
    <Card>
      <h3 className="mb-3 font-bold">Needs attention</h3>
      {items.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl bg-leaf-50 px-3 py-3 text-sm font-semibold text-leaf-700">
          <span aria-hidden>✓</span> Everything is in order.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.text}>
              <Link
                href={item.href}
                className="flex items-center gap-3 rounded-xl border border-cream-200 px-3 py-2.5 text-sm transition-colors hover:border-sun-400 hover:bg-sun-100/40"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sun-100 text-sm font-extrabold text-bark-900">
                  {item.count}
                </span>
                <span className="flex-1 text-bark-700">{item.text}</span>
                <span aria-hidden className="text-bark-500">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function LessonMeter({ klass }: { klass: ClassRow }) {
  if (!klass.currentUnit) return <span className="text-xs text-bark-500">No unit started</span>;
  const done = Math.min(UNIT_LESSONS, klass.nextLesson - 1);
  const percent = Math.round((done / UNIT_LESSONS) * 100);
  return (
    <div className="min-w-40">
      <div className="mb-1 flex justify-between text-xs text-bark-500">
        <span>
          Lesson {klass.nextLesson} of {UNIT_LESSONS}
        </span>
        <span className="tabular-nums">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={`${klass.name}: ${done} of ${UNIT_LESSONS} lessons taught`}
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={UNIT_LESSONS}
        className="h-2 overflow-hidden rounded-full bg-leaf-100"
      >
        <div className="h-full rounded-full bg-leaf-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

const CLASS_COLUMNS: Column<ClassRow>[] = [
  {
    header: 'Class',
    cell: (klass) => (
      <>
        <Link href={`/classes/${klass.id}`} className="font-semibold text-leaf-700 hover:underline">
          {klass.name}
        </Link>
        <p className="text-xs text-bark-500">{klass.campus.name}</p>
      </>
    ),
  },
  {
    header: 'Unit',
    cell: (klass) =>
      klass.currentUnit ? (
        <span>
          <strong className="text-bark-900">{klass.currentUnit.code}</strong> · {klass.currentUnit.title}
        </span>
      ) : (
        '—'
      ),
  },
  { header: 'Progress', cell: (klass) => <LessonMeter klass={klass} /> },
  { header: 'Children', cell: (klass) => klass.children },
  {
    header: 'Last taught',
    cell: (klass) => (
      <span className="text-xs">{klass.lastTaughtAt ? formatDate(klass.lastTaughtAt) : 'not yet'}</span>
    ),
  },
];

const SYNC_BADGE: Record<ImportRunStatus, { tone: 'leaf' | 'ant' | 'sun' | 'neutral'; label: string }> = {
  QUEUED: { tone: 'neutral', label: 'Queued' },
  RUNNING: { tone: 'sun', label: 'Running' },
  SUCCEEDED: { tone: 'leaf', label: 'Succeeded' },
  FAILED: { tone: 'ant', label: 'Failed' },
};

const STATUS_ORDER: ContentStatus[] = ['DRAFT', 'REVIEW', 'APPROVED', 'ARCHIVED'];

function ContentSection({ content }: { content: NonNullable<Dashboard['content']> }) {
  const { isAdmin } = usePermissions();
  const total = STATUS_ORDER.reduce((sum, status) => sum + content.units[status], 0);
  const sync = content.lastSync;

  return (
    <Section
      title="Content"
      action={
        <Link href="/units" className="text-sm font-semibold text-leaf-700 hover:underline">
          All units
        </Link>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <h3 className="mb-3 font-bold">Units</h3>
          <p className="text-3xl font-extrabold text-bark-900">{total}</p>
          <p className="mb-3 text-xs text-bark-500">{content.published} published for teachers</p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {STATUS_ORDER.map((status) => (
              <li key={status} className="flex items-center justify-between">
                <StatusBadge status={status} />
                <span className="font-semibold tabular-nums">{content.units[status]}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h3 className="mb-3 font-bold">Waiting for review</h3>
          {content.waitingReview.length === 0 ? (
            <p className="text-sm text-bark-500">No unit is waiting for review.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-cream-200 text-sm">
              {content.waitingReview.map((unit) => (
                <li key={unit.code} className="py-2">
                  <Link href={`/units/${unit.code}`} className="font-semibold text-leaf-700 hover:underline">
                    {unit.code} · {unit.title}
                  </Link>
                  <p className="text-xs text-bark-500">updated {formatDate(unit.updatedAt)}</p>
                </li>
              ))}
            </ul>
          )}
          {content.units.REVIEW > content.waitingReview.length ? (
            <p className="mt-2 text-xs text-bark-500">
              and {content.units.REVIEW - content.waitingReview.length} more on the Units page
            </p>
          ) : null}
        </Card>
        <Card>
          <h3 className="mb-3 font-bold">Drive sync</h3>
          {sync ? (
            <>
              <Badge tone={SYNC_BADGE[sync.status].tone}>{SYNC_BADGE[sync.status].label}</Badge>
              <p className="mt-2 text-sm text-bark-700">
                {sync.finishedAt
                  ? `Finished ${formatDate(sync.finishedAt, true)}`
                  : `Requested ${formatDate(sync.createdAt, true)}`}
              </p>
              {sync.message ? (
                <p className="mt-1 line-clamp-3 text-xs text-bark-500">{sync.message}</p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-bark-500">No sync yet.</p>
          )}
          {isAdmin ? (
            <Link
              href="/imports"
              className="mt-3 inline-block text-sm font-semibold text-leaf-700 hover:underline"
            >
              Open Drive sync
            </Link>
          ) : null}
        </Card>
      </div>
    </Section>
  );
}
