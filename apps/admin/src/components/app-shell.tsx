'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { usePermissions } from '../lib/hooks';
import { useMe, useSignOut } from '../lib/session';

const NAV = [
  { href: '/', label: 'Units', adminOnly: false },
  { href: '/assets', label: 'Assets', adminOnly: false },
  { href: '/classes', label: 'Classes', adminOnly: true },
  { href: '/staff', label: 'Staff', adminOnly: true },
  { href: '/imports', label: 'Drive sync', adminOnly: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useMe();
  const { isAdmin } = usePermissions();
  const signOut = useSignOut();

  const isActive = (href: string): boolean =>
    href === '/'
      ? pathname === '/' ||
        pathname.startsWith('/units') ||
        pathname.startsWith('/materials') ||
        pathname.startsWith('/lessons')
      : pathname.startsWith(href);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="no-print flex shrink-0 flex-col border-b border-cream-200 bg-white md:sticky md:top-0 md:h-screen md:w-56 md:border-r md:border-b-0">
        <div className="px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-wider text-ant-500">Little Ants</p>
          <p className="text-lg font-extrabold text-leaf-700">Admin</p>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {NAV.filter((item) => !item.adminOnly || isAdmin).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                isActive(item.href) ? 'bg-leaf-50 text-leaf-700' : 'text-bark-700 hover:bg-cream-100'
              }`}
            >
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap text-ant-600 hover:bg-cream-100 md:hidden"
          >
            Sign out
          </button>
        </nav>
        <div className="mt-auto hidden border-t border-cream-200 px-5 py-4 md:block">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-bark-500">{user.email}</p>
          <p className="mt-1 text-xs text-bark-500">
            {user.roles.map((role) => role.toLowerCase()).join(', ') || 'no role'}
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-3 text-sm font-semibold text-ant-600 hover:underline"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
