'use client';

import { useEffect, useState, type PointerEvent, type ReactNode } from 'react';
import { Button } from '@little-ants/ui/button';
import { INK_COLORS, type InkStroke } from '../../lib/ink';
import { InkLayer, type DrawTool } from './ink-layer';
import { Stage } from './stage';
import type { StageFrame } from './stage-content';

interface Props {
  frame: StageFrame;
  strokes: InkStroke[];
  onLive: (stroke: InkStroke) => void;
  onStroke: (stroke: InkStroke) => void;
  onErase: (ids: string[]) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
  pageLabel: string;
  onBack: () => void;
  onForward: () => void;
  /** Hide / show on the TV, when one is connected. */
  tv: { hidden: boolean; onToggle: () => void } | null;
  onExit: () => void;
  /** Swipe to turn the page with the move tool. */
  onSwipeStart: (event: PointerEvent) => void;
  onSwipeEnd: (event: PointerEvent) => void;
}

const TOOLS: { tool: DrawTool; label: string; icon: string }[] = [
  { tool: 'move', label: 'Move (swipe to turn the page)', icon: '✋' },
  { tool: 'pen', label: 'Pen', icon: '✏️' },
  { tool: 'highlighter', label: 'Highlighter', icon: '🖍️' },
  { tool: 'eraser', label: 'Eraser', icon: '🧽' },
];

/** The stage on the teacher's whole screen, with a pen to draw on it (shown on the TV too). */
export function WideStage(props: Props) {
  const [tool, setTool] = useState<DrawTool>('pen');
  const [color, setColor] = useState(INK_COLORS[0]!);
  const { onExit } = props;

  // Full screen where the browser allows it; leaving full screen (Esc) leaves wide mode.
  useEffect(() => {
    let entered = false;
    const onChange = (): void => {
      if (document.fullscreenElement) entered = true;
      else if (entered) onExit();
    };
    let closed = false;
    document.addEventListener('fullscreenchange', onChange);
    // Closed before the browser finished going full screen: leave it again.
    document.documentElement
      .requestFullscreen?.()
      .then(() => {
        if (closed) void document.exitFullscreen().catch(() => undefined);
      })
      .catch(() => undefined);
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      closed = true;
      document.removeEventListener('fullscreenchange', onChange);
      window.removeEventListener('keydown', onKey);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [onExit]);

  const editor = {
    tool,
    color,
    onLive: props.onLive,
    onStroke: props.onStroke,
    onErase: props.onErase,
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-cream-100" role="dialog" aria-label="Wide stage">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <Button size="md" variant="secondary" onClick={props.onBack} aria-label="Back">
          ◀
        </Button>
        <span className="min-w-20 text-center text-sm font-semibold tabular-nums text-bark-700">
          {props.pageLabel}
        </span>
        <Button size="md" onClick={props.onForward} aria-label="Next">
          ▶
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {props.tv ? (
            <Button
              size="md"
              variant={props.tv.hidden ? 'primary' : 'secondary'}
              onClick={props.tv.onToggle}
              aria-pressed={props.tv.hidden}
            >
              {props.tv.hidden ? 'Show on TV' : 'Hide on TV'}
            </Button>
          ) : null}
          <Button size="md" variant="secondary" onClick={onExit}>
            ✕ Exit wide
          </Button>
        </div>
      </div>

      <div
        className={`relative mx-3 min-h-0 flex-1 select-none overflow-hidden rounded-3xl bg-cream-50 ring-1 ring-cream-200 ${tool === 'move' ? 'touch-pan-y' : 'touch-none'}`}
        onPointerDown={tool === 'move' ? props.onSwipeStart : undefined}
        onPointerUp={tool === 'move' ? props.onSwipeEnd : undefined}
      >
        <Stage
          frame={props.frame}
          // A new page starts a new layer, so a stroke never continues onto the next page.
          ink={<InkLayer key={props.frame.surface} strokes={props.strokes} editor={editor} />}
        />
        {props.tv?.hidden ? <HiddenBadge /> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-3 py-2" role="toolbar" aria-label="Drawing tools">
        {TOOLS.map((item) => (
          <ToolButton
            key={item.tool}
            active={tool === item.tool}
            label={item.label}
            onClick={() => setTool(item.tool)}
          >
            {item.icon}
          </ToolButton>
        ))}
        <span className="mx-1 h-8 w-px bg-cream-200" />
        {INK_COLORS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setColor(value);
              if (tool === 'move' || tool === 'eraser') setTool('pen');
            }}
            className={`size-10 rounded-full ring-offset-2 ${color === value ? 'ring-4 ring-bark-700' : 'ring-1 ring-cream-200'}`}
            style={{ backgroundColor: value }}
            aria-label={`Colour ${value}`}
            aria-pressed={color === value}
          />
        ))}
        <span className="mx-1 h-8 w-px bg-cream-200" />
        <ToolButton label="Undo" onClick={props.onUndo} disabled={!props.canUndo}>
          ↶
        </ToolButton>
        <ToolButton label="Redo" onClick={props.onRedo} disabled={!props.canRedo}>
          ↷
        </ToolButton>
        <ToolButton label="Clear this page" onClick={props.onClear} disabled={props.strokes.length === 0}>
          🗑
        </ToolButton>
      </div>
    </div>
  );
}

function ToolButton({
  active = false,
  disabled = false,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`flex size-12 items-center justify-center rounded-xl text-xl ${active ? 'bg-bark-900 text-white' : 'bg-white text-bark-900 ring-1 ring-cream-200 hover:bg-cream-100'} disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

/** Over the teacher's stage while the TV shows the logo. */
export function HiddenBadge() {
  return (
    <span className="absolute right-3 top-3 z-20 rounded-lg bg-bark-900/85 px-3 py-1.5 text-sm font-bold text-white">
      Hidden on TV
    </span>
  );
}
