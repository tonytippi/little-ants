import ExcelJS from 'exceljs';
import type { ProductionStage } from '@little-ants/db';
import {
  isMaterialCode,
  materialCodesIn,
  materialTypeForCode,
  parseMinutes,
  productionState,
  splitList,
  wordKind,
} from './mapping.js';
import type {
  ClassOverviewRow,
  GateRow,
  ImportIssue,
  LinkRow,
  MasterSheetData,
  MaterialRow,
  PrepRow,
  ProductionRow,
  UnitOverview,
  WordRow,
} from './types.js';

type Row = string[];

/** Plain text of an ExcelJS cell value (rich text, formulas, hyperlinks, dates). */
export function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((part) => part.text).join('');
    if ('text' in value && typeof value.text === 'string') return value.text;
    if ('result' in value) return value.result == null ? '' : cellText(value.result as ExcelJS.CellValue);
    return '';
  }
  return String(value);
}

function rowsOf(sheet: ExcelJS.Worksheet): Row[] {
  const rows: Row[] = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: string[] = [];
    for (let col = 1; col <= sheet.columnCount; col += 1) {
      cells.push(cellText(row.getCell(col).value).replaceAll('\r\n', '\n').trim());
    }
    rows[rowNumber - 1] = cells;
  });
  return Array.from(rows, (row) => row ?? []);
}

function findSheet(workbook: ExcelJS.Workbook, tabNumber: number): ExcelJS.Worksheet | undefined {
  return workbook.worksheets.find((sheet) => sheet.name.trim().startsWith(`${tabNumber}.`));
}

interface Table {
  header: Map<string, number>;
  rows: Row[];
}

/** Rows under the header row whose first cell equals `firstHeader`. Header names are matched case-insensitively. */
function tableOf(rows: Row[], firstHeader: string): Table | null {
  const headerIndex = rows.findIndex((row) => row[0]?.toLowerCase() === firstHeader.toLowerCase());
  if (headerIndex < 0) return null;
  const header = new Map<string, number>();
  rows[headerIndex]?.forEach((name, index) => {
    if (name) header.set(name.toLowerCase(), index);
  });
  const body = rows.slice(headerIndex + 1).filter((row) => row.some((cell) => cell));
  return { header, rows: body };
}

/** Value of the first column whose header starts with `prefix`. */
function col(table: Table, row: Row, prefix: string): string {
  const lower = prefix.toLowerCase();
  for (const [name, index] of table.header) {
    if (name.startsWith(lower)) return row[index] ?? '';
  }
  return '';
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseOverview(rows: Row[], issues: ImportIssue[]): UnitOverview {
  const values = new Map<string, string>();
  const canDoGoals: string[] = [];
  const keyLanguage: string[] = [];
  const sounds: UnitOverview['sounds'] = [];
  let section = '';
  for (const [label = '', value = ''] of rows) {
    const key = label.toLowerCase();
    if (!label) continue;
    // Section headings are upper-case labels with no value, e.g. "CAN-DO GOALS (most children can...)".
    if (!value && /^[A-Z][A-Z\s/&-]{3,}/.test(label)) {
      section = key;
      continue;
    }
    if (section.startsWith('can-do') && /^goal \d+/.test(key)) canDoGoals.push(value);
    else if (section.startsWith('key language') && /^pattern \d+/.test(key)) keyLanguage.push(value);
    else if (section.startsWith('sounds') && value) sounds.push({ sound: label.replaceAll(/\s+/g, ' '), words: value });
    else if (!section) values.set(key, value);
  }
  const get = (prefix: string): string => {
    for (const [key, value] of values) if (key.startsWith(prefix) && value) return value;
    return '';
  };
  const codeMatch = /^U(\d{2})/.exec(get('unit code'));
  const levelMatch = /Level (\d)/.exec(get('level'));
  if (!codeMatch) issues.push({ level: 'error', where: 'tab 1 Overview', message: 'Unit code not found' });
  if (!levelMatch) issues.push({ level: 'error', where: 'tab 1 Overview', message: 'Level not found' });
  return {
    code: codeMatch ? `U${codeMatch[1]}` : '',
    number: codeMatch ? Number(codeMatch[1]) : 0,
    levelNumber: levelMatch ? Number(levelMatch[1]) : 0,
    title: get('theme'),
    leadCharacterNote: get('lead character'),
    circle: get('circle'),
    vnLink: get('vietnamese'),
    bigQuestion: get('big question'),
    value: get('value'),
    party: get('ant hill party'),
    levelRulesNote: get('level rules'),
    canDoGoals: canDoGoals.map((goal) => goal.replace(/^\.\.\./, '').trim()),
    keyLanguage,
    sounds,
  };
}

function parseWords(rows: Row[], unitCode: string): WordRow[] {
  const table = tableOf(rows, 'Card ID');
  if (!table) return [];
  let extra = 0;
  return table.rows
    .filter((row) => col(table, row, 'word'))
    .map((row, index) => {
      const given = col(table, row, 'card id');
      // Extra words have no card ("—"); give them a stable ID so re-imports update the same row.
      const cardId = /^U\d{2}-\d+/.test(given) ? given : `${unitCode}-X${String((extra += 1)).padStart(2, '0')}`;
      return {
        cardId,
        order: index + 1,
        text: col(table, row, 'word'),
        partOfSpeech: col(table, row, 'type'),
        kind: wordKind(col(table, row, 'level')),
        group: col(table, row, 'group'),
        fromUnit: col(table, row, 'from unit'),
        pictureBrief: col(table, row, 'picture brief'),
        notes: col(table, row, 'notes'),
      };
    });
}

function parseLinks(rows: Row[]): LinkRow[] {
  const table = tableOf(rows, 'What we bring back');
  if (!table) return [];
  return table.rows.map((row) => ({
    what: col(table, row, 'what'),
    fromUnit: col(table, row, 'from unit'),
    how: col(table, row, 'how'),
    where: col(table, row, 'where'),
  }));
}

function parseMaterials(planRows: Row[], textRows: Row[], issues: ImportIssue[]): MaterialRow[] {
  const byCode = new Map<string, MaterialRow>();
  const plan = tableOf(planRows, 'ID');
  for (const row of plan?.rows ?? []) {
    const code = col(plan!, row, 'id');
    if (!code) continue;
    if (!isMaterialCode(code)) {
      issues.push({ level: 'warning', where: 'tab 4 Materials Plan', message: `Unknown material code "${code}"` });
    }
    byCode.set(code, {
      code,
      type: materialTypeForCode(code),
      typeLabel: col(plan!, row, 'type'),
      title: col(plan!, row, 'title'),
      format: col(plan!, row, 'tune'),
      targetLanguage: col(plan!, row, 'target language'),
      fullText: '',
      actions: '',
      teacherNotes: '',
    });
  }
  const texts = tableOf(textRows, 'ID');
  for (const row of texts?.rows ?? []) {
    const rawCode = col(texts!, row, 'id');
    if (!rawCode) continue;
    // TT1..TT6 rows are pages of the single TT (Tiny Tracks) material; SN repeats once per sound.
    const code = /^TT\d+$/.test(rawCode) ? 'TT' : rawCode;
    const fullText = col(texts!, row, 'full text');
    const existing = byCode.get(code);
    if (existing && (code === 'TT' || code === 'SN')) {
      continue; // page content is collected separately
    }
    const merged: MaterialRow = {
      code,
      type: code === 'PARTY' ? 'OTHER' : materialTypeForCode(code),
      typeLabel: existing?.typeLabel || col(texts!, row, 'type'),
      title: existing?.title || col(texts!, row, 'title'),
      format: existing?.format || col(texts!, row, 'tune'),
      targetLanguage: col(texts!, row, 'target language') || existing?.targetLanguage || '',
      fullText,
      actions: col(texts!, row, 'actions'),
      teacherNotes: col(texts!, row, 'teacher notes'),
    };
    byCode.set(code, merged);
  }
  return [...byCode.values()];
}

/** Page-style rows from tab 5: Sound Trail rows (one per sound) and Tiny Tracks pages TT1..TTn. */
export function tabFivePages(textRows: Row[]): Map<string, { number: number; text: string }[]> {
  const pages = new Map<string, { number: number; text: string }[]>();
  const texts = tableOf(textRows, 'ID');
  for (const row of texts?.rows ?? []) {
    const rawCode = col(texts!, row, 'id');
    const parts = [col(texts!, row, 'title'), col(texts!, row, 'full text'), col(texts!, row, 'target language')]
      .filter(Boolean)
      .join(' — ');
    if (rawCode === 'SN' || /^TT\d+$/.test(rawCode)) {
      const code = rawCode === 'SN' ? 'SN' : 'TT';
      const list = pages.get(code) ?? [];
      list.push({ number: list.length + 1, text: parts });
      pages.set(code, list);
    }
  }
  return pages;
}

const CLASS_OVERVIEW_MATERIAL_COLUMNS = [
  'song / chant a',
  'song / chant b',
  'little rhyme',
  'ant hill story',
  'read-together book',
  'move & do',
  'talk scene',
];

function parseClassOverview(rows: Row[]): ClassOverviewRow[] {
  const table = tableOf(rows, 'Lesson');
  if (!table) return [];
  return table.rows
    .filter((row) => /^\d+$/.test(col(table, row, 'lesson')))
    .map((row) => ({
      lesson: Number(col(table, row, 'lesson')),
      week: Number(col(table, row, 'week')) || 0,
      phase: col(table, row, 'phase'),
      materialCodes: [
        ...new Set(CLASS_OVERVIEW_MATERIAL_COLUMNS.flatMap((name) => materialCodesIn(col(table, row, name)))),
      ].filter((code) => !code.startsWith('RT')),
      notes: col(table, row, 'notes'),
    }));
}

function parsePrep(rows: Row[]): PrepRow[] {
  const table = tableOf(rows, 'Lesson');
  if (!table) return [];
  return table.rows
    .filter((row) => /^\d+$/.test(col(table, row, 'lesson')))
    .map((row) => ({
      lesson: Number(col(table, row, 'lesson')),
      newToday: splitList(col(table, row, 'new today')).filter(isMaterialCode),
      items: col(table, row, 'materials to prepare')
        .split('\n')
        .map((line) => line.replace(/^[•\-*]\s*/, '').trim())
        .filter(Boolean),
      prepMinutes: parseMinutes(col(table, row, 'prep time')),
      notes: col(table, row, 'teacher notes'),
    }));
}

const PRODUCTION_COLUMNS: [string, ProductionStage][] = [
  ['text', 'TEXT'],
  ['english check', 'ENGLISH_CHECK'],
  ['illustration', 'ILLUSTRATION'],
  ['layout', 'LAYOUT'],
  ['audio', 'AUDIO_VIDEO'],
  ['teacher test', 'TEACHER_TEST'],
  ['print-ready', 'PRINT_READY'],
];

function parseProduction(rows: Row[], issues: ImportIssue[]): { rows: ProductionRow[]; labels: Map<string, string> } {
  const table = tableOf(rows, 'ID');
  const result: ProductionRow[] = [];
  const labels = new Map<string, string>();
  const seen = new Set<string>();
  for (const row of table?.rows ?? []) {
    const code = col(table!, row, 'id');
    if (!code) continue;
    if (seen.has(code)) {
      issues.push({ level: 'warning', where: 'tab 9 Production', message: `Deliverable "${code}" is listed twice; the first row is kept` });
      continue;
    }
    seen.add(code);
    labels.set(code, col(table!, row, 'deliverable'));
    const states: ProductionRow['states'] = {};
    for (const [name, stage] of PRODUCTION_COLUMNS) {
      const raw = col(table!, row, name);
      const state = productionState(raw);
      if (state) states[stage] = state;
      else if (raw) {
        issues.push({ level: 'warning', where: 'tab 9 Production', message: `${code}: unknown status "${raw}" in ${name}` });
      }
    }
    result.push({
      code,
      owner: col(table!, row, 'owner'),
      states,
      dueDate: parseDate(col(table!, row, 'due date')),
      notes: col(table!, row, 'notes'),
    });
  }
  return { rows: result, labels };
}

function parseGates(rows: Row[]): GateRow[] {
  const table = tableOf(rows, 'Gate');
  if (!table) return [];
  const gates: GateRow[] = [];
  let gate = 0;
  let order = 0;
  let signer = '';
  for (const row of table.rows) {
    const gateLabel = col(table, row, 'gate');
    const gateNumber = /Gate (\d+)/.exec(gateLabel)?.[1];
    if (gateNumber) {
      gate = Number(gateNumber);
      order = 0;
      signer = col(table, row, 'who signs');
    }
    const text = col(table, row, 'check');
    if (!gate || !text) continue;
    const doneRaw = col(table, row, 'done').toLowerCase();
    order += 1;
    gates.push({
      gate,
      order,
      text,
      signer: col(table, row, 'who signs') || signer,
      done: ['yes', 'done', 'x', '✓', '✔', 'true'].includes(doneRaw),
      doneAt: parseDate(col(table, row, 'date')),
      notes: col(table, row, 'notes'),
    });
  }
  return gates;
}

export interface ParsedMasterSheet extends MasterSheetData {
  tabFivePages: Map<string, { number: number; text: string }[]>;
  productionLabels: Map<string, string>;
}

export async function parseMasterSheet(file: string, issues: ImportIssue[]): Promise<ParsedMasterSheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const tab = (n: number): Row[] => {
    const sheet = findSheet(workbook, n);
    if (!sheet) {
      issues.push({ level: 'error', where: `tab ${n}`, message: 'Tab is missing' });
      return [];
    }
    return rowsOf(sheet);
  };
  const overview = parseOverview(tab(1), issues);
  const contentRows = tab(5);
  const production = parseProduction(tab(9), issues);
  return {
    overview,
    words: parseWords(tab(2), overview.code),
    links: parseLinks(tab(3)),
    materials: parseMaterials(tab(4), contentRows, issues),
    classOverview: parseClassOverview(tab(6)),
    prep: parsePrep(tab(7)),
    production: production.rows,
    productionLabels: production.labels,
    gates: parseGates(tab(10)),
    tabFivePages: tabFivePages(contentRows),
  };
}
