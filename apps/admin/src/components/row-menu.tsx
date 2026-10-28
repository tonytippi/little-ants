'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';

export interface RowAction {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  /** Left out of the menu, e.g. "Activate" on an active row. */
  hidden?: boolean;
}

const MENU_WIDTH = 208;

/**
 * The ⋯ actions of a table row. The menu is fixed to the viewport so a scrolling table card does not clip it;
 * it follows its button when the page or card scrolls, closes on Escape, a click outside or picking an item, and
 * gives focus back to the button.
 */
export function RowMenu({ label, actions }: { label: string; actions: RowAction[] }) {
  const shown = actions.filter((action) => !action.hidden);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const open = position !== null;

  /** Puts the menu under its button (above it near the bottom of the screen); closes once the button is gone. */
  const place = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
      setPosition(null);
      return;
    }
    const height = menuRef.current?.offsetHeight ?? 0;
    const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    const below = rect.bottom + 4;
    const top =
      below + height > window.innerHeight - 8 && rect.top > height + 8 ? rect.top - height - 4 : below;
    setPosition({ top, left });
  }, []);

  function toggle(): void {
    if (open) setPosition(null);
    else place();
  }

  function close(focusButton = true): void {
    setPosition(null);
    if (focusButton) buttonRef.current?.focus();
  }

  // Once open, the menu's height is known: place it again and move focus to the first item.
  useLayoutEffect(() => {
    if (!open) return;
    place();
    menuRef.current?.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus();
  }, [open, place]);

  // Scrolling the page or the table card moves the menu with its button instead of closing it.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) close(false);
    };
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  function onMenuKey(event: KeyboardEvent): void {
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      items[event.key === 'Home' ? 0 : items.length - 1]?.focus();
    }
  }

  if (shown.length === 0) return null;
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={toggle}
        className={`rounded-lg px-2 py-1 text-lg leading-none font-bold text-bark-500 transition-colors hover:bg-cream-100 hover:text-bark-900 ${open ? 'bg-cream-100 text-bark-900' : ''}`}
      >
        ⋯
      </button>
      {position ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
          className="fixed z-50 rounded-xl border border-cream-200 bg-white p-1 shadow-lg"
        >
          {shown.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                close();
                action.onSelect();
              }}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold focus:outline-none ${
                action.danger
                  ? 'text-ant-600 hover:bg-ant-50 focus:bg-ant-50'
                  : 'text-bark-700 hover:bg-cream-100 focus:bg-cream-100'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
