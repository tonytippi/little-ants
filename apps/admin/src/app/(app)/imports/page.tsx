'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge } from '@little-ants/ui/badge';
import { Button } from '@little-ants/ui/button';
import { Card, EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { AdminOnly } from '../../../components/admin-only';
import { FormError } from '../../../components/form-error';
import { PageHeader } from '../../../components/page-header';
import { api } from '../../../lib/api';
import { formatDate, useApiMutation } from '../../../lib/hooks';
import type { ImportRun, ImportRunStatus } from '../../../lib/types';

const KEY = ['imports'];

const STATUS: Record<ImportRunStatus, { tone: 'neutral' | 'sun' | 'leaf' | 'ant'; label: string }> = {
  QUEUED: { tone: 'neutral', label: 'Waiting' },
  RUNNING: { tone: 'sun', label: 'Running' },
  SUCCEEDED: { tone: 'leaf', label: 'Done' },
  FAILED: { tone: 'ant', label: 'Failed' },
};

/** A request still waiting after this long usually means the import worker is not running. */
const WORKER_HINT_AFTER_MS = 2 * 60 * 1000;

const isActive = (run: ImportRun): boolean => run.status === 'QUEUED' || run.status === 'RUNNING';

export default function ImportsPage() {
  return (
    <AdminOnly>
      <Imports />
    </AdminOnly>
  );
}

function Imports() {
  const runs = useQuery({
    queryKey: KEY,
    queryFn: () => api.get<ImportRun[]>('/imports'),
    // Follow a sync while it is waiting or running.
    refetchInterval: (query) => (query.state.data?.some(isActive) ? 3000 : false),
  });
  const start = useApiMutation(() => api.post<ImportRun>('/imports', {}), [KEY]);
  const [openId, setOpenId] = useState<string | null>(null);
  const busy = runs.data?.some(isActive) ?? false;

  const confirmAndStart = (): void => {
    const ok = window.confirm(
      'Sync every unit from Google Drive now?\n\nUnit content edited in Admin is replaced by the Drive files. Teachers see the changes after a unit is published again.',
    );
    if (ok) start.mutate(undefined);
  };

  return (
    <div>
      <PageHeader
        title="Drive sync"
        actions={
          <Button onClick={confirmAndStart} busy={start.isPending} disabled={busy}>
            Sync from Google Drive
          </Button>
        }
      >
        While the curriculum is being finished, Google Drive is the source of truth. A sync re-imports all units with their files from the
        shared Drive folder.
      </PageHeader>
      <Card className="mb-6 border-l-4 border-sun-400 text-sm">
        <ul className="list-disc space-y-1 pl-5 text-bark-700">
          <li>Edit unit content in the Drive files, not here: a sync replaces unit content changed in Admin.</li>
          <li>Files uploaded in Admin stay; draft layouts that are no longer on Drive are removed from their materials.</li>
          <li>The database is backed up before every sync, and the Drive files used are archived with the report.</li>
          <li>Teachers keep the last published version until a unit is published again.</li>
        </ul>
      </Card>
      <FormError error={start.error} />
      {runs.isPending ? <Spinner label="Loading syncs" /> : null}
      {runs.error ? <ErrorNotice error={runs.error} /> : null}
      {runs.data?.length === 0 ? <EmptyState title="No syncs yet">Press “Sync from Google Drive” to import the curriculum.</EmptyState> : null}
      {runs.data?.length ? (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-cream-100 text-left text-xs uppercase tracking-wide text-bark-500">
              <tr>
                <th className="px-4 py-2">Requested</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Details</th>
                <th className="px-4 py-2">
                  <span className="sr-only">Report</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {runs.data.map((run) => (
                <RunRow
                  key={run.id}
                  run={run}
                  checkedAt={runs.dataUpdatedAt}
                  open={openId === run.id}
                  onToggle={() => setOpenId(openId === run.id ? null : run.id)}
                />
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
    </div>
  );
}

/** `checkedAt` is when the list was last fetched (it refreshes every few seconds while a sync is active). */
function RunRow({ run, checkedAt, open, onToggle }: { run: ImportRun; checkedAt: number; open: boolean; onToggle: () => void }) {
  const status = STATUS[run.status];
  const waitingLong = run.status === 'QUEUED' && checkedAt - new Date(run.createdAt).getTime() > WORKER_HINT_AFTER_MS;
  return (
    <>
      <tr className="border-t border-cream-200 align-top">
        <td className="px-4 py-3">
          <p className="font-semibold">{formatDate(run.createdAt, true)}</p>
          <p className="text-xs text-bark-500">{run.requestedBy?.name ?? '—'}</p>
        </td>
        <td className="px-4 py-3">
          <Badge tone={status.tone}>{status.label}</Badge>
          {run.finishedAt ? <p className="mt-1 text-xs text-bark-500">{formatDate(run.finishedAt, true)}</p> : null}
        </td>
        <td className="px-4 py-3 text-xs text-bark-700">
          {run.message ? <p className={run.status === 'FAILED' ? 'text-ant-700' : undefined}>{run.message}</p> : null}
          {waitingLong ? <p className="mt-1 text-ant-700">Still waiting: is the import worker running?</p> : null}
          {run.archive ? <p className="mt-1 text-bark-500">Drive files archived in {run.archive}/</p> : null}
        </td>
        <td className="px-4 py-3 text-right">
          {run.status === 'SUCCEEDED' ? (
            <Button size="sm" variant="ghost" onClick={onToggle} aria-expanded={open}>
              {open ? 'Hide report' : 'Report'}
            </Button>
          ) : null}
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={4} className="bg-cream-50 px-4 py-3">
            <Report id={run.id} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function Report({ id }: { id: string }) {
  const run = useQuery({ queryKey: [...KEY, id], queryFn: () => api.get<ImportRun>(`/imports/${id}`) });
  if (run.isPending) return <Spinner label="Loading report" />;
  if (run.error) return <ErrorNotice error={run.error} />;
  const report = run.data.report ?? '';
  const download = (): void => {
    const url = URL.createObjectURL(new Blob([report], { type: 'text/markdown' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `drive-sync-${run.data.createdAt.slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div>
      <div className="mb-2 flex justify-end">
        <Button size="sm" variant="secondary" onClick={download}>
          Download report
        </Button>
      </div>
      <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs ring-1 ring-cream-200">{report}</pre>
    </div>
  );
}
