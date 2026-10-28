import type { ReactNode } from 'react';
import { Card, EmptyState } from '@little-ants/ui/feedback';

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  /** Names the table for screen readers, e.g. "Schools". */
  label: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** The ⋯ menu (or other actions) at the end of each row. */
  actions?: (row: T) => ReactNode;
  /** Shown instead of the table when there are no rows. */
  empty: ReactNode;
  /** Narrowest width before the card scrolls sideways. */
  minWidth?: string;
  /** Faded rows, e.g. inactive or ended ones. */
  muted?: (row: T) => boolean;
}

/** The list of a management page: one row per item, actions on the right, scrolling inside its card on phones. */
export function DataTable<T>({
  label,
  columns,
  rows,
  rowKey,
  actions,
  empty,
  minWidth = '40rem',
  muted,
}: DataTableProps<T>) {
  if (rows.length === 0) return typeof empty === 'string' ? <EmptyState title={empty} /> : <>{empty}</>;
  return (
    <Card className="overflow-x-auto p-0">
      <table aria-label={label} className="w-full text-sm" style={{ minWidth }}>
        <thead className="bg-cream-100 text-left text-xs uppercase tracking-wide text-bark-500">
          <tr>
            {columns.map((column) => (
              <th
                key={column.header}
                scope="col"
                className={`px-4 py-2.5 font-bold ${column.className ?? ''}`}
              >
                {column.header}
              </th>
            ))}
            {actions ? (
              <th scope="col" className="w-12 px-2 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-cream-200">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={`align-middle transition-colors hover:bg-cream-50 ${muted?.(row) ? 'text-bark-500' : ''}`}
            >
              {columns.map((column) => (
                <td key={column.header} className={`px-4 py-3 ${column.className ?? ''}`}>
                  {column.cell(row)}
                </td>
              ))}
              {actions ? <td className="px-2 py-3 text-right">{actions(row)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/** Search and filters above a list: stacked on phones, one row on wide screens. */
export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:[&>*]:w-44 lg:[&>[type=search]]:w-72">
      {children}
    </div>
  );
}

/** "3 of 8 children" under the toolbar. */
export function ListCount({ shown, total, noun }: { shown: number; total: number; noun: string }) {
  return (
    <p className="mb-2 text-xs text-bark-500">
      {shown === total ? `${total} ${noun}` : `${shown} of ${total} ${noun}`}
    </p>
  );
}
