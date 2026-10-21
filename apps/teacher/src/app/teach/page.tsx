'use client';

import { Suspense } from 'react';
import { Spinner } from '@little-ants/ui/feedback';
import { LessonPlayer } from '../../components/player/lesson-player';
import { ReleaseGate } from '../../components/release-gate';
import { useLessonParams } from '../../lib/search';
import { RequireStaff } from '../../lib/session';

function Teach() {
  const { unit, lesson, classId } = useLessonParams();
  return (
    <ReleaseGate unit={unit}>
      {(payload) => (
        <LessonPlayer key={`${unit}-${lesson}`} payload={payload} lessonNumber={lesson} classId={classId} />
      )}
    </ReleaseGate>
  );
}

export default function TeachPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <RequireStaff appName="Teacher">
        <Teach />
      </RequireStaff>
    </Suspense>
  );
}
