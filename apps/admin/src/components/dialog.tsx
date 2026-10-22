'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

/** Modal built on the native <dialog> element (focus trap and Escape handled by the browser). */
export function Dialog({ open, onClose, title, children, footer, wide = false }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="dialog-title"
      className={`m-auto max-h-[90vh] w-[calc(100%-2rem)] rounded-2xl bg-white p-0 text-bark-900 shadow-xl backdrop:bg-bark-900/40 ${wide ? 'max-w-5xl' : 'max-w-lg'}`}
    >
      {open ? (
        <div className="flex max-h-[90vh] flex-col">
          <header className="flex items-center justify-between border-b border-cream-200 px-5 py-3">
            <h2 id="dialog-title" className="text-lg font-bold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-bark-500 hover:bg-cream-100"
              aria-label="Close"
            >
              ✕
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer ? (
            <footer className="flex justify-end gap-2 border-t border-cream-200 px-5 py-3">{footer}</footer>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
