'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@little-ants/ui/button';
import { Field, Select, TextArea } from '@little-ants/ui/field';
import { queueLessonRun } from '../../lib/outbox';
import { useTeachClasses } from '../../lib/queries';

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  unitCode: string;
  lessonNumber: number;
  releaseVersion: number;
  classId: string | null;
}

/** "Finish lesson": records that the lesson was taught, with optional notes. Works offline. */
export function FinishDialog({
  open,
  onClose,
  onDone,
  unitCode,
  lessonNumber,
  releaseVersion,
  classId,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const classes = useTeachClasses();
  const [chosenClass, setChosenClass] = useState(classId ?? '');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  const options = classes.data?.data ?? [];

  async function save(): Promise<void> {
    if (!chosenClass) return;
    setSaving(true);
    await queueLessonRun({
      classId: chosenClass,
      unitCode,
      lessonNumber,
      releaseVersion,
      taughtAt: new Date().toISOString(),
      notes: notes.trim(),
    });
    setSaving(false);
    onDone();
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-3xl bg-white p-0 text-bark-900 shadow-xl backdrop:bg-bark-900/40"
    >
      <form
        method="dialog"
        className="flex flex-col gap-4 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <h2 className="text-xl font-extrabold">Finish lesson {lessonNumber}</h2>
        <p className="text-sm text-bark-500">
          This saves the lesson as taught. It is kept on this device and sent to the school when there is
          internet.
        </p>
        {classId ? null : (
          <Field label="Class">
            {(id) => (
              <Select
                id={id}
                required
                value={chosenClass}
                onChange={(event) => setChosenClass(event.target.value)}
              >
                <option value="">Choose a class</option>
                {options.map((klass) => (
                  <option key={klass.id} value={klass.id}>
                    {klass.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field
          label="Notes after the lesson (optional)"
          hint="What worked, what was hard, timing. The program team reads these."
        >
          {(id, describedBy) => (
            <TextArea
              id={id}
              aria-describedby={describedBy}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
            />
          )}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Keep teaching
          </Button>
          <Button type="submit" busy={saving} disabled={!chosenClass}>
            Save and finish
          </Button>
        </div>
      </form>
    </dialog>
  );
}
