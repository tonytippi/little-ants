'use client';

import { Button } from '@little-ants/ui/button';
import { TextArea, TextInput } from '@little-ants/ui/field';

interface ListEditorProps {
  items: string[];
  onChange: (items: string[]) => void;
  itemLabel: string;
  disabled?: boolean;
  multiline?: boolean;
}

/** Editable ordered list of short texts with add, remove and move. */
export function ListEditor({
  items,
  onChange,
  itemLabel,
  disabled = false,
  multiline = false,
}: ListEditorProps) {
  const update = (index: number, value: string): void =>
    onChange(items.map((item, i) => (i === index ? value : item)));
  const move = (index: number, delta: number): void => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="mt-2 w-5 text-right text-xs font-bold text-bark-500">{index + 1}</span>
            {multiline ? (
              <TextArea
                aria-label={`${itemLabel} ${index + 1}`}
                rows={2}
                className="min-h-0"
                value={item}
                disabled={disabled}
                onChange={(event) => update(index, event.target.value)}
              />
            ) : (
              <TextInput
                aria-label={`${itemLabel} ${index + 1}`}
                value={item}
                disabled={disabled}
                onChange={(event) => update(index, event.target.value)}
              />
            )}
            {disabled ? null : (
              <div className="flex shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Move ${itemLabel} ${index + 1} up`}
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                >
                  ↑
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Move ${itemLabel} ${index + 1} down`}
                  onClick={() => move(index, 1)}
                  disabled={index === items.length - 1}
                >
                  ↓
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove ${itemLabel} ${index + 1}`}
                  onClick={() => onChange(items.filter((_, i) => i !== index))}
                >
                  ✕
                </Button>
              </div>
            )}
          </li>
        ))}
      </ol>
      {disabled ? null : (
        <Button size="sm" variant="ghost" className="self-start" onClick={() => onChange([...items, ''])}>
          + Add {itemLabel.toLowerCase()}
        </Button>
      )}
    </div>
  );
}
