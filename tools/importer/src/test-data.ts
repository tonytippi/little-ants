import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { repoRoot } from './run-import.js';

/** Testing phase: every sync also approves and publishes what it imported (TEST_DATA_AFTER_SYNC=true). */
export function testDataAfterSync(env: Record<string, string | undefined>): boolean {
  return /^(true|1)$/i.test(env.TEST_DATA_AFTER_SYNC?.trim() ?? '');
}

/** Run the API's seed-test command (approve, publish, test class) and return its output lines. */
export async function runTestDataSeed(): Promise<string[]> {
  const script = path.join(repoRoot, 'apps', 'api', 'dist', 'cli', 'seed-test.js');
  try {
    const { stdout } = await promisify(execFile)(process.execPath, [script], {
      cwd: repoRoot,
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout.split('\n').filter((line) => line.trim());
  } catch (error) {
    const detail = (error as { stderr?: string }).stderr?.trim() || (error as Error).message;
    throw new Error(`Imported, but approving and publishing the test data failed: ${detail}`, {
      cause: error,
    });
  }
}

/** Report section listing what seed-test did. */
export function testDataReport(lines: string[]): string {
  return `\n## Test data\n\nApproved and published as imported (TEST_DATA_AFTER_SYNC):\n\n${lines.map((line) => `- ${line}`).join('\n')}\n`;
}
