'use client';

import { useMemo } from 'react';
import {
  LISTENING_KIND_COLOURS,
  LISTENING_KIND_LABELS,
  listeningItemKey,
  listeningItemKind,
  type ListeningItem,
  type ListeningPayload,
} from '@little-ants/shared';
import { UnitArt } from '@little-ants/ui/storybook';
import { libraryShelves } from '../lib/library';
import { itemPicture, planItem } from '../lib/player-plan';
import { Vi } from './bits';

/** Library: every item of the leaves finished so far, by kind, to play one again. */
export function LibraryView({
  payload,
  finished,
  heard,
  onPlay,
}: {
  payload: ListeningPayload;
  finished: ReadonlySet<number>;
  heard: Record<string, number>;
  onPlay: (item: ListeningItem) => void;
}) {
  const shelves = useMemo(() => libraryShelves(payload.leaves, finished), [payload.leaves, finished]);
  return (
    <div>
      <h1 className="font-display text-[34px] leading-tight font-extrabold text-ant-500">Library</h1>
      <p className="max-w-[62ch] text-bark-500">
        Play any song, story or rhyme you have heard again.
        <Vi>Nghe lại bài hát, câu chuyện hay bài vè con đã nghe.</Vi>
      </p>
      {shelves.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-cream-100 p-4 text-bark-500">
          Finish your first leaf and its songs and stories appear here.
          <Vi>Nghe xong chiếc lá đầu tiên, các bài sẽ hiện ở đây.</Vi>
        </p>
      ) : null}
      {shelves.map((shelf) => (
        <section key={shelf.title}>
          <h2 className="mt-6 mb-1 font-display text-2xl font-extrabold">{shelf.title}</h2>
          <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4 lg:grid-cols-[repeat(auto-fill,minmax(190px,1fr))]">
            {shelf.items.map((item) => (
              <LibraryCard
                key={listeningItemKey(item)}
                item={item}
                payload={payload}
                plays={heard[listeningItemKey(item)] ?? 0}
                onPlay={() => onPlay(item)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function LibraryCard({
  item,
  payload,
  plays,
  onPlay,
}: {
  item: ListeningItem;
  payload: ListeningPayload;
  plays: number;
  onPlay: () => void;
}) {
  const kind = listeningItemKind(item);
  const colour = LISTENING_KIND_COLOURS[kind] ?? '#4F7F32';
  const picture = useMemo(() => itemPicture(planItem(item, payload, 'home')), [item, payload]);
  return (
    <button
      type="button"
      onClick={onPlay}
      className="flex flex-col gap-1.5 rounded-2xl p-1 text-left transition-transform hover:-translate-y-0.5"
    >
      <span className="grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-[22px] bg-white">
        {picture ? (
          <UnitArt key={picture.url} picture={picture} className="size-full" />
        ) : (
          <span className="font-display text-5xl font-extrabold" style={{ color: colour }} aria-hidden>
            {item.title.slice(0, 1)}
          </span>
        )}
      </span>
      <span
        className="text-[11px] leading-none font-semibold tracking-wider uppercase"
        style={{ color: colour }}
      >
        {LISTENING_KIND_LABELS[kind] ?? kind}
      </span>
      <span className="font-display text-base leading-tight font-bold">{item.title}</span>
      <span className="text-xs font-medium text-bark-500">
        {plays === 1 ? 'heard once' : `heard ${plays} times`}
      </span>
    </button>
  );
}
