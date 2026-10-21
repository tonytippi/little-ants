'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { MATERIAL_TYPES } from '@little-ants/shared';
import { Button } from '@little-ants/ui/button';
import { Card, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { Field, Select, TextArea, TextInput } from '@little-ants/ui/field';
import { FormError } from '../../../../components/form-error';
import { HistoryButton } from '../../../../components/history-panel';
import { MaterialFiles } from '../../../../components/material/material-files';
import { PagesEditor } from '../../../../components/material/pages-editor';
import { PageHeader } from '../../../../components/page-header';
import { StatusActions } from '../../../../components/status-actions';
import { api } from '../../../../lib/api';
import { fieldErrors, humanize, useApiMutation, usePermissions } from '../../../../lib/hooks';
import type { MaterialDetail } from '../../../../lib/types';

/** Material types whose content is a sequence of pages or cards. */
const PAGED = new Set(['STORY', 'BOOK', 'TALK_SCENE', 'SOUND_TRAIL', 'TINY_TRACKS', 'HOME_HILL', 'MOVE_AND_DO']);

export default function MaterialPage() {
  const { id } = useParams<{ id: string }>();
  const key = ['material', id];
  const query = useQuery({ queryKey: key, queryFn: () => api.get<MaterialDetail>(`/content/materials/${id}`) });

  if (query.isPending) return <Spinner label="Loading material" />;
  if (query.error) return <ErrorNotice error={query.error} />;
  const material = query.data;
  const invalidate = [key, ['unit', material.unit.code]];

  return (
    <div>
      <PageHeader
        back={{ href: `/units/${material.unit.code}?tab=materials`, label: `${material.unit.code} ${material.unit.title}` }}
        eyebrow={`${material.code} · ${humanize(material.type)}`}
        title={material.title}
        actions={<HistoryButton entityType="material" entityId={material.id} current={material as unknown as Record<string, unknown>} invalidate={invalidate} />}
      >
        {material.usedInLessons.length ? (
          <span>
            Used in lessons:{' '}
            {material.usedInLessons.map((lesson, index) => (
              <span key={lesson.id}>
                {index ? ', ' : ''}
                <Link href={`/lessons/${lesson.id}`} className="text-leaf-700 hover:underline">
                  {lesson.number}
                </Link>
              </span>
            ))}
          </span>
        ) : (
          'Not used in any lesson yet'
        )}
      </PageHeader>
      <div className="mb-5 flex justify-end">
        <StatusActions status={material.status} version={material.version} statusPath={`/content/materials/${material.id}/status`} invalidate={invalidate} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-6">
          <MaterialForm key={`${material.id}-${material.version}-${material.status}`} material={material} />
          <Card>
            <h2 className="mb-1 font-bold">Pages</h2>
            <p className="mb-4 text-sm text-bark-500">
              {PAGED.has(material.type)
                ? 'One entry per page or card, with its picture and audio. The Teacher app shows them in this order.'
                : 'Songs, chants and rhymes usually have no pages; add some if the poster has several panels.'}
            </p>
            <PagesEditor key={`pages-${material.version}-${material.pages.length}`} material={material} />
          </Card>
        </div>
        <div className="flex flex-col gap-6">
          <MaterialFiles material={material} />
          <ProductionCard material={material} />
        </div>
      </div>
    </div>
  );
}

function MaterialForm({ material }: { material: MaterialDetail }) {
  const { canEdit } = usePermissions();
  const [form, setForm] = useState({
    type: material.type,
    title: material.title,
    format: material.format,
    targetLanguage: material.targetLanguage,
    fullText: material.fullText,
    actions: material.actions,
    teacherNotes: material.teacherNotes,
    firstLesson: material.firstLesson ? String(material.firstLesson) : '',
  });
  const save = useApiMutation(
    () => api.patch(`/content/materials/${material.id}`, { ...form, firstLesson: form.firstLesson ? Number(form.firstLesson) : null }),
    [['material', material.id], ['unit', material.unit.code]],
  );
  const errors = fieldErrors(save.error);
  const set = (name: keyof typeof form) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [name]: event.target.value }));

  function submit(event: FormEvent): void {
    event.preventDefault();
    save.mutate(undefined);
  }

  return (
    <Card>
      <form onSubmit={submit}>
        <fieldset disabled={!canEdit} className="grid gap-4 md:grid-cols-2">
          <legend className="sr-only">Material details</legend>
          <Field label="Title" error={errors.title}>
            {(id) => <TextInput id={id} required value={form.title} onChange={set('title')} />}
          </Field>
          <Field label="Type">
            {(id) => (
              <Select id={id} value={form.type} onChange={set('type')}>
                {MATERIAL_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {humanize(type)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Tune / format" error={errors.format}>
            {(id) => <TextInput id={id} value={form.format} onChange={set('format')} />}
          </Field>
          <Field label="First taught in lesson" error={errors.firstLesson}>
            {(id) => <TextInput id={id} type="number" min={1} max={40} value={form.firstLesson} onChange={set('firstLesson')} />}
          </Field>
          <Field label="Target language" className="md:col-span-2" error={errors.targetLanguage}>
            {(id) => <TextInput id={id} value={form.targetLanguage} onChange={set('targetLanguage')} />}
          </Field>
          <Field label="Full text" hint="Lyrics or text exactly as children hear it. One line per sung or spoken line." className="md:col-span-2" error={errors.fullText}>
            {(id, describedBy) => <TextArea id={id} aria-describedby={describedBy} rows={10} className="font-child text-base" value={form.fullText} onChange={set('fullText')} />}
          </Field>
          <Field label="Actions / gestures" className="md:col-span-2">
            {(id) => <TextArea id={id} rows={3} value={form.actions} onChange={set('actions')} />}
          </Field>
          <Field label="Teacher notes" className="md:col-span-2">
            {(id) => <TextArea id={id} rows={3} value={form.teacherNotes} onChange={set('teacherNotes')} />}
          </Field>
        </fieldset>
        {canEdit ? (
          <div className="mt-4 flex items-center gap-3">
            <Button type="submit" busy={save.isPending}>
              Save material
            </Button>
            {material.status === 'APPROVED' ? <span className="text-xs text-bark-500">Saving starts a new draft version; the approved one stays in history.</span> : null}
          </div>
        ) : null}
        <div className="mt-3">
          <FormError error={save.error} />
        </div>
      </form>
    </Card>
  );
}

const STAGE_LABEL: Record<string, string> = {
  TEXT: 'Text',
  ENGLISH_CHECK: 'English check',
  ILLUSTRATION: 'Illustration',
  LAYOUT: 'Layout',
  AUDIO_VIDEO: 'Audio / video',
  TEACHER_TEST: 'Teacher test',
  PRINT_READY: 'Print-ready',
};

function ProductionCard({ material }: { material: MaterialDetail }) {
  if (material.production.length === 0) return null;
  return (
    <Card>
      <h2 className="mb-3 font-bold">Production</h2>
      <ul className="flex flex-col gap-1 text-sm">
        {material.production.map((row) => (
          <li key={row.id} className="flex justify-between gap-2">
            <span>{STAGE_LABEL[row.stage] ?? row.stage}</span>
            <span className="font-semibold">{row.state === 'NOT_APPLICABLE' ? 'N/A' : humanize(row.state)}</span>
          </li>
        ))}
      </ul>
      <Link href={`/units/${material.unit.code}?tab=production`} className="mt-3 inline-block text-sm font-semibold text-leaf-700 hover:underline">
        Edit on the production board
      </Link>
    </Card>
  );
}
