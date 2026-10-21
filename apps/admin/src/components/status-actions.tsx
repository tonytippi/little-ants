'use client';

import type { QueryKey } from '@tanstack/react-query';
import { Button } from '@little-ants/ui/button';
import { StatusBadge } from '@little-ants/ui/badge';
import { api } from '../lib/api';
import { useApiMutation, usePermissions } from '../lib/hooks';
import type { ContentStatus } from '../lib/types';
import { FormError } from './form-error';

interface Transition {
  to: ContentStatus;
  label: string;
  variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  reviewerOnly?: boolean;
  confirm?: string;
}

const TRANSITIONS: Record<ContentStatus, Transition[]> = {
  DRAFT: [
    { to: 'REVIEW', label: 'Send for review', variant: 'primary' },
    { to: 'ARCHIVED', label: 'Archive', variant: 'danger', confirm: 'Archive this item? It will be left out of releases.' },
  ],
  REVIEW: [
    { to: 'APPROVED', label: 'Approve', variant: 'primary', reviewerOnly: true },
    { to: 'DRAFT', label: 'Back to draft', variant: 'secondary' },
  ],
  APPROVED: [{ to: 'ARCHIVED', label: 'Archive', variant: 'danger', confirm: 'Archive this approved item? It will be left out of the next release.' }],
  ARCHIVED: [{ to: 'DRAFT', label: 'Restore as draft', variant: 'secondary' }],
};

interface StatusActionsProps {
  status: ContentStatus;
  version: number;
  /** API path that accepts POST { status }, e.g. /content/materials/:id/status */
  statusPath: string;
  invalidate: QueryKey[];
}

/** Review workflow buttons for one content item. Editing an approved item creates a new draft version automatically. */
export function StatusActions({ status, version, statusPath, invalidate }: StatusActionsProps) {
  const { canEdit, canReview } = usePermissions();
  const mutation = useApiMutation((to: ContentStatus) => api.post(statusPath, { status: to }), invalidate);
  const transitions = TRANSITIONS[status].filter((transition) => !transition.reviewerOnly || canReview);

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <StatusBadge status={status} />
        <span className="text-xs text-bark-500">v{version}</span>
        {canEdit
          ? transitions.map((transition) => (
              <Button
                key={transition.to}
                size="sm"
                variant={transition.variant}
                busy={mutation.isPending && mutation.variables === transition.to}
                onClick={() => {
                  if (transition.confirm && !window.confirm(transition.confirm)) return;
                  mutation.mutate(transition.to);
                }}
              >
                {transition.label}
              </Button>
            ))
          : null}
      </div>
      {mutation.error ? <FormError error={mutation.error} /> : null}
    </div>
  );
}
