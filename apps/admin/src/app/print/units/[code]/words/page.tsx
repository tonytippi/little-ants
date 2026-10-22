'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { PrintToolbar } from '../../../../../components/print/print-toolbar';
import { api } from '../../../../../lib/api';
import type { UnitDetail, Word } from '../../../../../lib/types';

const KIND_TITLE: Record<Word['kind'], string> = {
  CORE: 'Core words',
  REVIEW: 'Review words',
  EXTRA: 'Extra words (heard only)',
};

/** Unit word list with picture briefs, for teachers and designers. */
export default function PrintWordsPage() {
  const { code } = useParams<{ code: string }>();
  const query = useQuery({
    queryKey: ['unit', code],
    queryFn: () => api.get<UnitDetail>(`/content/units/${code}`),
  });
  if (query.isPending) return <Spinner label="Loading words" />;
  if (query.error) return <ErrorNotice error={query.error} />;
  const unit = query.data;
  const words = unit.words.filter((word) => word.status !== 'ARCHIVED');

  return (
    <>
      <PrintToolbar title={`${unit.code} · Word list`} back={`/units/${unit.code}?tab=words`} />
      <article className="mx-auto max-w-[190mm] px-6 py-8 print:px-0 print:py-0">
        <header className="border-b-2 border-leaf-600 pb-2">
          <p className="text-[9pt] font-bold uppercase tracking-wider text-ant-500">
            {unit.code} · Level {unit.level.number} {unit.level.name}
          </p>
          <h1 className="text-2xl font-extrabold">{unit.title} — word list</h1>
          {unit.keyLanguage.length ? (
            <p className="mt-1 text-[10pt] italic">{unit.keyLanguage.join(' · ')}</p>
          ) : null}
        </header>
        {(['CORE', 'REVIEW', 'EXTRA'] as const).map((kind) => {
          const list = words.filter((word) => word.kind === kind);
          if (list.length === 0) return null;
          return (
            <section key={kind} className="mt-5">
              <h2 className="mb-1 text-[9pt] font-extrabold uppercase tracking-wider text-leaf-700">
                {KIND_TITLE[kind]} ({list.length})
              </h2>
              <table className="w-full border-collapse text-[10pt]">
                <thead>
                  <tr className="bg-leaf-50 text-left">
                    <th className="w-20 border border-cream-200 px-2 py-1">Card</th>
                    <th className="w-36 border border-cream-200 px-2 py-1">Word</th>
                    <th className="w-28 border border-cream-200 px-2 py-1">Group</th>
                    <th className="border border-cream-200 px-2 py-1">Picture brief</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((word) => (
                    <tr key={word.id} className="break-inside-avoid">
                      <td className="border border-cream-200 px-2 py-1 font-mono text-[9pt]">
                        {word.cardId}
                      </td>
                      <td className="border border-cream-200 px-2 py-1 font-child text-[12pt] font-bold">
                        {word.text}
                      </td>
                      <td className="border border-cream-200 px-2 py-1">{word.group}</td>
                      <td className="border border-cream-200 px-2 py-1">{word.pictureBrief}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
      </article>
    </>
  );
}
