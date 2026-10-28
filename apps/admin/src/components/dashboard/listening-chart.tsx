import type { Dashboard } from '../../lib/types';

type Day = NonNullable<Dashboard['school']>['listening'][number];

/** A clean top for the y-axis: the next 2, 5 or 10 step above the highest value (at least 4). */
function niceTop(max: number): number {
  if (max <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 5, 10].map((factor) => factor * magnitude).find((value) => value >= max / 2)!;
  return Math.ceil(max / step) * step;
}

function dayLabel(day: string, long = false): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    ...(long ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric' }),
  });
}

function describe({ leaves, children }: Day): string {
  if (leaves === 0) return 'no leaves';
  return `${leaves} leaf${leaves === 1 ? '' : 'ves'} by ${children} child${children === 1 ? '' : 'ren'}`;
}

/**
 * Leaves finished at home per day, one bar per day ending today. A single series, so no legend; the busiest
 * day carries its value, every bar has a hover and focus tooltip, and the table below holds every number.
 */
export function ListeningChart({ days }: { days: Day[] }) {
  const max = Math.max(0, ...days.map((day) => day.leaves));
  const top = niceTop(max);
  const peak = days.findLastIndex((day) => day.leaves === max && max > 0);
  const ticks = [top, top / 2, 0];

  return (
    <figure>
      <div className="flex">
        {/* Y-axis ticks; the gridlines sit behind the bars at the same heights. */}
        <div
          aria-hidden
          className="relative mr-2 h-44 w-6 shrink-0 text-right text-[11px] tabular-nums text-bark-500"
        >
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: `${100 - (tick / top) * 100}%` }}
            >
              {tick}
            </span>
          ))}
        </div>
        <div className="relative h-44 flex-1">
          {ticks.map((tick) => (
            <span
              key={tick}
              aria-hidden
              className={`absolute inset-x-0 h-px ${tick === 0 ? 'bg-cream-200' : 'bg-cream-100'}`}
              style={{ top: `${100 - (tick / top) * 100}%` }}
            />
          ))}
          <ol className="relative flex h-full items-end" aria-label="Leaves finished per day">
            {days.map((day, index) => (
              <li
                key={day.day}
                tabIndex={0}
                aria-label={`${dayLabel(day.day, true)}: ${describe(day)}`}
                className="group relative flex h-full flex-1 items-end justify-center rounded-md focus:outline-none focus-visible:bg-cream-50"
              >
                {day.leaves > 0 ? (
                  <span
                    className="w-full max-w-6 rounded-t-[4px] bg-leaf-500 transition-colors group-hover:bg-leaf-600 group-focus-visible:bg-leaf-600"
                    style={{ height: `${(day.leaves / top) * 100}%`, marginInline: 1 }}
                  />
                ) : null}
                {index === peak ? (
                  <span
                    aria-hidden
                    className="absolute text-[11px] font-bold tabular-nums text-bark-700"
                    style={{ bottom: `calc(${(day.leaves / top) * 100}% + 2px)` }}
                  >
                    {day.leaves}
                  </span>
                ) : null}
                <span
                  role="tooltip"
                  style={{ bottom: `calc(${(day.leaves / top) * 100}% + ${index === peak ? 20 : 6}px)` }}
                  className={`pointer-events-none absolute z-10 hidden whitespace-nowrap ${
                    index < 2 ? 'left-0' : index > days.length - 3 ? 'right-0' : ''
                  } rounded-lg bg-bark-900 px-2.5 py-1.5 text-xs text-white shadow-lg group-hover:block group-focus-visible:block`}
                >
                  <strong className="block text-sm">
                    {day.leaves} lea{day.leaves === 1 ? 'f' : 'ves'}
                  </strong>
                  <span className="text-white/75">
                    {dayLabel(day.day, true)} · {day.children} child{day.children === 1 ? '' : 'ren'}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div aria-hidden className="mt-1 ml-8 flex text-[11px] tabular-nums text-bark-500">
        {days.map((day, index) => (
          <span key={day.day} className="flex-1 text-center">
            {index === days.length - 1 ? 'Today' : index % 2 === days.length % 2 ? dayLabel(day.day) : ''}
          </span>
        ))}
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-bark-500 hover:text-bark-700">
          Show as table
        </summary>
        <table className="mt-2 w-full text-left text-xs">
          <thead className="text-bark-500">
            <tr>
              <th className="py-1 font-semibold">Day</th>
              <th className="py-1 text-right font-semibold">Leaves</th>
              <th className="py-1 text-right font-semibold">Children</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {[...days].reverse().map((day) => (
              <tr key={day.day} className="border-t border-cream-100">
                <td className="py-1">{dayLabel(day.day, true)}</td>
                <td className="py-1 text-right">{day.leaves}</td>
                <td className="py-1 text-right">{day.children}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
