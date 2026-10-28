'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePermissions } from '../lib/hooks';
import { useCurrentSchool } from '../lib/school';
import { useMe, useSignOut } from '../lib/session';
import { NavIcon, type NavIconName } from './nav-icons';

type Access = 'hq' | 'hqAdmin' | 'school';

interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
  access: Access;
}

/** The menu in three groups: lesson content, schools with their classes and parents, and staff. */
const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: 'Lessons',
    items: [
      { href: '/', label: 'Units', icon: 'units', access: 'hq' },
      { href: '/assets', label: 'Assets', icon: 'assets', access: 'hq' },
      { href: '/imports', label: 'Drive sync', icon: 'sync', access: 'hqAdmin' },
    ],
  },
  {
    label: 'Schools',
    items: [
      { href: '/schools', label: 'Schools', icon: 'schools', access: 'hqAdmin' },
      { href: '/classes', label: 'Classes', icon: 'classes', access: 'school' },
      { href: '/parents', label: 'Parents', icon: 'parents', access: 'school' },
    ],
  },
  {
    label: 'Staff',
    items: [
      { href: '/school-staff', label: 'School staff', icon: 'schoolStaff', access: 'school' },
      { href: '/staff', label: 'HQ staff', icon: 'hqStaff', access: 'hqAdmin' },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href !== '/') return pathname === href || pathname.startsWith(`${href}/`);
  // Units also own the unit, material and lesson pages under them.
  return (
    ['/units', '/materials', '/lessons'].some((prefix) => pathname.startsWith(prefix)) || pathname === '/'
  );
}

/** The menu groups and items this person may open. */
function useNavGroups() {
  const permissions = usePermissions();
  const allowed: Record<Access, boolean> = {
    hq: permissions.hasHqRole,
    hqAdmin: permissions.isAdmin,
    school: permissions.runsSchools,
  };
  return NAV.map((group) => ({ ...group, items: group.items.filter((item) => allowed[item.access]) })).filter(
    (group) => group.items.length > 0,
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg">
      {/* Static brand mark from /public; the image optimizer adds nothing for an SVG. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon.svg" alt="" className="size-9 rounded-xl" />
      <span className="leading-tight">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-ant-600">Little Ants</span>
        <span className="block text-lg font-extrabold text-leaf-700">Admin</span>
      </span>
    </Link>
  );
}

/** The school the school pages (classes, parents, school staff) work on. */
function SchoolSwitcher() {
  const { schools, school, setSchoolId } = useCurrentSchool();
  if (!school) return null;
  return (
    <div className="mx-3 rounded-xl border border-cream-200 bg-cream-50 px-3 py-2">
      <label
        htmlFor="current-school"
        className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-bark-500"
      >
        <NavIcon name="schools" className="size-3.5" />
        Current school
      </label>
      {schools.length > 1 ? (
        <select
          id="current-school"
          value={school.id}
          onChange={(event) => setSchoolId(event.target.value)}
          className="mt-1 w-full cursor-pointer rounded-md bg-transparent py-0.5 text-sm font-bold text-bark-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf-100"
        >
          {schools.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
              {item.active ? '' : ' (inactive)'}
            </option>
          ))}
        </select>
      ) : (
        <p id="current-school" className="mt-1 truncate text-sm font-bold text-bark-900">
          {school.name}
        </p>
      )}
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = useNavGroups();
  return (
    <nav aria-label="Main" className="flex flex-col gap-5 px-3">
      {groups.map((group) => (
        <div key={group.label} role="group" aria-labelledby={`nav-${group.label}`}>
          <p
            id={`nav-${group.label}`}
            className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-bark-500/80"
          >
            {group.label}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? 'bg-leaf-50 text-leaf-700'
                        : 'text-bark-700 hover:bg-cream-100 hover:text-bark-900'
                    }`}
                  >
                    {active ? (
                      <span
                        aria-hidden
                        className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-leaf-600"
                      />
                    ) : null}
                    <NavIcon
                      name={item.icon}
                      className={`size-[18px] ${active ? 'text-leaf-600' : 'text-bark-500 group-hover:text-bark-700'}`}
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    parts.length > 1 ? `${parts[0]![0]}${parts.at(-1)![0]}` : (parts[0]?.slice(0, 2) ?? '?')
  ).toUpperCase();
}

function UserCard() {
  const { user, schools } = useMe();
  const signOut = useSignOut();
  const roleText = [
    ...user.roles.map((role) => role.toLowerCase()),
    ...schools.map(
      (school) => `${school.role === 'SCHOOL_ADMIN' ? 'school admin' : 'teacher'} at ${school.name}`,
    ),
  ];
  return (
    <div className="flex items-center gap-3 border-t border-cream-200 px-4 py-3">
      {user.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- Google profile picture, not a local asset
        <img src={user.image} alt="" referrerPolicy="no-referrer" className="size-9 shrink-0 rounded-full" />
      ) : (
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sun-100 text-xs font-extrabold text-bark-700"
        >
          {initials(user.name || user.email)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{user.name}</p>
        <p className="truncate text-xs text-bark-500" title={roleText.join(', ')}>
          {roleText.join(', ') || 'no role'}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void signOut()}
        title="Sign out"
        aria-label="Sign out"
        className="shrink-0 rounded-lg p-2 text-bark-500 transition-colors hover:bg-ant-50 hover:text-ant-600"
      >
        <NavIcon name="signOut" />
      </button>
    </div>
  );
}

/** Brand, school, menu and the signed-in person: the desktop sidebar and the mobile drawer. */
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { runsSchools } = usePermissions();
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-5 pb-4">
        <Brand />
      </div>
      {runsSchools ? <SchoolSwitcher /> : null}
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pb-4">
        <NavLinks onNavigate={onNavigate} />
      </div>
      <UserCard />
    </div>
  );
}

/** Below the md breakpoint: a slim top bar whose menu button opens the sidebar as a drawer. */
function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const current = NAV.flatMap((group) => group.items).find((item) => isActive(pathname, item.href));

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const menuButton = menuRef.current;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      menuButton?.focus();
    };
  }, [open]);

  return (
    <div className="no-print md:hidden">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-cream-200 bg-white/95 px-3 py-2 backdrop-blur">
        <button
          ref={menuRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="rounded-lg p-2 text-bark-700 hover:bg-cream-100"
        >
          <NavIcon name="menu" className="size-5" />
        </button>
        <Brand />
        {current ? (
          <span className="ml-auto truncate rounded-full bg-leaf-50 px-3 py-1 text-xs font-bold text-leaf-700">
            {current.label}
          </span>
        ) : null}
      </header>
      {open ? (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-bark-900/40"
          />
          <div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-xl"
          >
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute top-5 right-3 z-10 rounded-lg p-2 text-bark-500 hover:bg-cream-100"
            >
              <NavIcon name="close" className="size-5" />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen md:flex">
      <MobileNav />
      <aside className="no-print hidden shrink-0 border-r border-cream-200 bg-white md:sticky md:top-0 md:block md:h-screen md:w-60">
        <SidebarContent />
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
