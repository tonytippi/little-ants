'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { usePermissions } from '../lib/hooks';
import { useCurrentSchool } from '../lib/school';
import { useMe, useSignOut } from '../lib/session';

type Access = 'hq' | 'hqAdmin' | 'school';

interface NavItem {
  href: string;
  label: string;
  access: Access;
}

/** The menu in three groups: lesson content, schools with their classes and parents, and staff. */
const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: 'Lessons',
    items: [
      { href: '/', label: 'Units', access: 'hq' },
      { href: '/assets', label: 'Assets', access: 'hq' },
      { href: '/imports', label: 'Drive sync', access: 'hqAdmin' },
    ],
  },
  {
    label: 'Schools',
    items: [
      { href: '/schools', label: 'Schools', access: 'hqAdmin' },
      { href: '/classes', label: 'Classes', access: 'school' },
      { href: '/parents', label: 'Parents', access: 'school' },
    ],
  },
  {
    label: 'Staff',
    items: [
      { href: '/school-staff', label: 'School staff', access: 'school' },
      { href: '/staff', label: 'HQ staff', access: 'hqAdmin' },
    ],
  },
];

function SchoolSwitcher() {
  const { schools, school, setSchoolId } = useCurrentSchool();
  if (!school) return null;
  return (
    <div className="px-5 pb-3">
      <label htmlFor="current-school" className="text-xs font-bold uppercase tracking-wider text-bark-500">
        School
      </label>
      {schools.length > 1 ? (
        <select
          id="current-school"
          value={school.id}
          onChange={(event) => setSchoolId(event.target.value)}
          className="mt-1 w-full rounded-lg border border-cream-200 bg-white px-2 py-1.5 text-sm font-semibold text-bark-900 focus:border-leaf-500 focus:outline-none focus:ring-2 focus:ring-leaf-100"
        >
          {schools.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
              {item.active ? '' : ' (inactive)'}
            </option>
          ))}
        </select>
      ) : (
        <p id="current-school" className="mt-1 truncate text-sm font-semibold">
          {school.name}
        </p>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, schools } = useMe();
  const permissions = usePermissions();
  const signOut = useSignOut();

  const allowed: Record<Access, boolean> = {
    hq: permissions.hasHqRole,
    hqAdmin: permissions.isAdmin,
    school: permissions.runsSchools,
  };

  const groups = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => allowed[item.access]),
  })).filter((group) => group.items.length > 0);

  const isActive = (href: string): boolean =>
    href === '/'
      ? pathname === '/' ||
        pathname.startsWith('/units') ||
        pathname.startsWith('/materials') ||
        pathname.startsWith('/lessons')
      : pathname.startsWith(href);

  const roleText = [
    ...user.roles.map((role) => role.toLowerCase()),
    ...schools.map(
      (school) => `${school.role === 'SCHOOL_ADMIN' ? 'school admin' : 'teacher'} at ${school.name}`,
    ),
  ];

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="no-print flex shrink-0 flex-col border-b border-cream-200 bg-white md:sticky md:top-0 md:h-screen md:w-56 md:border-r md:border-b-0">
        <div className="px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-wider text-ant-600">Little Ants</p>
          <p className="text-lg font-extrabold text-leaf-700">Admin</p>
        </div>
        {permissions.runsSchools ? <SchoolSwitcher /> : null}
        <nav
          aria-label="Main"
          className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-y-auto md:pb-0"
        >
          {groups.map((group) => (
            <div key={group.label} className="flex gap-1 md:mb-3 md:flex-col">
              <p className="hidden px-3 pb-1 text-xs font-bold uppercase tracking-wider text-bark-500 md:block">
                {group.label}
              </p>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap ${
                    isActive(item.href) ? 'bg-leaf-50 text-leaf-700' : 'text-bark-700 hover:bg-cream-100'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
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
          <p className="mt-1 text-xs text-bark-500">{roleText.join(', ') || 'no role'}</p>
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
