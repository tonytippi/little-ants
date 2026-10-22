'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@little-ants/ui/badge';
import { Button } from '@little-ants/ui/button';
import { EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { api } from '../../lib/api';
import type { RuleFinding } from '../../lib/types';

const GROUPS: { severity: RuleFinding['severity']; title: string; tone: 'ant' | 'sun' | 'neutral' }[] = [
  { severity: 'error', title: 'Errors (block publishing)', tone: 'ant' },
  { severity: 'warning', title: 'Warnings', tone: 'sun' },
  { severity: 'info', title: 'Notes', tone: 'neutral' },
];

/** Checks from the Content Writing Rules that a machine can do. */
export function ValidationTab({ code }: { code: string }) {
  const query = useQuery({
    queryKey: ['validation', code],
    queryFn: () => api.get<RuleFinding[]>(`/content/units/${code}/validation`),
  });
  if (query.isPending) return <Spinner label="Checking the unit" />;
  if (query.error) return <ErrorNotice error={query.error} />;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <p className="text-sm text-bark-500">
          Word counts, review share, story length, lesson steps and materials.
        </p>
        <Button size="sm" variant="ghost" busy={query.isFetching} onClick={() => void query.refetch()}>
          Check again
        </Button>
      </div>
      {query.data.length === 0 ? (
        <EmptyState title="No problems found">
          This unit follows every rule that can be checked automatically.
        </EmptyState>
      ) : null}
      {GROUPS.map((group) => {
        const findings = query.data.filter((finding) => finding.severity === group.severity);
        if (findings.length === 0) return null;
        return (
          <section key={group.severity} aria-labelledby={`findings-${group.severity}`}>
            <h2 id={`findings-${group.severity}`} className="mb-2 flex items-center gap-2 font-bold">
              {group.title} <Badge tone={group.tone}>{findings.length}</Badge>
            </h2>
            <ul className="divide-y divide-cream-200 rounded-xl bg-white ring-1 ring-cream-200">
              {findings.map((finding, index) => (
                <li key={`${finding.where}-${index}`} className="flex flex-wrap gap-x-3 px-4 py-2 text-sm">
                  <span className="w-28 shrink-0 font-semibold">{finding.where}</span>
                  <span className="flex-1">{finding.message}</span>
                  <span className="text-xs text-bark-500">{finding.rule}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
