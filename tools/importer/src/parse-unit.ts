import { checkUnitRules, type LevelRules } from '@little-ants/shared';
import type { UnitFiles } from './discover.js';
import { parseContentTexts } from './docx-content-texts.js';
import { parseLessonPlans } from './docx-lesson-plans.js';
import { materialCodesIn } from './mapping.js';
import { docxToHtml } from './docx.js';
import type { ContentTextEntry, ImportIssue, LessonPlanData } from './types.js';
import { parseMasterSheet, type ParsedMasterSheet } from './xlsx-master-sheet.js';

export interface ParsedUnit {
  files: UnitFiles;
  sheet: ParsedMasterSheet;
  plans: LessonPlanData;
  contentTexts: Map<string, ContentTextEntry>;
  /** Pages per material code, from the content texts file and tab 5. */
  pages: Map<string, { number: number; text: string }[]>;
  issues: ImportIssue[];
}

export async function parseUnit(files: UnitFiles, rulesForLevel: (level: number) => LevelRules): Promise<ParsedUnit> {
  const issues: ImportIssue[] = [];
  const sheet = await parseMasterSheet(files.masterSheet, issues);
  const code = sheet.overview.code || files.folder;

  let plans: LessonPlanData = { lessons: [], parentMessage: '' };
  if (files.lessonPlans) plans = parseLessonPlans(await docxToHtml(files.lessonPlans), issues);
  else issues.push({ level: 'error', where: 'files', message: 'Lesson plans file (UNN_Lesson-Plans_L01-40.docx) not found' });

  let contentTexts = new Map<string, ContentTextEntry>();
  if (files.contentTexts) contentTexts = parseContentTexts(await docxToHtml(files.contentTexts));
  else issues.push({ level: 'warning', where: 'files', message: 'Content texts file (UNN_Content-Texts.docx) not found' });

  // Steps such as "Talk Scene: Ant Hill School" name the material by title, not code.
  const talkScenes = sheet.materials.filter((material) => material.type === 'TALK_SCENE');
  const knownCodes = new Set(sheet.materials.map((material) => material.code));
  for (const lesson of plans.lessons) {
    for (const step of lesson.steps) {
      // e.g. "Book cover talk" whose instructions mention BB1
      if (step.kind === 'OTHER' && !step.materialCode) {
        const mentioned = materialCodesIn(`${step.title}\n${step.teacherText}`).find((code) => knownCodes.has(code));
        if (mentioned) step.materialCode = mentioned;
      }
      if (step.kind !== 'TALK_SCENE' || step.materialCode) continue;
      const title = step.title.replace(/^.*?Talk Scene:\s*/i, '').trim().toLowerCase();
      const match = talkScenes.find((material) => material.title.toLowerCase() === title) ?? talkScenes[0];
      step.materialCode = match?.code ?? null;
    }
  }

  const pages = new Map(sheet.tabFivePages);
  for (const [materialCode, entry] of contentTexts) {
    if (entry.pages.length > 0) pages.set(materialCode, entry.pages);
  }

  // Fill missing full texts from the content texts file (songs, chants, rhymes).
  for (const material of sheet.materials) {
    const entry = contentTexts.get(material.code);
    if (!entry) continue;
    if (!material.fullText && entry.lines.length > 0 && entry.pages.length === 0) material.fullText = entry.lines.join('\n');
    if (!material.actions && entry.actions) material.actions = entry.actions;
    if (entry.title && material.title && entry.title !== material.title) {
      issues.push({
        level: 'info',
        where: material.code,
        message: `Title differs: Master Sheet "${material.title}", content texts "${entry.title}"`,
      });
    }
  }

  // Shared content rules (same checks as the Admin validation panel).
  const findings = checkUnitRules({
    unitCode: code,
    isFirstUnit: sheet.overview.number === 1,
    rules: rulesForLevel(sheet.overview.levelNumber),
    words: sheet.words,
    materials: sheet.materials.map((material) => ({
      code: material.code,
      type: material.type,
      title: material.title,
      fullText: material.fullText,
      pageTexts: (pages.get(material.code) ?? []).map((page) => page.text),
    })),
    lessons: plans.lessons.map((lesson) => ({
      number: lesson.number,
      minutes: lesson.minutes,
      newToday: lesson.newToday,
      steps: lesson.steps,
    })),
  });
  for (const finding of findings) {
    issues.push({ level: finding.severity, where: finding.where, message: finding.message });
  }

  // Import-only check: tab 6 (Class Overview) should match the Word lesson plans.
  const lessonsByNumber = new Map(plans.lessons.map((lesson) => [lesson.number, lesson]));
  for (const row of sheet.classOverview) {
    const lesson = lessonsByNumber.get(row.lesson);
    if (!lesson) continue;
    const inPlan = new Set(
      lesson.steps.map((step) => step.materialCode).filter((value): value is string => !!value && !/^(RT|SN|TT)/.test(value)),
    );
    const inSheet = new Set(row.materialCodes);
    const onlySheet = [...inSheet].filter((value) => !inPlan.has(value));
    const onlyPlan = [...inPlan].filter((value) => !inSheet.has(value));
    if (onlySheet.length > 0 || onlyPlan.length > 0) {
      const parts = [];
      if (onlySheet.length) parts.push(`only in tab 6: ${onlySheet.join(', ')}`);
      if (onlyPlan.length) parts.push(`only in the lesson plan: ${onlyPlan.join(', ')}`);
      issues.push({ level: 'warning', where: `lesson ${row.lesson}`, message: `Tab 6 and the lesson plan differ (${parts.join('; ')})` });
    }
  }

  return { files, sheet, plans, contentTexts, pages, issues };
}
