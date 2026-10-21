'use client';

import { useState, type FormEvent } from 'react';
import { Badge, StatusBadge } from '@little-ants/ui/badge';
import { Button } from '@little-ants/ui/button';
import { EmptyState } from '@little-ants/ui/feedback';
import { Select, TextInput } from '@little-ants/ui/field';
import { api } from '../../lib/api';
import { useApiMutation, usePermissions } from '../../lib/hooks';
import type { UnitDetail, Word } from '../../lib/types';
import { AssetPicker } from '../assets/asset-picker';
import { FormError } from '../form-error';
import { HistoryButton } from '../history-panel';

type Editable = Pick<Word, 'text' | 'partOfSpeech' | 'kind' | 'group' | 'fromUnit' | 'pictureBrief' | 'notes'>;
const KINDS: Word['kind'][] = ['CORE', 'EXTRA', 'REVIEW'];

function nextCardId(unit: UnitDetail): string {
  const numbers = unit.words.map((word) => Number(/-(\d+)$/.exec(word.cardId)?.[1] ?? 0));
  return `${unit.code}-${String(Math.max(0, ...numbers) + 1).padStart(2, '0')}`;
}

export function WordsTab({ unit }: { unit: UnitDetail }) {
  const { canEdit } = usePermissions();
  const [filter, setFilter] = useState<'ALL' | Word['kind']>('ALL');
  const words = unit.words.filter((word) => word.status !== 'ARCHIVED' && (filter === 'ALL' || word.kind === filter));
  const counts = Object.fromEntries(KINDS.map((kind) => [kind, unit.words.filter((word) => word.kind === kind && word.status !== 'ARCHIVED').length]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-semibold">
          Show
          <Select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="w-40">
            <option value="ALL">All words</option>
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind.toLowerCase()} ({counts[kind]})
              </option>
            ))}
          </Select>
        </label>
        <p className="text-sm text-bark-500">
          {counts.CORE} core · {counts.EXTRA} extra · {counts.REVIEW} review
        </p>
      </div>
      {canEdit ? <AddWordForm unit={unit} /> : null}
      {words.length === 0 ? (
        <EmptyState title="No words" />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-cream-200 bg-white">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="bg-cream-100 text-left text-xs uppercase tracking-wide text-bark-500">
              <tr>
                <th className="px-3 py-2">Card</th>
                <th className="px-3 py-2">Word</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Kind</th>
                <th className="px-3 py-2">Group</th>
                <th className="px-3 py-2">Picture brief</th>
                <th className="px-3 py-2">Picture</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {words.map((word) => (
                <WordRow key={word.id} word={word} unitCode={unit.code} canEdit={canEdit} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function WordRow({ word, unitCode, canEdit }: { word: Word; unitCode: string; canEdit: boolean }) {
  const invalidate = [['unit', unitCode]];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Editable>(word);
  const [picking, setPicking] = useState(false);
  const save = useApiMutation((data: Partial<Word>) => api.patch(`/content/words/${word.id}`, data), invalidate);
  const archive = useApiMutation(() => api.del(`/content/words/${word.id}`), invalidate);
  const set = (key: keyof Editable, value: string): void => setDraft((current) => ({ ...current, [key]: value }));

  if (editing) {
    return (
      <tr className="border-t border-cream-200 bg-sun-100/40 align-top">
        <td className="px-3 py-2 font-mono text-xs">{word.cardId}</td>
        <td className="px-2 py-2">
          <TextInput aria-label="Word" value={draft.text} onChange={(event) => set('text', event.target.value)} />
        </td>
        <td className="px-2 py-2">
          <TextInput aria-label="Part of speech" value={draft.partOfSpeech} onChange={(event) => set('partOfSpeech', event.target.value)} />
        </td>
        <td className="px-2 py-2">
          <Select aria-label="Kind" value={draft.kind} onChange={(event) => set('kind', event.target.value)}>
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind.toLowerCase()}
              </option>
            ))}
          </Select>
        </td>
        <td className="px-2 py-2">
          <TextInput aria-label="Group" value={draft.group} onChange={(event) => set('group', event.target.value)} />
        </td>
        <td className="px-2 py-2" colSpan={2}>
          <TextInput aria-label="Picture brief" value={draft.pictureBrief} onChange={(event) => set('pictureBrief', event.target.value)} />
          {save.error ? <FormError error={save.error} /> : null}
        </td>
        <td className="px-2 py-2" colSpan={2}>
          <div className="flex gap-1">
            <Button size="sm" busy={save.isPending} onClick={() => save.mutate(draft, { onSuccess: () => setEditing(false) })}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setDraft(word); setEditing(false); }}>
              Cancel
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-cream-200 align-top">
      <td className="px-3 py-2 font-mono text-xs">{word.cardId}</td>
      <td className="px-3 py-2 font-semibold">{word.text}</td>
      <td className="px-3 py-2 text-bark-500">{word.partOfSpeech}</td>
      <td className="px-3 py-2">
        <Badge tone={word.kind === 'CORE' ? 'leaf' : word.kind === 'REVIEW' ? 'sun' : 'neutral'}>{word.kind.toLowerCase()}</Badge>
      </td>
      <td className="px-3 py-2 text-bark-500">{word.group}</td>
      <td className="max-w-64 px-3 py-2 text-bark-500">{word.pictureBrief}</td>
      <td className="px-3 py-2">
        {canEdit ? (
          <Button size="sm" variant="ghost" onClick={() => setPicking(true)}>
            {word.imageAssetId ? 'Change' : 'Add'}
          </Button>
        ) : word.imageAssetId ? (
          'Yes'
        ) : (
          '—'
        )}
        <AssetPicker open={picking} onClose={() => setPicking(false)} kind="IMAGE" unitCode={unitCode} title={`Picture for “${word.text}”`} onPick={([id]) => id && save.mutate({ imageAssetId: id })} />
      </td>
      <td className="px-3 py-2">
        <StatusBadge status={word.status} />
      </td>
      <td className="px-3 py-2">
        <div className="flex justify-end gap-1">
          {canEdit ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                busy={archive.isPending}
                onClick={() => window.confirm(`Archive “${word.text}”? It will be left out of releases.`) && archive.mutate(undefined)}
              >
                Archive
              </Button>
            </>
          ) : null}
          <HistoryButton entityType="word" entityId={word.id} current={word as unknown as Record<string, unknown>} invalidate={invalidate} />
        </div>
        {archive.error ? <FormError error={archive.error} /> : null}
      </td>
    </tr>
  );
}

function AddWordForm({ unit }: { unit: UnitDetail }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<Word['kind']>('CORE');
  const [group, setGroup] = useState('');
  const [pictureBrief, setPictureBrief] = useState('');
  const add = useApiMutation(
    () => api.post(`/content/units/${unit.code}/words`, { cardId: nextCardId(unit), text, kind, group, pictureBrief }),
    [['unit', unit.code], ['units']],
  );

  function submit(event: FormEvent): void {
    event.preventDefault();
    add.mutate(undefined, {
      onSuccess: () => {
        setText('');
        setGroup('');
        setPictureBrief('');
      },
    });
  }

  if (!open) {
    return (
      <Button size="sm" variant="secondary" className="self-start" onClick={() => setOpen(true)}>
        + Add word
      </Button>
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 rounded-xl bg-white p-3 ring-1 ring-cream-200">
      <TextInput aria-label="New word" placeholder="Word or phrase" required value={text} onChange={(event) => setText(event.target.value)} className="w-48" />
      <Select aria-label="Kind" value={kind} onChange={(event) => setKind(event.target.value as Word['kind'])} className="w-32">
        {KINDS.map((item) => (
          <option key={item} value={item}>
            {item.toLowerCase()}
          </option>
        ))}
      </Select>
      <TextInput aria-label="Group" placeholder="Group" value={group} onChange={(event) => setGroup(event.target.value)} className="w-40" />
      <TextInput aria-label="Picture brief" placeholder="Picture brief for the designer" value={pictureBrief} onChange={(event) => setPictureBrief(event.target.value)} className="min-w-64 flex-1" />
      <Button type="submit" size="md" busy={add.isPending}>
        Add as {nextCardId(unit)}
      </Button>
      <Button variant="ghost" onClick={() => setOpen(false)}>
        Close
      </Button>
      {add.error ? <div className="w-full"><FormError error={add.error} /></div> : null}
    </form>
  );
}
