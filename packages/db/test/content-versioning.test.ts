import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  canChangeStatus,
  changeContentStatus,
  createPrismaClient,
  editContent,
  stateAfterEdit,
  type Material,
  type PrismaClient,
} from '../src/index.js';
import { testDatabaseUrl } from '../src/testing.js';
import { TEST_SCHEMA } from './global-setup.js';

describe('stateAfterEdit', () => {
  it('starts a new draft version when approved content is edited', () => {
    expect(stateAfterEdit({ status: 'APPROVED', version: 3 })).toEqual({ status: 'DRAFT', version: 4 });
  });

  it('keeps the version for drafts and sends items in review back to draft', () => {
    expect(stateAfterEdit({ status: 'DRAFT', version: 1 })).toEqual({ status: 'DRAFT', version: 1 });
    expect(stateAfterEdit({ status: 'REVIEW', version: 2 })).toEqual({ status: 'DRAFT', version: 2 });
  });
});

describe('canChangeStatus', () => {
  it('allows approval only from review', () => {
    expect(canChangeStatus('REVIEW', 'APPROVED')).toBe(true);
    expect(canChangeStatus('DRAFT', 'APPROVED')).toBe(false);
  });
});

describe('editContent and changeContentStatus', () => {
  let prisma: PrismaClient;
  let materialId: string;

  beforeAll(async () => {
    prisma = createPrismaClient(testDatabaseUrl(TEST_SCHEMA));
    const program = await prisma.program.create({ data: { code: 'T1', name: 'Test program' } });
    const level = await prisma.level.create({
      data: { programId: program.id, number: 1, name: 'Level', ageBand: '3–4', lessonMinutes: '25' },
    });
    const unit = await prisma.unit.create({
      data: { levelId: level.id, code: 'T01', number: 1, title: 'Test unit' },
    });
    const material = await prisma.material.create({
      data: { unitId: unit.id, code: 'SG1', type: 'SONG', title: 'Hello song', fullText: 'Hello!' },
    });
    materialId = material.id;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('records a revision for every change and reopens approved content as a new draft', async () => {
    await changeContentStatus(prisma, 'material', materialId, 'REVIEW', { note: 'ready' });
    const approved = await changeContentStatus<Material>(prisma, 'material', materialId, 'APPROVED');
    expect(approved.status).toBe('APPROVED');
    expect(approved.version).toBe(1);

    const edited = await editContent<Material>(prisma, 'material', materialId, {
      fullText: 'Hello, friends!',
    });
    expect(edited.status).toBe('DRAFT');
    expect(edited.version).toBe(2);
    expect(edited.fullText).toBe('Hello, friends!');

    const revisions = await prisma.revision.findMany({
      where: { entityType: 'material', entityId: materialId },
      orderBy: { createdAt: 'asc' },
    });
    expect(revisions.map((revision) => revision.version)).toEqual([1, 1, 2]);
    // The approved version 1 snapshot is still available unchanged.
    expect((revisions[1]?.snapshot as { fullText: string }).fullText).toBe('Hello!');
  });

  it('ignores status and version passed as edit data', async () => {
    const edited = await editContent<Material>(prisma, 'material', materialId, {
      status: 'APPROVED',
      version: 99,
    });
    expect(edited.status).toBe('DRAFT');
    expect(edited.version).toBe(2);
  });

  it('rejects skipping review', async () => {
    await expect(changeContentStatus(prisma, 'material', materialId, 'APPROVED')).rejects.toThrow(
      /Cannot change/,
    );
  });
});
