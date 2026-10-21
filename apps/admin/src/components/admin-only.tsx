'use client';

import type { ReactNode } from 'react';
import { EmptyState } from '@little-ants/ui/feedback';
import { usePermissions } from '../lib/hooks';

export function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin } = usePermissions();
  if (!isAdmin) return <EmptyState title="Admins only">Ask an admin if you need access to this page.</EmptyState>;
  return <>{children}</>;
}
