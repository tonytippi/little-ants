'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@little-ants/ui/button';
import { Card } from '@little-ants/ui/feedback';
import { Field, TextArea, TextInput } from '@little-ants/ui/field';
import { api } from '../../lib/api';
import { fieldErrors, useApiMutation, usePermissions } from '../../lib/hooks';
import type { UnitDetail } from '../../lib/types';
import { FormError } from '../form-error';
import { ListEditor } from '../list-editor';
import { UnitPictures } from './unit-pictures';

type Link = UnitDetail['links'][number];

const TEXT_FIELDS = [
  { name: 'title', label: 'Theme (title)' },
  { name: 'leadCharacterNote', label: 'Lead character' },
  { name: 'circle', label: 'Circle' },
  { name: 'vnLink', label: 'Vietnamese kindergarten link' },
  { name: 'bigQuestion', label: 'Big Question' },
  { name: 'value', label: 'Value' },
  { name: 'sounds', label: 'Sounds' },
  { name: 'levelRulesNote', label: 'Level rules' },
] as const;

type TextFieldName = (typeof TEXT_FIELDS)[number]['name'];

export function OverviewTab({ unit }: { unit: UnitDetail }) {
  const { canEdit } = usePermissions();
  const invalidate = [['unit', unit.code], ['units']];
  const [fields, setFields] = useState<Record<TextFieldName, string>>(
    () =>
      Object.fromEntries(TEXT_FIELDS.map((field) => [field.name, unit[field.name]])) as Record<
        TextFieldName,
        string
      >,
  );
  const [party, setParty] = useState(unit.party);
  const [parentMessage, setParentMessage] = useState(unit.parentMessage);
  const [keyLanguage, setKeyLanguage] = useState(unit.keyLanguage);
  const [links, setLinks] = useState<Link[]>(unit.links);
  const [goals, setGoals] = useState(unit.canDoGoals.map((goal) => goal.text));

  const save = useApiMutation(
    () =>
      api.patch(`/content/units/${unit.code}`, {
        ...fields,
        party,
        parentMessage,
        keyLanguage: keyLanguage.filter(Boolean),
        links,
      }),
    invalidate,
  );
  const saveGoals = useApiMutation(
    () => api.put(`/content/units/${unit.code}/can-do-goals`, { goals: goals.filter((goal) => goal.trim()) }),
    invalidate,
  );
  const errors = fieldErrors(save.error);

  function submit(event: FormEvent): void {
    event.preventDefault();
    save.mutate(undefined);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
      <form onSubmit={submit} className="flex flex-col gap-6">
        <Card>
          <h2 className="mb-4 font-bold">Unit overview</h2>
          <fieldset disabled={!canEdit} className="grid gap-4 md:grid-cols-2">
            {TEXT_FIELDS.map((field) => (
              <Field key={field.name} label={field.label} error={errors[field.name]}>
                {(id, describedBy) => (
                  <TextInput
                    id={id}
                    aria-describedby={describedBy}
                    value={fields[field.name]}
                    onChange={(event) =>
                      setFields((current) => ({ ...current, [field.name]: event.target.value }))
                    }
                  />
                )}
              </Field>
            ))}
            <Field label="Ant Hill Party" className="md:col-span-2">
              {(id) => <TextArea id={id} value={party} onChange={(event) => setParty(event.target.value)} />}
            </Field>
            <Field
              label="Message to parents"
              hint="Sent at the start of the unit. Translate into Vietnamese before sending."
              className="md:col-span-2"
            >
              {(id, describedBy) => (
                <TextArea
                  id={id}
                  aria-describedby={describedBy}
                  rows={6}
                  value={parentMessage}
                  onChange={(event) => setParentMessage(event.target.value)}
                />
              )}
            </Field>
          </fieldset>
        </Card>

        <Card>
          <h2 className="mb-1 font-bold">Key language</h2>
          <p className="mb-3 text-sm text-bark-500">Sentence patterns for the unit, one per line.</p>
          <ListEditor items={keyLanguage} onChange={setKeyLanguage} disabled={!canEdit} itemLabel="Pattern" />
        </Card>

        <Card>
          <h2 className="mb-1 font-bold">Look back and links</h2>
          <p className="mb-3 text-sm text-bark-500">How this unit connects to earlier units.</p>
          <div className="flex flex-col gap-3">
            {links.map((link, index) => (
              <fieldset
                key={index}
                disabled={!canEdit}
                className="grid gap-2 rounded-xl bg-cream-50 p-3 md:grid-cols-[2fr_1fr_3fr_1fr_auto]"
              >
                <legend className="sr-only">Link {index + 1}</legend>
                {(['what', 'fromUnit', 'how', 'where'] as const).map((key) => (
                  <TextInput
                    key={key}
                    aria-label={`${key} for link ${index + 1}`}
                    placeholder={
                      {
                        what: 'What we bring back',
                        fromUnit: 'From unit',
                        how: 'How it is used',
                        where: 'Where',
                      }[key]
                    }
                    value={link[key]}
                    onChange={(event) =>
                      setLinks((rows) =>
                        rows.map((row, i) => (i === index ? { ...row, [key]: event.target.value } : row)),
                      )
                    }
                  />
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove link ${index + 1}`}
                  onClick={() => setLinks((rows) => rows.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              </fieldset>
            ))}
            {canEdit ? (
              <Button
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => setLinks((rows) => [...rows, { what: '', fromUnit: '', how: '', where: '' }])}
              >
                + Add link
              </Button>
            ) : null}
          </div>
        </Card>

        {canEdit ? (
          <div className="flex items-center gap-3">
            <Button type="submit" busy={save.isPending}>
              Save overview
            </Button>
            {save.isSuccess ? (
              <span role="status" className="text-sm text-leaf-700">
                Saved.
              </span>
            ) : null}
          </div>
        ) : null}
        <FormError error={save.error} />
      </form>

      <div className="flex flex-col gap-6 self-start">
        <Card>
          <h2 className="mb-1 font-bold">Can-do goals</h2>
          <p className="mb-3 text-sm text-bark-500">
            “Most children can…” — these become the Show &amp; Share checklist in the Teacher app.
          </p>
          <ListEditor items={goals} onChange={setGoals} disabled={!canEdit} itemLabel="Goal" multiline />
          {canEdit ? (
            <div className="mt-3 flex items-center gap-3">
              <Button size="sm" onClick={() => saveGoals.mutate(undefined)} busy={saveGoals.isPending}>
                Save goals
              </Button>
              {saveGoals.isSuccess ? (
                <span role="status" className="text-sm text-leaf-700">
                  Saved.
                </span>
              ) : null}
            </div>
          ) : null}
          <FormError error={saveGoals.error} />
        </Card>
        <UnitPictures unit={unit} />
      </div>
    </div>
  );
}
