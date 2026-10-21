/** Messages between the teacher's window and the TV (presenter) window. */
export type PresenterMessage =
  { type: 'state'; stepIndex: number; page: number; view: StageView } | { type: 'hello' } | { type: 'bye' };

export type StageView = 'material' | 'words';

export function presenterChannelName(sessionId: string): string {
  return `la-present-${sessionId}`;
}

export function isPresenterMessage(value: unknown): value is PresenterMessage {
  if (!value || typeof value !== 'object') return false;
  const type = (value as { type?: unknown }).type;
  return type === 'state' || type === 'hello' || type === 'bye';
}
