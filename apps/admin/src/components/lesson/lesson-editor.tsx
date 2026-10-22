'use client';

import { useState, type FormEvent } from 'react';
import { LESSON_STAGES, STEP_KINDS } from '@little-ants/shared';
import { Badge } from '@little-ants/ui/badge';
import { Button } from '@little-ants/ui/button';
import { Card } from '@little-ants/ui/feedback';
import { Field, Select, TextArea, TextInput } from '@little-ants/ui/field';
import { api } from '../../lib/api';
import { humanize, useApiMutation, usePermissions } from '../../lib/hooks';
import type { LessonDetail, MaterialSummary } from '../../lib/types';
import { FormError } from '../form-error';
import { ListEditor } from '../list-editor';

interface StepDraft {
  key: string;
  minutes: number;
  kind: string;
  title: string;
  materialId: string | null;
  teacherText: string;
  childrenText: string;
}

interface PrepDraft {
  key: string;
  text: string;
  materialId: string | null;
}

let counter = 0;
const newKey = (): string => `row-${(counter += 1)}`;

/** Whole-lesson editor: header, flow steps, prep list and notes. Saved as one revision. */
export function LessonEditor({ lesson, materials }: { lesson: LessonDetail; materials: MaterialSummary[] }) {
  const { canEdit } = usePermissions();
  const [header, setHeader] = useState({
    week: String(lesson.week),
    stage: lesson.stage,
    minutes: String(lesson.minutes),
    prepMinutes: lesson.prepMinutes === null ? '' : String(lesson.prepMinutes),
    newToday: lesson.newToday.join(', '),
    keyLanguage: lesson.keyLanguage,
    support: lesson.support,
    challenge: lesson.challenge,
    lookFor: lesson.lookFor,
    homeLink: lesson.homeLink,
    notes: lesson.notes,
  });
  const [goals, setGoals] = useState(lesson.goals);
  const [steps, setSteps] = useState<StepDraft[]>(() =>
    lesson.steps.map((step) => ({
      key: newKey(),
      minutes: step.minutes,
      kind: step.kind,
      title: step.title,
      materialId: step.materialId,
      teacherText: step.teacherText,
      childrenText: step.childrenText,
    })),
  );
  const [prep, setPrep] = useState<PrepDraft[]>(() =>
    lesson.prepItems.map((item) => ({ key: newKey(), text: item.text, materialId: item.materialId })),
  );
  const activeMaterials = materials.filter((material) => material.status !== 'ARCHIVED');

  const save = useApiMutation(
    () =>
      api.put(`/content/lessons/${lesson.id}`, {
        week: Number(header.week),
        stage: header.stage,
        minutes: Number(header.minutes),
        prepMinutes: header.prepMinutes === '' ? null : Number(header.prepMinutes),
        newToday: header.newToday
          .split(/[,\s]+/)
          .map((code) => code.trim().toUpperCase())
          .filter(Boolean),
        goals: goals.filter((goal) => goal.trim()),
        keyLanguage: header.keyLanguage,
        support: header.support,
        challenge: header.challenge,
        lookFor: header.lookFor,
        homeLink: header.homeLink,
        notes: header.notes,
        steps: steps.map(({ key: _key, ...step }) => step),
        prep: prep.filter((item) => item.text.trim()).map(({ key: _key, ...item }) => item),
      }),
    [
      ['lesson', lesson.id],
      ['unit', lesson.unit.code],
    ],
  );

  const total = steps.reduce((sum, step) => sum + (Number(step.minutes) || 0), 0);
  const lessonMinutes = Number(header.minutes) || 0;
  const timeTone = total > lessonMinutes + 2 ? 'ant' : total < lessonMinutes - 5 ? 'sun' : 'leaf';
  const setField = (name: keyof typeof header) => (event: { target: { value: string } }) =>
    setHeader((current) => ({ ...current, [name]: event.target.value }));

  const updateStep = (index: number, patch: Partial<StepDraft>): void =>
    setSteps((current) => current.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  const moveStep = (index: number, delta: number): void => {
    const target = index + delta;
    if (target < 0 || target >= steps.length) return;
    setSteps((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  };

  function submit(event: FormEvent): void {
    event.preventDefault();
    save.mutate(undefined);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <fieldset disabled={!canEdit} className="flex flex-col gap-6">
        <Card>
          <h2 className="mb-4 font-bold">Lesson</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Week">
              {(id) => (
                <TextInput
                  id={id}
                  type="number"
                  min={1}
                  max={12}
                  required
                  value={header.week}
                  onChange={setField('week')}
                />
              )}
            </Field>
            <Field label="Stage">
              {(id) => (
                <Select id={id} value={header.stage} onChange={setField('stage')}>
                  {LESSON_STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {humanize(stage)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Minutes">
              {(id) => (
                <TextInput
                  id={id}
                  type="number"
                  min={5}
                  max={90}
                  required
                  value={header.minutes}
                  onChange={setField('minutes')}
                />
              )}
            </Field>
            <Field label="Prep minutes">
              {(id) => (
                <TextInput
                  id={id}
                  type="number"
                  min={0}
                  max={240}
                  value={header.prepMinutes}
                  onChange={setField('prepMinutes')}
                />
              )}
            </Field>
            <Field label="NEW today" hint="Material codes, e.g. SG1, RH1">
              {(id, describedBy) => (
                <TextInput
                  id={id}
                  aria-describedby={describedBy}
                  value={header.newToday}
                  onChange={setField('newToday')}
                />
              )}
            </Field>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-semibold text-bark-700">
                By the end of the lesson, children can…
              </p>
              <ListEditor items={goals} onChange={setGoals} itemLabel="Goal" disabled={!canEdit} multiline />
            </div>
            <Field label="Key language">
              {(id) => (
                <TextArea id={id} rows={4} value={header.keyLanguage} onChange={setField('keyLanguage')} />
              )}
            </Field>
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">Lesson flow</h2>
            <Badge tone={timeTone}>
              Steps: {total} min of {lessonMinutes} min
            </Badge>
          </div>
          <ol className="flex flex-col gap-3">
            {steps.map((step, index) => (
              <li key={step.key} className="rounded-xl bg-cream-50 p-3 ring-1 ring-cream-200">
                <div className="grid gap-2 md:grid-cols-[2.5rem_5rem_10rem_1fr_12rem_auto]">
                  <span className="pt-2 text-lg font-extrabold text-bark-500">{index + 1}</span>
                  <TextInput
                    aria-label={`Step ${index + 1} minutes`}
                    type="number"
                    min={0}
                    max={60}
                    value={step.minutes}
                    onChange={(event) => updateStep(index, { minutes: Number(event.target.value) })}
                  />
                  <Select
                    aria-label={`Step ${index + 1} kind`}
                    value={step.kind}
                    onChange={(event) => updateStep(index, { kind: event.target.value })}
                  >
                    {STEP_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {humanize(kind)}
                      </option>
                    ))}
                  </Select>
                  <TextInput
                    aria-label={`Step ${index + 1} title`}
                    required
                    value={step.title}
                    onChange={(event) => updateStep(index, { title: event.target.value })}
                  />
                  <Select
                    aria-label={`Step ${index + 1} material`}
                    value={step.materialId ?? ''}
                    onChange={(event) => updateStep(index, { materialId: event.target.value || null })}
                  >
                    <option value="">No material</option>
                    {activeMaterials.map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.code} {material.title}
                      </option>
                    ))}
                  </Select>
                  {canEdit ? (
                    <div className="flex">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Move step ${index + 1} up`}
                        disabled={index === 0}
                        onClick={() => moveStep(index, -1)}
                      >
                        ↑
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Move step ${index + 1} down`}
                        disabled={index === steps.length - 1}
                        onClick={() => moveStep(index, 1)}
                      >
                        ↓
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Remove step ${index + 1}`}
                        onClick={() =>
                          window.confirm(`Remove step ${index + 1}?`) &&
                          setSteps((current) => current.filter((_, i) => i !== index))
                        }
                      >
                        ✕
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-[2fr_1fr] md:pl-12">
                  <TextArea
                    aria-label={`Step ${index + 1}: what the teacher does and says`}
                    placeholder="What the teacher does and says"
                    rows={3}
                    value={step.teacherText}
                    onChange={(event) => updateStep(index, { teacherText: event.target.value })}
                  />
                  <TextArea
                    aria-label={`Step ${index + 1}: children`}
                    placeholder="Children"
                    rows={3}
                    value={step.childrenText}
                    onChange={(event) => updateStep(index, { childrenText: event.target.value })}
                  />
                </div>
              </li>
            ))}
          </ol>
          {canEdit ? (
            <Button
              size="sm"
              variant="ghost"
              className="mt-3"
              onClick={() =>
                setSteps((current) => [
                  ...current,
                  {
                    key: newKey(),
                    minutes: 3,
                    kind: 'OTHER',
                    title: '',
                    materialId: null,
                    teacherText: '',
                    childrenText: '',
                  },
                ])
              }
            >
              + Add step
            </Button>
          ) : null}
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">Prepare</h2>
          <ol className="flex flex-col gap-2">
            {prep.map((item, index) => (
              <li key={item.key} className="grid gap-2 sm:grid-cols-[1fr_12rem_auto]">
                <TextInput
                  aria-label={`Prep item ${index + 1}`}
                  value={item.text}
                  onChange={(event) =>
                    setPrep((current) =>
                      current.map((row, i) => (i === index ? { ...row, text: event.target.value } : row)),
                    )
                  }
                />
                <Select
                  aria-label={`Prep item ${index + 1} material`}
                  value={item.materialId ?? ''}
                  onChange={(event) =>
                    setPrep((current) =>
                      current.map((row, i) =>
                        i === index ? { ...row, materialId: event.target.value || null } : row,
                      ),
                    )
                  }
                >
                  <option value="">No material</option>
                  {activeMaterials.map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.code}
                    </option>
                  ))}
                </Select>
                {canEdit ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove prep item ${index + 1}`}
                    onClick={() => setPrep((current) => current.filter((_, i) => i !== index))}
                  >
                    ✕
                  </Button>
                ) : null}
              </li>
            ))}
          </ol>
          {canEdit ? (
            <Button
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() =>
                setPrep((current) => [...current, { key: newKey(), text: '', materialId: null }])
              }
            >
              + Add prep item
            </Button>
          ) : null}
        </Card>

        <Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Support">
              {(id) => <TextArea id={id} rows={3} value={header.support} onChange={setField('support')} />}
            </Field>
            <Field label="Challenge">
              {(id) => (
                <TextArea id={id} rows={3} value={header.challenge} onChange={setField('challenge')} />
              )}
            </Field>
            <Field label="Look for (observe 5–6 children)">
              {(id) => <TextArea id={id} rows={3} value={header.lookFor} onChange={setField('lookFor')} />}
            </Field>
            <Field label="Home link">
              {(id) => <TextArea id={id} rows={3} value={header.homeLink} onChange={setField('homeLink')} />}
            </Field>
            <Field label="Notes for the team" className="md:col-span-2">
              {(id) => <TextArea id={id} rows={2} value={header.notes} onChange={setField('notes')} />}
            </Field>
          </div>
        </Card>
      </fieldset>

      {canEdit ? (
        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-cream-200 bg-cream-50/95 px-4 py-3 md:-mx-8 md:px-8">
          <Button type="submit" busy={save.isPending}>
            Save lesson
          </Button>
          {save.isSuccess ? (
            <span role="status" className="text-sm text-leaf-700">
              Saved.
            </span>
          ) : null}
          {lesson.status === 'APPROVED' ? (
            <span className="text-xs text-bark-500">
              Saving starts a new draft version; the approved one stays in history.
            </span>
          ) : null}
          <div className="w-full">
            <FormError error={save.error} />
          </div>
        </div>
      ) : null}
    </form>
  );
}
