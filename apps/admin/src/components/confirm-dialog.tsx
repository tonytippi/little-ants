'use client';

import type { ReactNode } from 'react';
import { Button } from '@little-ants/ui/button';
import { Dialog } from './dialog';
import { FormError } from './form-error';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  confirmLabel: string;
  busy: boolean;
  error: unknown;
  danger?: boolean;
  /** Keeps the confirm button off until the dialog's choices are complete. */
  disabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children: ReactNode;
}

/** Asks before a change that cannot be undone from Admin, and shows the save error in place. */
export function ConfirmDialog({
  open,
  title,
  confirmLabel,
  busy,
  error,
  danger = false,
  disabled = false,
  onConfirm,
  onClose,
  children,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} busy={busy} disabled={disabled} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        {children}
        <FormError error={error} />
      </div>
    </Dialog>
  );
}
