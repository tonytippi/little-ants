'use client';

import { UnitArt } from '@little-ants/ui/storybook';
import type { ParentChild, ParentUnit, SchoolClass } from '../lib/types';
import { Vi } from './bits';

const cardClass =
  'flex min-h-24 items-center gap-4 rounded-3xl bg-cream-100 p-4 text-left transition-colors hover:bg-sun-100';

/** "Who is listening?" for families with more than one child (remembered on the device). */
export function ChildPicker({ items, onPick }: { items: ParentChild[]; onPick: (id: string) => void }) {
  return (
    <section className="mx-auto max-w-2xl py-6">
      <h1 className="font-display text-4xl font-extrabold text-ant-500">Who is listening?</h1>
      <Vi className="text-lg">Bé nào đang nghe?</Vi>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {items.map((child) => {
          const unit = child.units.find((entry) => entry.current) ?? child.units.at(-1);
          return (
            <button key={child.id} type="button" className={cardClass} onClick={() => onPick(child.id)}>
              <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-white">
                {unit?.picture ? (
                  <UnitArt key={unit.picture.url} picture={unit.picture} className="size-full" />
                ) : (
                  <span className="font-display text-3xl font-extrabold text-leaf-600" aria-hidden>
                    {child.displayName.slice(0, 1)}
                  </span>
                )}
              </span>
              <span>
                <span className="block font-display text-2xl leading-tight font-extrabold">
                  {child.displayName}
                </span>
                <span className="text-sm text-bark-500">{child.className ?? ''}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Units a child may open, the class's current unit first. */
export function orderUnits(units: ParentUnit[]): ParentUnit[] {
  return [...units].sort((a, b) => Number(b.current) - Number(a.current) || b.number - a.number);
}

/** Switch between the units a child has studied (shown when there are several). */
export function UnitSwitcher({
  units,
  selected,
  onPick,
}: {
  units: ParentUnit[];
  selected: string;
  onPick: (code: string) => void;
}) {
  if (units.length < 2) return null;
  return (
    <div role="group" aria-label="Units" className="flex flex-wrap gap-2">
      {orderUnits(units).map((unit) => (
        <button
          key={unit.code}
          type="button"
          aria-pressed={unit.code === selected}
          onClick={() => onPick(unit.code)}
          className={`min-h-10 rounded-full px-3.5 text-sm font-semibold ${unit.code === selected ? 'bg-leaf-600 text-white' : 'bg-cream-100 text-bark-700 hover:bg-cream-200'}`}
        >
          Unit {unit.number} · {unit.title}
          {unit.current ? ' · now' : ''}
        </button>
      ))}
    </div>
  );
}

/** At school: pick the class on the screen (remembered on the device). */
export function ClassPicker({ items, onPick }: { items: SchoolClass[]; onPick: (id: string) => void }) {
  return (
    <section className="mx-auto max-w-3xl py-6">
      <h1 className="font-display text-4xl font-extrabold text-ant-500">Which class?</h1>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {items.map((entry) => (
          <button key={entry.id} type="button" className={cardClass} onClick={() => onPick(entry.id)}>
            <span>
              <span className="block font-display text-2xl leading-tight font-extrabold">{entry.name}</span>
              <span className="text-sm text-bark-500">
                {entry.campus.name} ·{' '}
                {entry.currentUnit
                  ? `${entry.currentUnit.title} · Lesson ${entry.nextLesson}`
                  : 'No unit yet'}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
