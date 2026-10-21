import type { ReactNode } from 'react';

type Tone = 'neutral' | 'leaf' | 'ant' | 'sun' | 'bark';

const TONES: Record<Tone, string> = {
  neutral: 'bg-cream-100 text-bark-700 ring-cream-200',
  leaf: 'bg-leaf-50 text-leaf-700 ring-leaf-100',
  ant: 'bg-ant-50 text-ant-700 ring-ant-100',
  sun: 'bg-sun-100 text-bark-900 ring-sun-400/40',
  bark: 'bg-bark-700 text-white ring-bark-700',
};

export function Badge({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

const STATUS: Record<string, { tone: Tone; label: string }> = {
  DRAFT: { tone: 'neutral', label: 'Draft' },
  REVIEW: { tone: 'sun', label: 'In review' },
  APPROVED: { tone: 'leaf', label: 'Approved' },
  ARCHIVED: { tone: 'bark', label: 'Archived' },
};

/** Content review status (Draft / In review / Approved / Archived). */
export function StatusBadge({ status }: { status: string }) {
  const entry = STATUS[status] ?? { tone: 'neutral' as Tone, label: status };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}
