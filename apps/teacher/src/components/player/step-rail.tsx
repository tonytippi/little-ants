import type { ReleaseStep } from '@little-ants/shared';

/** All steps of the lesson; the current one is highlighted, finished ones ticked. Tap to jump. */
export function StepRail({
  steps,
  current,
  onSelect,
}: {
  steps: ReleaseStep[];
  current: number;
  onSelect: (index: number) => void;
}) {
  return (
    <nav aria-label="Lesson steps" className="overflow-x-auto">
      <ol className="flex min-w-max gap-2 p-1">
        {steps.map((step, index) => {
          const state = index < current ? 'done' : index === current ? 'current' : 'next';
          return (
            <li key={step.order}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                aria-current={state === 'current' ? 'step' : undefined}
                className={`flex h-14 max-w-48 flex-col items-start justify-center rounded-xl px-3 text-left text-sm transition-colors ${
                  state === 'current'
                    ? 'bg-leaf-600 text-white shadow-sm'
                    : state === 'done'
                      ? 'bg-leaf-50 text-leaf-700 hover:bg-leaf-100'
                      : 'bg-white text-bark-700 ring-1 ring-cream-200 hover:bg-cream-100'
                }`}
              >
                <span className="text-[11px] font-bold uppercase opacity-80">
                  {state === 'done' ? '✓ ' : ''}
                  {step.minutes}′
                </span>
                <span className="w-full truncate font-semibold">{step.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
