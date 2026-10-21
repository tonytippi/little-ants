/** 125 → "2:05"; negative values (overtime) → "-0:30". */
export function formatClock(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? '-' : '';
  const seconds = Math.floor(Math.abs(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${sign}${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

/** 1536 → "1.5 KB", 5_400_000 → "5.1 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

const STAGES: Record<string, string> = {
  HEAR_IT: 'Hear it',
  JOIN_IN: 'Join in',
  SAY_IT_MYSELF: 'Say it myself',
  PARTY: 'Ant Hill Party',
  SHOW_AND_SHARE: 'Show & Share',
};

export function stageLabel(stage: string): string {
  return STAGES[stage] ?? stage;
}

export const LEVEL_LABELS = {
  NOT_YET: 'Not yet',
  WITH_HELP: 'With help',
  ON_MY_OWN: 'On my own',
} as const;
