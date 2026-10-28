'use client';

import { Button } from '@little-ants/ui/button';
import { TextInput } from '@little-ants/ui/field';

export interface ParentEmail {
  email: string;
  relationship: string;
}

export const EMPTY_PARENT: ParentEmail = { email: '', relationship: '' };

/** The API takes at most this many parents with a new child. */
const MAX_PARENTS = 4;

/** Rows filled in, ready to send with a new child. */
export function filledParents(rows: ParentEmail[]): ParentEmail[] {
  return rows
    .map((row) => ({ email: row.email.trim(), relationship: row.relationship.trim() }))
    .filter((row) => row.email);
}

/** Parent email rows of the "add child" form; every row is optional. */
export function ParentEmailFields({
  rows,
  onChange,
}: {
  rows: ParentEmail[];
  onChange: (rows: ParentEmail[]) => void;
}) {
  const set = (index: number, patch: Partial<ParentEmail>) =>
    onChange(rows.map((row, at) => (at === index ? { ...row, ...patch } : row)));

  return (
    <fieldset className="flex w-full flex-col gap-2">
      <legend className="mb-1 text-xs text-bark-500">
        Parents (optional) — they sign in to the Listening Time app with this Google email
      </legend>
      {rows.map((row, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <TextInput
            aria-label={`Parent ${index + 1} email`}
            type="email"
            placeholder="Parent's Google email"
            value={row.email}
            onChange={(event) => set(index, { email: event.target.value })}
            className="w-60"
          />
          <TextInput
            aria-label={`Parent ${index + 1} relationship`}
            placeholder="Relationship (e.g. Mother)"
            maxLength={40}
            value={row.relationship}
            onChange={(event) => set(index, { relationship: event.target.value })}
            className="w-48"
          />
          {rows.length > 1 ? (
            <Button size="sm" variant="ghost" onClick={() => onChange(rows.filter((_, at) => at !== index))}>
              Remove
            </Button>
          ) : null}
        </div>
      ))}
      {rows.length < MAX_PARENTS ? (
        <Button
          size="sm"
          variant="ghost"
          className="self-start"
          onClick={() => onChange([...rows, EMPTY_PARENT])}
        >
          + Another parent
        </Button>
      ) : null}
    </fieldset>
  );
}
