'use client';

import Link from 'next/link';
import { buttonClass } from '@little-ants/ui/button';
import { Badge } from '@little-ants/ui/badge';
import { EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { AppShell } from '../components/app-shell';
import { DownloadButton } from '../components/download-button';
import { UnitArt, ctaClass } from '@little-ants/ui/storybook';
import { links } from '../lib/links';
import { useDownloadedVersions, usePublishedUnits, useTeachClasses } from '../lib/queries';
import { RequireStaff, useMe } from '../lib/session';
import type { TeachClass } from '../lib/types';

const WEEKDAYS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function ClassCard({
  klass,
  downloaded,
}: {
  klass: TeachClass;
  downloaded: Record<string, { version: number; mediaBytes: number }>;
}) {
  const unit = klass.currentUnit;
  const local = unit ? downloaded[unit.code] : undefined;
  const lesson = { unit: unit?.code ?? '', lesson: klass.nextLesson, classId: klass.id };
  const today = ((new Date().getDay() + 6) % 7) + 1;
  const lessonToday = klass.lessonDays.includes(today);
  return (
    <article className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-cream-200 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-2xl font-extrabold leading-tight text-bark-900">{klass.name}</h2>
          <p className="text-sm text-bark-500">
            {klass.campus.name} · Level {klass.level.number} {klass.level.name} · {klass.students.length}{' '}
            children
          </p>
        </div>
        <Badge tone={lessonToday ? 'leaf' : 'neutral'}>
          {lessonToday ? 'English today' : klass.lessonDays.map((d) => WEEKDAYS[d]).join(' ')}
        </Badge>
      </div>

      {unit ? (
        <>
          <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-ant-600">{unit.code}</p>
              <p className="font-display text-3xl font-extrabold leading-none text-ant-500">{unit.title}</p>
              <p className="mt-2 font-semibold text-leaf-700">Next: Lesson {klass.nextLesson} of 40</p>
            </div>
            <UnitArt picture={unit.picture} className="aspect-video h-auto max-h-44 w-full" />
          </div>
          {unit.release || local ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={links.teach(lesson)} className={ctaClass}>
                  ▶ Teach lesson {klass.nextLesson}
                </Link>
                <Link href={links.prepare(lesson)} className={buttonClass('secondary', 'lg')}>
                  Prepare
                </Link>
                <Link
                  href={links.observe(klass.id, unit.code, klass.nextLesson)}
                  className={buttonClass('secondary', 'lg')}
                >
                  Observe
                </Link>
                <Link href={links.unit(unit.code, klass.id)} className={buttonClass('ghost', 'lg')}>
                  All lessons
                </Link>
                <Link href={links.listening(klass.id)} className={buttonClass('ghost', 'lg')}>
                  Home listening
                </Link>
              </div>
              <DownloadButton
                code={unit.code}
                localVersion={local?.version}
                latestVersion={unit.release?.version}
                mediaBytes={local?.mediaBytes}
              />
            </>
          ) : (
            <p className="text-sm text-bark-500">
              This unit has not been published yet. Ask the program team.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-bark-500">
          No unit is set for this class yet. Ask an admin to set the current unit.
        </p>
      )}
    </article>
  );
}

function Today() {
  const { user } = useMe();
  const classes = useTeachClasses();
  const units = usePublishedUnits();
  const downloads = useDownloadedVersions();
  const downloaded = downloads.data ?? {};

  return (
    <AppShell>
      <h1 className="font-display text-4xl font-extrabold text-ant-500">Hello, {user.name.split(' ')[0]}!</h1>
      {classes.data?.stale ? (
        <p className="mt-1 text-sm text-bark-500">
          Offline: showing your classes from the last time you were online.
        </p>
      ) : null}

      <section className="mt-6" aria-labelledby="classes-heading">
        <h2 id="classes-heading" className="sr-only">
          My classes
        </h2>
        {classes.isPending ? <Spinner label="Loading your classes" /> : null}
        {classes.error ? <ErrorNotice error={classes.error} /> : null}
        {classes.data && classes.data.data.length === 0 ? (
          <EmptyState title="You have no classes yet">
            An admin assigns teachers to classes in Little Ants Admin.
          </EmptyState>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-2">
          {classes.data?.data.map((klass) => (
            <ClassCard key={klass.id} klass={klass} downloaded={downloaded} />
          ))}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="units-heading">
        <h2 id="units-heading" className="font-display text-2xl font-extrabold text-bark-900">
          All published units
        </h2>
        <p className="text-sm text-bark-500">
          Open any unit to read or print its lessons. Download units before class so they work without Wi-Fi.
        </p>
        {units.isPending ? <Spinner label="Loading units" /> : null}
        {units.error ? <ErrorNotice error={units.error} /> : null}
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {units.data?.data.map((unit) => (
            <li
              key={unit.code}
              className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-cream-200 bg-white p-4"
            >
              <Link href={links.unit(unit.code)} className="group flex flex-col gap-2">
                <UnitArt picture={unit.picture} className="aspect-video h-auto w-full bg-cream-50" />
                <span className="text-xs font-bold uppercase tracking-wide text-ant-600">
                  {unit.code} · Level {unit.level.number}
                </span>
                <span className="font-display text-xl font-bold leading-tight text-bark-900 group-hover:text-ant-500">
                  {unit.title}
                </span>
              </Link>
              <div className="mt-auto">
                <DownloadButton
                  compact
                  code={unit.code}
                  localVersion={downloaded[unit.code]?.version}
                  latestVersion={unit.release.version}
                  mediaBytes={downloaded[unit.code]?.mediaBytes}
                />
              </div>
            </li>
          ))}
          {units.data && units.data.data.length === 0 ? (
            <li className="text-sm text-bark-500">No units are published yet.</li>
          ) : null}
        </ul>
      </section>
    </AppShell>
  );
}

export default function TodayPage() {
  return (
    <RequireStaff appName="Teacher">
      <Today />
    </RequireStaff>
  );
}
