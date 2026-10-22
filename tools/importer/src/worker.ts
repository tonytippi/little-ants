import type { PrismaClient } from '@little-ants/db';

/** Does the actual import; `log` receives progress lines. */
export type ImportJob = (log: (message: string) => void) => Promise<{ report: string; archive: string | null }>;

/** Runs left "running" by a worker that stopped mid-way can never finish; mark them failed. */
export async function failInterruptedRuns(prisma: PrismaClient): Promise<number> {
  const result = await prisma.importRun.updateMany({
    where: { status: 'RUNNING' },
    data: { status: 'FAILED', finishedAt: new Date(), message: 'The import worker stopped during this run. Start a new sync.' },
  });
  return result.count;
}

/**
 * Claim the oldest queued run and carry it out. Returns false when nothing was queued.
 * The claim is a conditional update, so two workers never run the same request.
 */
export async function processNextRun(prisma: PrismaClient, job: ImportJob): Promise<boolean> {
  const next = await prisma.importRun.findFirst({ where: { status: 'QUEUED' }, orderBy: { createdAt: 'asc' } });
  if (!next) return false;
  const claimed = await prisma.importRun.updateMany({
    where: { id: next.id, status: 'QUEUED' },
    data: { status: 'RUNNING', startedAt: new Date(), message: 'Starting' },
  });
  if (claimed.count === 0) return true;

  // Progress lines are written one after another so the latest line always wins.
  let progress = Promise.resolve();
  const log = (message: string): void => {
    console.log(message);
    progress = progress
      .then(() => prisma.importRun.update({ where: { id: next.id }, data: { message } }))
      .then(
        () => undefined,
        () => undefined,
      );
  };

  try {
    const result = await job(log);
    await progress;
    await prisma.importRun.update({
      where: { id: next.id },
      data: { status: 'SUCCEEDED', finishedAt: new Date(), message: 'Finished', report: result.report, archive: result.archive },
    });
  } catch (error) {
    await progress;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Import failed: ${message}`);
    await prisma.importRun.update({ where: { id: next.id }, data: { status: 'FAILED', finishedAt: new Date(), message } });
  }
  return true;
}

/** Poll for queued runs until `signal` aborts. */
export async function runWorker(prisma: PrismaClient, job: ImportJob, options: { pollMs?: number; signal?: AbortSignal } = {}): Promise<void> {
  const interrupted = await failInterruptedRuns(prisma);
  if (interrupted) console.log(`Marked ${interrupted} interrupted run(s) as failed.`);
  console.log('Import worker waiting for sync requests.');
  while (!options.signal?.aborted) {
    const worked = await processNextRun(prisma, job);
    if (!worked) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, options.pollMs ?? 5000);
        options.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  }
}
