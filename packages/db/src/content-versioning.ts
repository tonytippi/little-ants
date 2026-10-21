import type { ContentStatus, Prisma, PrismaClient } from './generated/prisma/client.js';

/** Content tables that carry `status` + `version` and keep a revision history. */
export const CONTENT_ENTITIES = ['unit', 'word', 'material', 'lesson'] as const;
export type ContentEntity = (typeof CONTENT_ENTITIES)[number];

export interface VersionedState {
  status: ContentStatus;
  version: number;
}

/**
 * State after an edit. Approved content is never changed in place:
 * editing it starts a new draft version that must be approved again.
 * Editing an item in review sends it back to draft, so a reviewer only ever approves what they saw.
 */
export function stateAfterEdit(current: VersionedState): VersionedState {
  if (current.status === 'APPROVED') {
    return { status: 'DRAFT', version: current.version + 1 };
  }
  return { status: 'DRAFT', version: current.version };
}

const STATUS_FLOW: Record<ContentStatus, ContentStatus[]> = {
  DRAFT: ['REVIEW', 'ARCHIVED'],
  REVIEW: ['DRAFT', 'APPROVED', 'ARCHIVED'],
  APPROVED: ['ARCHIVED'],
  ARCHIVED: ['DRAFT'],
};

export function canChangeStatus(from: ContentStatus, to: ContentStatus): boolean {
  return STATUS_FLOW[from].includes(to);
}

export interface ChangeContext {
  authorId?: string | null;
  note?: string;
}

type Tx = Prisma.TransactionClient;

// The four content delegates share the same findUniqueOrThrow/update shape.
interface ContentDelegate {
  findUniqueOrThrow(args: { where: { id: string } }): Promise<VersionedState & { id: string }>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<VersionedState & { id: string }>;
}

function delegateFor(tx: Tx, entity: ContentEntity): ContentDelegate {
  return tx[entity] as unknown as ContentDelegate;
}

export async function writeRevision(
  tx: Tx,
  entity: ContentEntity,
  row: { id: string; version: number },
  context: ChangeContext,
): Promise<void> {
  await tx.revision.create({
    data: {
      entityType: entity,
      entityId: row.id,
      version: row.version,
      snapshot: JSON.parse(JSON.stringify(row)) as Prisma.InputJsonValue,
      authorId: context.authorId ?? null,
      note: context.note ?? '',
    },
  });
}

/** Update a content row, apply the approval rule, and record a revision in one transaction. */
export async function editContent<T extends VersionedState & { id: string }>(
  client: PrismaClient,
  entity: ContentEntity,
  id: string,
  data: Record<string, unknown>,
  context: ChangeContext = {},
): Promise<T> {
  return client.$transaction(async (tx) => {
    const delegate = delegateFor(tx, entity);
    const current = await delegate.findUniqueOrThrow({ where: { id } });
    const { status: _ignoredStatus, version: _ignoredVersion, ...fields } = data;
    const updated = await delegate.update({ where: { id }, data: { ...fields, ...stateAfterEdit(current) } });
    await writeRevision(tx, entity, updated, context);
    return updated as T;
  });
}

/** Move a content row through the review workflow and record a revision. */
export async function changeContentStatus<T extends VersionedState & { id: string }>(
  client: PrismaClient,
  entity: ContentEntity,
  id: string,
  to: ContentStatus,
  context: ChangeContext = {},
): Promise<T> {
  return client.$transaction(async (tx) => {
    const delegate = delegateFor(tx, entity);
    const current = await delegate.findUniqueOrThrow({ where: { id } });
    if (!canChangeStatus(current.status, to)) {
      throw new Error(`Cannot change ${entity} status from ${current.status} to ${to}`);
    }
    const updated = await delegate.update({ where: { id }, data: { status: to } });
    await writeRevision(tx, entity, updated, context);
    return updated as T;
  });
}
