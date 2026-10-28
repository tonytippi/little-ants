import { Badge } from '@little-ants/ui/badge';
import type { ClassStatus } from '../../lib/types';

const STATUS: Record<ClassStatus, { tone: 'leaf' | 'sun' | 'bark'; label: string }> = {
  ACTIVE: { tone: 'leaf', label: 'Active' },
  MERGED: { tone: 'sun', label: 'Merged' },
  STOPPED: { tone: 'bark', label: 'Stopped' },
};

export function ClassStatusBadge({ status }: { status: ClassStatus }) {
  const entry = STATUS[status];
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}
