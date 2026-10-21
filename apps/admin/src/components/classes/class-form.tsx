'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@little-ants/ui/button';
import { Field, Select, TextInput } from '@little-ants/ui/field';
import { fieldErrors } from '../../lib/hooks';
import type { Campus, ClassSummary, LevelOption } from '../../lib/types';
import { FormError } from '../form-error';

export interface ClassFormValues {
  campusId: string;
  name: string;
  levelId: string;
  currentUnitId: string | null;
  nextLesson: number;
  schoolYear: string;
  lessonDays: number[];
  active: boolean;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function defaultSchoolYear(): string {
  const now = new Date();
  // The school year starts in August.
  const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

interface ClassFormProps {
  campuses: Campus[];
  levels: LevelOption[];
  initial?: ClassSummary;
  submitLabel: string;
  busy: boolean;
  error: unknown;
  onSubmit: (values: ClassFormValues) => void;
}

export function ClassForm({ campuses, levels, initial, submitLabel, busy, error, onSubmit }: ClassFormProps) {
  const [values, setValues] = useState<ClassFormValues>(() => ({
    campusId: initial?.campusId ?? campuses[0]?.id ?? '',
    name: initial?.name ?? '',
    levelId: initial?.levelId ?? levels[0]?.id ?? '',
    currentUnitId: initial?.currentUnitId ?? null,
    nextLesson: initial?.nextLesson ?? 1,
    schoolYear: initial?.schoolYear ?? defaultSchoolYear(),
    lessonDays: initial?.lessonDays ?? [1, 2, 3, 4],
    active: initial?.active ?? true,
  }));
  const errors = fieldErrors(error);
  const level = levels.find((item) => item.id === values.levelId);
  const set = <K extends keyof ClassFormValues>(key: K, value: ClassFormValues[K]): void => setValues((current) => ({ ...current, [key]: value }));

  function submit(event: FormEvent): void {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
      {campuses.length > 1 ? (
        <Field label="Campus" error={errors.campusId}>
          {(id) => (
            <Select id={id} value={values.campusId} onChange={(event) => set('campusId', event.target.value)}>
              {campuses.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
      <Field label="Class name" error={errors.name}>
        {(id) => <TextInput id={id} required value={values.name} onChange={(event) => set('name', event.target.value)} placeholder="e.g. Ladybugs" />}
      </Field>
      <Field label="School year" hint="For example 2026-2027" error={errors.schoolYear}>
        {(id, describedBy) => <TextInput id={id} aria-describedby={describedBy} required value={values.schoolYear} onChange={(event) => set('schoolYear', event.target.value)} />}
      </Field>
      <Field label="Level" error={errors.levelId}>
        {(id) => (
          <Select
            id={id}
            value={values.levelId}
            onChange={(event) => setValues((current) => ({ ...current, levelId: event.target.value, currentUnitId: null }))}
          >
            {levels.map((item) => (
              <option key={item.id} value={item.id}>
                Level {item.number} · {item.name} ({item.ageBand})
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Current unit" error={errors.currentUnitId}>
        {(id) => (
          <Select id={id} value={values.currentUnitId ?? ''} onChange={(event) => set('currentUnitId', event.target.value || null)}>
            <option value="">Not started</option>
            {level?.units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.code} {unit.title}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Next lesson" hint="Moves on by itself when teachers mark lessons as taught." error={errors.nextLesson}>
        {(id, describedBy) => (
          <TextInput id={id} aria-describedby={describedBy} type="number" min={1} max={40} value={values.nextLesson} onChange={(event) => set('nextLesson', Number(event.target.value))} />
        )}
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-bark-700">English lesson days</legend>
        <div className="flex flex-wrap gap-3">
          {DAYS.map((day, index) => {
            const value = index + 1;
            return (
              <label key={day} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={values.lessonDays.includes(value)}
                  onChange={(event) =>
                    set('lessonDays', event.target.checked ? [...values.lessonDays, value].sort() : values.lessonDays.filter((item) => item !== value))
                  }
                />
                {day}
              </label>
            );
          })}
        </div>
      </fieldset>
      {initial ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={values.active} onChange={(event) => set('active', event.target.checked)} />
          Class is active
        </label>
      ) : null}
      <div className="flex items-center gap-3 md:col-span-2">
        <Button type="submit" busy={busy}>
          {submitLabel}
        </Button>
      </div>
      <div className="md:col-span-2">
        <FormError error={error} />
      </div>
    </form>
  );
}
