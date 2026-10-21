'use client';

import type { KeyboardEvent } from 'react';

interface TabsProps<T extends string> {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  label: string;
}

/** Accessible tab list (arrow keys move between tabs). Panels use id `panel-{tab}`. */
export function Tabs<T extends string>({ tabs, active, onChange, label }: TabsProps<T>) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const index = tabs.findIndex((tab) => tab.id === active);
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    const next = (index + step + tabs.length) % tabs.length;
    event.preventDefault();
    const tab = tabs[next]!;
    onChange(tab.id);
    document.getElementById(`tab-${tab.id}`)?.focus();
  }

  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex gap-1 overflow-x-auto border-b border-cream-200">
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${
              selected ? 'border-leaf-600 text-leaf-700' : 'border-transparent text-bark-500 hover:text-bark-900'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
