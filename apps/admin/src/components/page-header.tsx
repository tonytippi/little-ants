import Link from 'next/link';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({ title, eyebrow, back, actions, children }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4 sm:flex-nowrap">
      <div className="min-w-0 flex-1">
        {back ? (
          <Link href={back.href} className="text-sm font-semibold text-leaf-700 hover:underline">
            ← {back.label}
          </Link>
        ) : null}
        {eyebrow ? (
          <p className="mt-1 text-xs font-bold uppercase tracking-wider text-ant-600">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 text-2xl font-extrabold text-bark-900">{title}</h1>
        {children ? <div className="mt-2 text-sm text-bark-500">{children}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
