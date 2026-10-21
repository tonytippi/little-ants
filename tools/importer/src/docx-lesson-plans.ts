import type { HTMLElement } from 'node-html-parser';
import { blockText, clean, elementsOf } from './docx.js';
import { classifyStep, isMaterialCode, lessonStage, parseMinutes, splitList } from './mapping.js';
import type { ImportIssue, LessonData, LessonPlanData, LessonStepData } from './types.js';

type Section = 'goals' | 'key' | 'prepare' | 'flow' | 'support' | 'look' | 'home' | 'notes' | 'parents' | null;

const SECTION_HEADINGS: [RegExp, Section][] = [
  [/^BY THE END OF THE LESSON/, 'goals'],
  [/^KEY LANGUAGE$/, 'key'],
  [/^PREPARE$/, 'prepare'],
  [/^LESSON FLOW$/, 'flow'],
  [/^SUPPORT AND CHALLENGE$/, 'support'],
  [/^LOOK FOR/, 'look'],
  [/^HOME LINK$/, 'home'],
  [/^TEACHER NOTES/, 'notes'],
];

function emptyLesson(number: number): LessonData {
  return {
    number,
    week: 0,
    stage: 'HEAR_IT',
    minutes: 0,
    newToday: [],
    goals: [],
    keyLanguage: '',
    prepare: [],
    prepMinutes: null,
    steps: [],
    support: '',
    challenge: '',
    lookFor: '',
    homeLink: '',
  };
}

/** "Week 3 · Join in · 30 minutes · NEW today: BB2" */
function applyHeader(lesson: LessonData, header: string, issues: ImportIssue[]): void {
  const parts = header.split('·').map((part) => part.trim());
  const where = `lesson ${lesson.number}`;
  const week = /^Week (\d+)/.exec(parts[0] ?? '');
  const stage = lessonStage(parts[1] ?? '');
  const minutes = parseMinutes(parts[2] ?? '');
  if (!week || !stage || minutes == null) {
    issues.push({ level: 'error', where, message: `Header not understood: "${header}"` });
  }
  lesson.week = week ? Number(week[1]) : 0;
  lesson.stage = stage ?? 'HEAR_IT';
  lesson.minutes = minutes ?? 0;
  const newToday = parts.find((part) => part.startsWith('NEW today:'));
  lesson.newToday = newToday ? splitList(newToday.replace('NEW today:', '')).filter(isMaterialCode) : [];
}

function parseFlowTable(table: HTMLElement, lesson: LessonData, issues: ImportIssue[]): void {
  for (const row of table.querySelectorAll('tr')) {
    const cells = row.querySelectorAll('th, td');
    const time = clean(cells[0]?.text ?? '');
    if (time.toLowerCase() === 'time') continue;
    if (cells.length < 3) {
      issues.push({ level: 'warning', where: `lesson ${lesson.number}`, message: `Flow row with ${cells.length} cells skipped` });
      continue;
    }
    const lines = (cells[1] as HTMLElement).querySelectorAll('p').map((p) => clean(p.text)).filter(Boolean);
    const title = lines[0] ?? '';
    const minutes = parseMinutes(time);
    if (minutes == null || !title) {
      issues.push({ level: 'warning', where: `lesson ${lesson.number}`, message: `Flow row not understood: "${time} ${title}"` });
      continue;
    }
    const { kind, materialCode } = classifyStep(title);
    const step: LessonStepData = {
      minutes,
      kind,
      title,
      materialCode,
      teacherText: lines.slice(1).join('\n'),
      childrenText: blockText(cells[2] as HTMLElement),
    };
    lesson.steps.push(step);
  }
}

export function parseLessonPlans(root: HTMLElement, issues: ImportIssue[]): LessonPlanData {
  const lessons: LessonData[] = [];
  const parentLines: string[] = [];
  let lesson: LessonData | null = null;
  let section: Section = null;
  let expectHeader = false;

  for (const element of elementsOf(root)) {
    const tag = element.tagName.toLowerCase();
    const text = clean(element.text);

    if (/^h[1-3]$/.test(tag)) {
      const lessonMatch = /^Lesson (\d+)$/.exec(text);
      if (lessonMatch) {
        lesson = emptyLesson(Number(lessonMatch[1]));
        lessons.push(lesson);
        section = null;
        expectHeader = true;
        continue;
      }
      if (/^Message to parents/i.test(text)) {
        lesson = null;
        section = 'parents';
      }
      continue;
    }

    if (section === 'parents') {
      if (text && !/^Translate this message/i.test(text)) parentLines.push(blockText(element));
      continue;
    }
    if (!lesson) continue;

    if (expectHeader && tag === 'p') {
      applyHeader(lesson, text, issues);
      expectHeader = false;
      continue;
    }

    const heading = tag === 'p' ? SECTION_HEADINGS.find(([pattern]) => pattern.test(text)) : undefined;
    if (heading) {
      section = heading[1];
      continue;
    }

    switch (section) {
      case 'goals':
        lesson.goals.push(...blockText(element).split('\n').filter(Boolean));
        break;
      case 'key':
        lesson.keyLanguage = [lesson.keyLanguage, text].filter(Boolean).join('\n');
        break;
      case 'prepare':
        for (const item of blockText(element).split('\n').filter(Boolean)) {
          const prep = /^Prep time: about (\d+) minutes/i.exec(item);
          if (prep) lesson.prepMinutes = Number(prep[1]);
          else lesson.prepare.push(item);
        }
        break;
      case 'flow':
        if (tag === 'table') parseFlowTable(element, lesson, issues);
        break;
      case 'support':
        for (const line of blockText(element).split('\n')) {
          if (/^Support:/i.test(line)) lesson.support = line.replace(/^Support:\s*/i, '');
          else if (/^Challenge:/i.test(line)) lesson.challenge = line.replace(/^Challenge:\s*/i, '');
          else if (line) lesson.support = [lesson.support, line].filter(Boolean).join('\n');
        }
        break;
      case 'look':
        lesson.lookFor = [lesson.lookFor, text].filter(Boolean).join('\n');
        break;
      case 'home':
        lesson.homeLink = [lesson.homeLink, text].filter(Boolean).join('\n');
        break;
      default:
        break;
    }
  }

  return { lessons, parentMessage: parentLines.join('\n') };
}
