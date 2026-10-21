import type { ImportIssue, IssueLevel } from './types.js';

export interface UnitReport {
  unit: string;
  title: string;
  counts: Record<string, number>;
  issues: ImportIssue[];
  notes: string[];
}

const ORDER: IssueLevel[] = ['error', 'warning', 'info'];
const LABEL: Record<IssueLevel, string> = { error: 'Errors', warning: 'Warnings', info: 'Notes' };

function escapeCell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

export function renderReport(reports: UnitReport[], options: { dryRun: boolean; startedAt: Date }): string {
  const lines: string[] = [];
  lines.push('# Master Sheet import report', '');
  lines.push(`Run: ${options.startedAt.toISOString()} · Mode: ${options.dryRun ? 'dry run (nothing written)' : 'write'}`, '');
  lines.push('| Unit | Title | Lessons | Words | Materials | Errors | Warnings | Notes |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const report of reports) {
    const count = (level: IssueLevel): number => report.issues.filter((issue) => issue.level === level).length;
    lines.push(
      `| ${report.unit} | ${escapeCell(report.title)} | ${report.counts.lessons ?? 0} | ${report.counts.words ?? 0} | ${report.counts.materials ?? 0} | ${count('error')} | ${count('warning')} | ${count('info')} |`,
    );
  }
  lines.push('');
  for (const report of reports) {
    lines.push(`## ${report.unit} – ${report.title}`, '');
    const counts = Object.entries(report.counts).map(([key, value]) => `${key}: ${value}`);
    if (counts.length) lines.push(`Counts: ${counts.join(' · ')}`, '');
    for (const note of report.notes) lines.push(`- ${note}`);
    if (report.notes.length) lines.push('');
    for (const level of ORDER) {
      const issues = report.issues.filter((issue) => issue.level === level);
      if (issues.length === 0) continue;
      lines.push(`### ${LABEL[level]} (${issues.length})`, '');
      lines.push('| Where | Problem |', '|---|---|');
      for (const issue of issues) lines.push(`| ${escapeCell(issue.where)} | ${escapeCell(issue.message)} |`);
      lines.push('');
    }
    if (report.issues.length === 0) lines.push('No problems found.', '');
  }
  return lines.join('\n');
}
