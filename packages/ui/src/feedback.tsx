import type { ReactNode } from 'react';

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 p-6 text-bark-500">
      <span
        className="size-5 animate-spin rounded-full border-2 border-leaf-600 border-t-transparent"
        aria-hidden
      />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-cream-200 bg-white/60 p-10 text-center">
      <p className="font-semibold text-bark-700">{title}</p>
      {children ? <div className="mt-2 text-sm text-bark-500">{children}</div> : null}
    </div>
  );
}

export function ErrorNotice({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'Something went wrong';
  return (
    <div role="alert" className="rounded-xl border border-ant-100 bg-ant-50 px-4 py-3 text-sm text-ant-700">
      {message}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-[var(--radius-card)] border border-cream-200 bg-white p-5 shadow-xs ${className}`}
    >
      {children}
    </section>
  );
}
