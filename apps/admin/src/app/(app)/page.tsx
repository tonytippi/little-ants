'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { StatusBadge } from '@little-ants/ui/badge';
import { EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { PageHeader } from '../../components/page-header';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/hooks';
import type { ContentStatus, UnitSummary } from '../../lib/types';

const STATUS_ORDER: ContentStatus[] = ['DRAFT', 'REVIEW', 'APPROVED', 'ARCHIVED'];

function ProgressBar({ done, total }: { done: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs text-bark-500">
        <span>Production</span>
        <span>
          {percent}% ({done}/{total})
        </span>
      </div>
      <div
        className="mt-1 h-2 overflow-hidden rounded-full bg-cream-200"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Production progress"
      >
        <div className="h-full rounded-full bg-leaf-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function UnitCard({ unit }: { unit: UnitSummary }) {
  return (
    <Link
      href={`/units/${unit.code}`}
      className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-cream-200 bg-white p-4 shadow-xs transition hover:border-leaf-500 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-ant-500">{unit.code}</p>
          <p className="font-bold leading-tight">{unit.title}</p>
          <p className="text-xs text-bark-500">{unit.leadCharacter}</p>
        </div>
        <StatusBadge status={unit.status} />
      </div>
      <p className="text-xs text-bark-500">
        {unit.counts.lessons} lessons · {unit.counts.words} words · {unit.counts.materials} materials
      </p>
      <div className="flex flex-wrap gap-2 text-xs">
        {STATUS_ORDER.filter((status) => unit.contentStatus[status]).map((status) => (
          <span key={status} className="flex items-center gap-1">
            <StatusBadge status={status} />
            <span className="text-bark-500">{unit.contentStatus[status]}</span>
          </span>
        ))}
      </div>
      <ProgressBar done={unit.production.done} total={unit.production.total} />
      <p className="text-xs text-bark-500">
        {unit.latestRelease
          ? `Published v${unit.latestRelease.version} · ${formatDate(unit.latestRelease.publishedAt)}`
          : 'Not published yet'}
      </p>
    </Link>
  );
}

export default function UnitsDashboard() {
  const query = useQuery({
    queryKey: ['units'],
    queryFn: () => api.get<{ units: UnitSummary[] }>('/content/units'),
  });

  if (query.isPending) return <Spinner label="Loading units" />;
  if (query.error) return <ErrorNotice error={query.error} />;
  const units = query.data.units;
  if (units.length === 0)
    return (
      <EmptyState title="No units yet">Run the Master Sheet importer to load the curriculum.</EmptyState>
    );

  const levels = [...new Map(units.map((unit) => [unit.level.number, unit.level])).values()].sort(
    (a, b) => a.number - b.number,
  );
  return (
    <div>
      <PageHeader title="Units">
        Little Ants English 3–6 · edit content, track production and publish units for teachers.
      </PageHeader>
      {levels.map((level) => (
        <section key={level.number} className="mb-8" aria-labelledby={`level-${level.number}`}>
          <h2 id={`level-${level.number}`} className="mb-3 text-lg font-bold text-leaf-700">
            Level {level.number} · {level.name}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {units
              .filter((unit) => unit.level.number === level.number)
              .map((unit) => (
                <UnitCard key={unit.id} unit={unit} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
