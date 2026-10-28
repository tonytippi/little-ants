'use client';

import { useState, type FormEvent } from 'react';
import { schoolYearOf } from '@little-ants/shared';
import { Button } from '@little-ants/ui/button';
import { Field, Select, TextInput } from '@little-ants/ui/field';
import { fieldErrors } from '../../lib/hooks';
import type { Campus, ClassDetail, LevelOption } from '../../lib/types';
import { FormError } from '../form-error';

/** Fields a class keeps changing: unit changes, merges and stops have their own actions. */
export interface ClassEditValues {
  name: string;
  schoolYear: string;
  nextLesson: number;
  lessonDays: number[];
}

export interface ClassCreateValues extends ClassEditValues {
  campusId: string;
  levelId: string;
  /** The unit the class starts with, or null to start later. */
  unitId: string | null;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface CommonProps {
  submitLabel: string;
  busy: boolean;
  error: unknown;
}

type ClassFormProps = CommonProps &
  (
    | {
        mode: 'create';
        campuses: Campus[];
        levels: LevelOption[];
        onSubmit: (values: ClassCreateValues) => void;
      }
    | { mode: 'edit'; initial: ClassDetail; onSubmit: (values: ClassEditValues) => void }
  );

export function ClassForm(props: ClassFormProps) {
  const { submitLabel, busy, error } = props;
  const initial = props.mode === 'edit' ? props.initial : null;
  const campuses = props.mode === 'create' ? props.campuses : [];
  const levels = props.mode === 'create' ? props.levels : [];

  const [values, setValues] = useState<ClassCreateValues>(() => ({
    campusId: campuses.find((campus) => campus.active)?.id ?? campuses[0]?.id ?? '',
    levelId: levels[0]?.id ?? '',
    unitId: null,
    name: initial?.name ?? '',
    schoolYear: initial?.schoolYear ?? schoolYearOf(),
    nextLesson: initial?.nextLesson ?? 1,
    lessonDays: initial?.lessonDays ?? [1, 2, 3, 4],
  }));
  const errors = fieldErrors(error);
  const level = levels.find((item) => item.id === values.levelId);
  const set = <K extends keyof ClassCreateValues>(key: K, value: ClassCreateValues[K]): void =>
    setValues((current) => ({ ...current, [key]: value }));

  function submit(event: FormEvent): void {
    event.preventDefault();
    const edited: ClassEditValues = {
      name: values.name,
      schoolYear: values.schoolYear,
      nextLesson: values.nextLesson,
      lessonDays: values.lessonDays,
    };
    if (props.mode === 'edit') props.onSubmit(edited);
    else
      props.onSubmit({
        ...edited,
        campusId: values.campusId,
        levelId: values.levelId,
        unitId: values.unitId,
      });
  }

  return (
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
      {props.mode === 'create' ? (
        <Field label="Campus" error={errors.campusId}>
          {(id) => (
            <Select
              id={id}
              required
              value={values.campusId}
              onChange={(event) => set('campusId', event.target.value)}
            >
              {campuses.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                  {campus.active ? '' : ' (inactive)'}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
      <Field label="Class name" error={errors.name}>
        {(id) => (
          <TextInput
            id={id}
            required
            value={values.name}
            onChange={(event) => set('name', event.target.value)}
            placeholder="e.g. Ladybugs"
          />
        )}
      </Field>
      <Field label="School year" hint="For example 2026-2027" error={errors.schoolYear}>
        {(id, describedBy) => (
          <TextInput
            id={id}
            aria-describedby={describedBy}
            required
            value={values.schoolYear}
            onChange={(event) => set('schoolYear', event.target.value)}
          />
        )}
      </Field>
      {props.mode === 'create' ? (
        <>
          <Field label="Level" error={errors.levelId}>
            {(id) => (
              <Select
                id={id}
                required
                value={values.levelId}
                onChange={(event) =>
                  setValues((current) => ({ ...current, levelId: event.target.value, unitId: null }))
                }
              >
                {levels.map((item) => (
                  <option key={item.id} value={item.id}>
                    Level {item.number} · {item.name} ({item.ageBand})
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            label="First unit"
            hint="Leave empty to start a unit later from the class page."
            error={errors.unitId}
          >
            {(id, describedBy) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={values.unitId ?? ''}
                onChange={(event) => set('unitId', event.target.value || null)}
              >
                <option value="">Not started</option>
                {level?.units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code} {unit.title}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </>
      ) : null}
      <Field
        label="Next lesson"
        hint="Moves on by itself when teachers mark lessons as taught."
        error={errors.nextLesson}
      >
        {(id, describedBy) => (
          <TextInput
            id={id}
            aria-describedby={describedBy}
            type="number"
            required
            min={1}
            max={40}
            value={values.nextLesson}
            onChange={(event) => set('nextLesson', Number(event.target.value))}
          />
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
                    set(
                      'lessonDays',
                      event.target.checked
                        ? [...values.lessonDays, value].sort((a, b) => a - b)
                        : values.lessonDays.filter((item) => item !== value),
                    )
                  }
                />
                {day}
              </label>
            );
          })}
        </div>
      </fieldset>
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
