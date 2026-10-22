'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button, buttonClass } from '@little-ants/ui/button';
import { ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { FormError } from '../../../../components/form-error';
import { HistoryButton } from '../../../../components/history-panel';
import { PageHeader } from '../../../../components/page-header';
import { StatusActions } from '../../../../components/status-actions';
import { Tabs } from '../../../../components/tabs';
import { GatesTab } from '../../../../components/unit/gates-tab';
import { LessonsTab } from '../../../../components/unit/lessons-tab';
import { MaterialsTab } from '../../../../components/unit/materials-tab';
import { OverviewTab } from '../../../../components/unit/overview-tab';
import { ProductionTab } from '../../../../components/unit/production-tab';
import { ReleasesTab } from '../../../../components/unit/releases-tab';
import { TeacherNotesTab } from '../../../../components/unit/teacher-notes-tab';
import { ValidationTab } from '../../../../components/unit/validation-tab';
import { WordsTab } from '../../../../components/unit/words-tab';
import { TEACHER_APP_URL, api } from '../../../../lib/api';
import { useApiMutation, usePermissions } from '../../../../lib/hooks';
import type { UnitDetail } from '../../../../lib/types';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'words', label: 'Words' },
  { id: 'materials', label: 'Materials' },
  { id: 'lessons', label: 'Lessons' },
  { id: 'production', label: 'Production' },
  { id: 'validation', label: 'Validation' },
  { id: 'gates', label: 'Gate checks' },
  { id: 'notes', label: 'Teacher notes' },
  { id: 'releases', label: 'Releases' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function UnitPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (TABS.find((item) => item.id === searchParams.get('tab'))?.id ?? 'overview') as TabId;
  const { canEdit, canReview } = usePermissions();
  const key = ['unit', code];
  const query = useQuery({ queryKey: key, queryFn: () => api.get<UnitDetail>(`/content/units/${code}`) });
  const invalidate = [key, ['units']];
  const submitAll = useApiMutation(
    () => api.post<Record<string, number>>(`/content/units/${code}/submit-all`),
    invalidate,
  );
  const approveAll = useApiMutation(
    () => api.post<Record<string, number>>(`/content/units/${code}/approve-all`),
    invalidate,
  );

  if (query.isPending) return <Spinner label="Loading unit" />;
  if (query.error) return <ErrorNotice error={query.error} />;
  const unit = query.data;

  const bulkResult = submitAll.data ?? approveAll.data;
  return (
    <div>
      <PageHeader
        back={{ href: '/', label: 'All units' }}
        eyebrow={`${unit.code} · Level ${unit.level.number} ${unit.level.name} · ${unit.level.ageBand}`}
        title={unit.title}
        actions={
          <>
            <a
              href={`${TEACHER_APP_URL}/preview/${unit.code}`}
              target="_blank"
              rel="noreferrer"
              className={buttonClass('secondary', 'sm')}
            >
              Preview in Teacher app
            </a>
            <Link href={`/print/units/${unit.code}/words`} className={buttonClass('ghost', 'sm')}>
              Print word list
            </Link>
            {canEdit ? (
              <Button
                size="sm"
                variant="secondary"
                busy={submitAll.isPending}
                onClick={() =>
                  window.confirm('Send every draft item in this unit for review?') &&
                  submitAll.mutate(undefined)
                }
              >
                Submit all for review
              </Button>
            ) : null}
            {canReview ? (
              <Button
                size="sm"
                busy={approveAll.isPending}
                onClick={() =>
                  window.confirm('Approve every item in review in this unit, including its files?') &&
                  approveAll.mutate(undefined)
                }
              >
                Approve all
              </Button>
            ) : null}
          </>
        }
      >
        {unit.bigQuestion ? `Big Question: ${unit.bigQuestion}` : null}
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <StatusActions
          status={unit.status}
          version={unit.version}
          statusPath={`/content/units/${unit.code}/status`}
          invalidate={invalidate}
        />
        <HistoryButton
          entityType="unit"
          entityId={unit.id}
          current={unit as unknown as Record<string, unknown>}
          invalidate={invalidate}
        />
      </div>
      {submitAll.error ? <FormError error={submitAll.error} /> : null}
      {approveAll.error ? <FormError error={approveAll.error} /> : null}
      {bulkResult ? (
        <p role="status" className="mb-4 rounded-lg bg-leaf-50 px-3 py-2 text-sm text-leaf-700">
          Updated{' '}
          {Object.entries(bulkResult)
            .map(([entity, count]) => `${count} ${entity}${count === 1 ? '' : 's'}`)
            .join(', ')}
          .
        </p>
      ) : null}

      <Tabs
        tabs={[...TABS]}
        active={tab}
        label="Unit sections"
        onChange={(id) => router.replace(`/units/${code}?tab=${id}`, { scroll: false })}
      />
      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="pt-5">
        {tab === 'overview' ? <OverviewTab unit={unit} /> : null}
        {tab === 'words' ? <WordsTab unit={unit} /> : null}
        {tab === 'materials' ? <MaterialsTab unit={unit} /> : null}
        {tab === 'lessons' ? <LessonsTab unit={unit} /> : null}
        {tab === 'production' ? <ProductionTab code={unit.code} /> : null}
        {tab === 'validation' ? <ValidationTab code={unit.code} /> : null}
        {tab === 'gates' ? <GatesTab unit={unit} /> : null}
        {tab === 'notes' ? <TeacherNotesTab code={unit.code} /> : null}
        {tab === 'releases' ? <ReleasesTab unit={unit} /> : null}
      </div>
    </div>
  );
}
