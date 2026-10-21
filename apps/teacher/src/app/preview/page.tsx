'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Spinner } from '@little-ants/ui/feedback';
import { AppShell } from '../../components/app-shell';
import { LessonList } from '../../components/lesson-list';
import { LessonPlayer } from '../../components/player/lesson-player';
import { ReleaseGate } from '../../components/release-gate';
import { links } from '../../lib/links';
import { RequireStaff } from '../../lib/session';

/** Staff preview of the current draft (opened from Admin). Online only; nothing is recorded. */
function Preview() {
  const params = useSearchParams();
  const unit = params.get('unit')?.toUpperCase() ?? null;
  const lessonParam = params.get('lesson');
  if (lessonParam) {
    return (
      <ReleaseGate unit={unit} preview>
        {(payload) => (
          <LessonPlayer
            key={lessonParam}
            preview
            payload={payload}
            lessonNumber={Number(lessonParam)}
            classId={null}
          />
        )}
      </ReleaseGate>
    );
  }
  return (
    <AppShell back={{ href: '/', label: 'Today' }}>
      <div className="mb-4 rounded-xl bg-sun-100 px-4 py-3 text-sm font-semibold text-bark-900">
        Preview — draft content. Nothing is recorded.
      </div>
      <ReleaseGate unit={unit} preview>
        {(payload) => (
          <>
            <h1 className="mb-6 text-3xl font-extrabold text-bark-900">
              {payload.unit.code} · {payload.unit.title}
            </h1>
            <LessonList
              payload={payload}
              actions={{
                teach: (lesson) => links.preview(payload.unit.code, lesson),
              }}
            />
          </>
        )}
      </ReleaseGate>
    </AppShell>
  );
}

export default function PreviewPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <RequireStaff appName="Teacher">
        <Preview />
      </RequireStaff>
    </Suspense>
  );
}
