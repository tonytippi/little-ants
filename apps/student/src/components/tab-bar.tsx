'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { ComponentType, SVGProps } from 'react';
import type { Mode } from '../lib/types';
import { LibraryIcon, PathIcon, SproutIcon, TeacherIcon } from './icons';

export type Tab = 'path' | 'library' | 'me' | 'teacher';

const TABS: Record<Tab, { label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }> = {
  path: { label: 'Path', Icon: PathIcon },
  library: { label: 'Library', Icon: LibraryIcon },
  me: { label: 'My listening', Icon: SproutIcon },
  teacher: { label: 'Teacher', Icon: TeacherIcon },
};

/** At home: Path, Library, My listening. At school (staff): Path, Library, Teacher. */
export function tabsFor(mode: Mode): Tab[] {
  return mode === 'school' ? ['path', 'library', 'teacher'] : ['path', 'library', 'me'];
}

/** The open tab, kept in the query string (?tab=library) so a reload or the back button keeps it. */
export function useTab(mode: Mode): [Tab, (tab: Tab) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const allowed = tabsFor(mode);
  const raw = params.get('tab') as Tab | null;
  const tab = raw && allowed.includes(raw) ? raw : 'path';
  const select = (next: Tab): void => {
    const query = new URLSearchParams(params.toString());
    if (next === 'path') query.delete('tab');
    else query.set('tab', next);
    const search = query.toString();
    router.replace(search ? `/?${search}` : '/', { scroll: false });
    window.scrollTo({ top: 0 });
  };
  return [tab, select];
}

export function TabBar({ mode, tab, onSelect }: { mode: Mode; tab: Tab; onSelect: (tab: Tab) => void }) {
  return (
    <nav
      aria-label="Sections"
      className="no-print fixed inset-x-0 bottom-0 z-20 flex justify-center gap-1 bg-cream-50 px-4 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] shadow-[0_-6px_18px_rgba(74,46,32,0.08)]"
    >
      {tabsFor(mode).map((name) => {
        const { label, Icon } = TABS[name];
        const current = name === tab;
        return (
          <button
            key={name}
            type="button"
            onClick={() => onSelect(name)}
            aria-current={current ? 'page' : undefined}
            className={`flex min-h-14 flex-[0_1_130px] flex-col items-center gap-0.5 rounded-[14px] px-1 py-1.5 text-xs leading-tight font-semibold ${current ? 'bg-cream-100 text-leaf-700' : 'text-bark-500'}`}
          >
            <Icon className="size-[26px]" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
