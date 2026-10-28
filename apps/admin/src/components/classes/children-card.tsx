'use client';

import { useState } from 'react';
import { Button } from '@little-ants/ui/button';
import { Card, EmptyState } from '@little-ants/ui/feedback';
import { api } from '../../lib/api';
import { formatDay, useApiMutation } from '../../lib/hooks';
import { CHILD_KEYS } from '../../lib/org';
import type { ClassDetail, Enrollment, EnrollmentEnd } from '../../lib/types';
import { FormError } from '../form-error';
import { StudentActions } from '../students/student-actions';
import { AddChildDialog } from '../students/student-dialogs';

export const END_REASON: Record<EnrollmentEnd, string> = {
  LEFT: 'left',
  MOVED: 'moved to another class',
  MERGED: 'class merged',
  CLASS_STOPPED: 'class stopped',
};

/** Children in the class now, with the former children (moved, left or ended with the class) below. */
export function ChildrenCard({ klass }: { klass: ClassDetail }) {
  const [adding, setAdding] = useState(false);
  const active = klass.status === 'ACTIVE';
  const schoolId = klass.campus.school.id;
  const current = klass.enrollments.filter((enrollment) => !enrollment.endedOn);
  const former = klass.enrollments.filter((enrollment) => enrollment.endedOn);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-bold">Children ({current.length})</h2>
        {active ? (
          <Button size="sm" onClick={() => setAdding(true)}>
            + Add child
          </Button>
        ) : null}
      </div>
      {current.length === 0 ? (
        <EmptyState title={active ? 'No children yet' : 'No children in this class any more'} />
      ) : (
        <ul className="divide-y divide-cream-200">
          {current.map(({ id, student }) => (
            <li key={id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0">
                <span className="font-semibold">{student.displayName}</span>
                <span className="text-bark-500">
                  {' '}
                  · {student.birthYear ?? 'no birth year'} ·{' '}
                  {student.consentAt ? `consent ${formatDay(student.consentAt)}` : 'no consent recorded'}
                </span>
              </span>
              <StudentActions student={student} schoolId={schoolId} currentClassId={klass.id} />
            </li>
          ))}
        </ul>
      )}
      {former.length ? (
        <FormerChildren
          enrollments={former}
          returnClassId={active ? klass.id : null}
          currentStudentIds={new Set(current.map((enrollment) => enrollment.student.id))}
        />
      ) : null}
      {adding ? (
        <AddChildDialog schoolId={schoolId} classId={klass.id} onClose={() => setAdding(false)} />
      ) : null}
    </Card>
  );
}

interface FormerChildrenProps {
  enrollments: Enrollment[];
  /** This class when it is active: children who left can come back to it. */
  returnClassId: string | null;
  currentStudentIds: Set<string>;
}

function FormerChildren({ enrollments, returnClassId, currentStudentIds }: FormerChildrenProps) {
  // Rows come newest first; only a child's latest stay here can offer "Back in class".
  const seen = new Set<string>();
  return (
    <details className="mt-4">
      <summary className="cursor-pointer text-sm font-semibold text-bark-700">
        Former children ({enrollments.length})
      </summary>
      <ul className="mt-2 divide-y divide-cream-200">
        {enrollments.map((enrollment) => {
          const latest = !seen.has(enrollment.student.id);
          seen.add(enrollment.student.id);
          const canReturn =
            returnClassId !== null &&
            latest &&
            enrollment.endReason === 'LEFT' &&
            !currentStudentIds.has(enrollment.student.id);
          return (
            <FormerChildRow
              key={enrollment.id}
              enrollment={enrollment}
              returnClassId={canReturn ? returnClassId : null}
            />
          );
        })}
      </ul>
    </details>
  );
}

function FormerChildRow({
  enrollment,
  returnClassId,
}: {
  enrollment: Enrollment;
  returnClassId: string | null;
}) {
  const { student } = enrollment;
  // Rejoin refuses a child who has joined another class since (409), so no one is pulled out of a class.
  const back = useApiMutation(
    (classId: string) => api.post(`/students/${student.id}/rejoin`, { classId }),
    CHILD_KEYS,
  );
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <span className="font-semibold">{student.displayName}</span>
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-bark-500">
          {formatDay(enrollment.startedOn)} – {formatDay(enrollment.endedOn)}
          {enrollment.endReason ? ` · ${END_REASON[enrollment.endReason]}` : ''}
        </span>
        {returnClassId ? (
          <Button
            size="sm"
            variant="secondary"
            busy={back.isPending}
            onClick={() => back.mutate(returnClassId)}
          >
            Back in class
          </Button>
        ) : null}
      </span>
      <div className="w-full empty:hidden">
        <FormError error={back.error} />
      </div>
    </li>
  );
}
