'use client';

import { useId, type FormEvent, type ReactNode } from 'react';
import { Button } from '@little-ants/ui/button';
import { Dialog } from './dialog';
import { FormError } from './form-error';

interface FormDialogProps {
  open: boolean;
  title: string;
  submitLabel: string;
  busy: boolean;
  error: unknown;
  /** Keeps the submit button off until the form is complete. */
  disabled?: boolean;
  wide?: boolean;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
}

/** Add or edit something in a modal: the fields, the save error, and Cancel / submit in the footer. */
export function FormDialog({
  open,
  title,
  submitLabel,
  busy,
  error,
  disabled = false,
  wide = false,
  onSubmit,
  onClose,
  children,
}: FormDialogProps) {
  const formId = useId();

  function submit(event: FormEvent): void {
    event.preventDefault();
    onSubmit();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      wide={wide}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {/* Outside the form element, so tied to it by id; Enter in a field submits too. */}
          <Button type="submit" form={formId} busy={busy} disabled={disabled}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-4">
        {children}
        <FormError error={error} />
      </form>
    </Dialog>
  );
}
