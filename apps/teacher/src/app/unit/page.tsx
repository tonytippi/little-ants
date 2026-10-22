'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { buttonClass } from '@little-ants/ui/button';
import { Spinner } from '@little-ants/ui/feedback';
import { AppShell } from '../../components/app-shell';
import { DownloadButton } from '../../components/download-button';
import { LessonList } from '../../components/lesson-list';
import { ReleaseGate } from '../../components/release-gate';
import { UnitPictures } from '../../components/unit-pictures';
import { links } from '../../lib/links';
import { useDownloadedVersions, usePublishedUnits, useTeachClasses } from '../../lib/queries';
import { RequireStaff } from '../../lib/session';

function Unit() {
  const params = useSearchParams();
  const unit = params.get('unit')?.toUpperCase() ?? null;
  const classId = params.get('class');
  const classes = useTeachClasses();
  const units = usePublishedUnits();
  const downloads = useDownloadedVersions();
  const klass = classes.data?.data.find((item) => item.id === classId);
  const latest = units.data?.data.find((item) => item.code === unit)?.release.version;
  const local = unit ? downloads.data?.[unit] : undefined;

  return (
    <AppShell back={{ href: '/', label: 'Today' }}>
      <ReleaseGate unit={unit}>
        {(payload) => (
          <>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-ant-500">
                  {payload.unit.code} · Level {payload.unit.level.number} {payload.unit.level.name}
                </p>
                <h1 className="text-3xl font-extrabold text-bark-900">{payload.unit.title}</h1>
                <p className="mt-1 text-bark-700">Big question: {payload.unit.bigQuestion}</p>
                {klass ? (
                  <p className="mt-1 text-sm text-bark-500">
                    Class {klass.name} · next lesson {klass.nextLesson}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-2">
                {unit ? (
                  <DownloadButton
                    code={unit}
                    localVersion={local?.version}
                    latestVersion={latest}
                    mediaBytes={local?.mediaBytes}
                  />
                ) : null}
                {klass ? (
                  <Link
                    href={links.observe(klass.id, payload.unit.code, klass.nextLesson)}
                    className={buttonClass('secondary')}
                  >
                    Observe children
                  </Link>
                ) : null}
              </div>
            </div>
            <UnitPictures unit={payload.unit} />
            <LessonList
              payload={payload}
              highlight={klass?.currentUnit?.code === payload.unit.code ? klass.nextLesson : undefined}
              actions={{
                teach: (lesson) => links.teach({ unit: payload.unit.code, lesson, classId }),
                prepare: (lesson) => links.prepare({ unit: payload.unit.code, lesson, classId }),
                print: (lesson) => links.print({ unit: payload.unit.code, lesson }),
              }}
            />
          </>
        )}
      </ReleaseGate>
    </AppShell>
  );
}

export default function UnitPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <RequireStaff appName="Teacher">
        <Unit />
      </RequireStaff>
    </Suspense>
  );
}
