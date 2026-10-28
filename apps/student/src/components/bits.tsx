import type { ReactNode } from 'react';
import { DAYS_PER_WEEK_GOAL } from '@little-ants/shared';

/** The Vietnamese line under an English one (parent-facing text is bilingual). */
export function Vi({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span lang="vi" className={`block font-child text-[0.92em] text-bark-500 italic ${className}`}>
      {children}
    </span>
  );
}

/** The four little leaves of the weekly goal, green for each day with listening. */
export function GoalLeaves({ days, size = 'md' }: { days: number; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'size-3.5' : 'size-5';
  return (
    <span className="flex gap-1" aria-hidden>
      {Array.from({ length: DAYS_PER_WEEK_GOAL }, (_, index) => (
        <i key={index} className={`leaf-dot block ${box} ${index < days ? 'bg-leaf-600' : 'bg-cream-200'}`} />
      ))}
    </span>
  );
}

/** A friendly notice (daily limit, offline, sign-in problems). */
export function Notice({
  children,
  tone = 'info',
  className = '',
}: {
  children: ReactNode;
  tone?: 'info' | 'warn';
  className?: string;
}) {
  return (
    <div
      role={tone === 'warn' ? 'alert' : 'status'}
      className={`rounded-2xl px-4 py-3 text-sm font-medium ${tone === 'warn' ? 'bg-ant-50 text-ant-700' : 'bg-cream-100 text-bark-900'} ${className}`}
    >
      {children}
    </div>
  );
}

/** "3 Nov" style date for lists (the device's locale and time zone). */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** "today 14:05", "yesterday", "3 Nov" for last-used times. */
export function lastUsed(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const days = Math.round(
    (new Date(now).setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86_400_000,
  );
  if (days <= 0) return `today ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  if (days === 1) return 'yesterday';
  return shortDate(iso);
}
