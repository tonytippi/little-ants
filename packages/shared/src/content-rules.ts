/**
 * Machine-checkable parts of the Content Writing Rules and Program Plan.
 * Used by the importer report and the Admin validation panel, so both flag the same problems.
 */

export interface LevelRules {
  /** Inclusive range of core words per unit. */
  coreWordsPerUnit?: [number, number];
  /** Inclusive range of story pages. */
  storyPages?: [number, number];
  /** Maximum words on one story page. */
  maxWordsPerPage?: number;
}

export interface RuleWord {
  cardId: string;
  kind: 'CORE' | 'EXTRA' | 'REVIEW';
  pictureBrief: string;
}

export interface RuleMaterial {
  code: string;
  type: string;
  title: string;
  fullText: string;
  pageTexts: string[];
}

export interface RuleStep {
  title: string;
  minutes: number;
  materialCode: string | null;
}

export interface RuleLesson {
  number: number;
  minutes: number;
  newToday: string[];
  steps: RuleStep[];
}

export interface RuleInput {
  unitCode: string;
  /** The very first unit of the program has no earlier units to review. */
  isFirstUnit: boolean;
  rules: LevelRules;
  words: RuleWord[];
  materials: RuleMaterial[];
  lessons: RuleLesson[];
  expectedLessons?: number;
}

export type RuleSeverity = 'error' | 'warning' | 'info';

export interface RuleFinding {
  severity: RuleSeverity;
  rule: string;
  where: string;
  message: string;
}

/** Materials that are not stored as a single text (cards, pages, packs) and need no full text. */
const TEXTLESS_TYPES = new Set(['SOUND_TRAIL', 'TINY_TRACKS', 'HOME_HILL', 'TALK_SCENE', 'OTHER']);

function wordCount(text: string): number {
  return text.split(/\s+/).filter((part) => /[A-Za-z]/.test(part)).length;
}

/** "Sound Trail: m /m/ + m /m/" → ["m /m/"] (the repeated sound). */
export function repeatedSounds(stepTitle: string): string[] {
  const match = /^Sound Trail:\s*(.+)$/i.exec(stepTitle.trim());
  if (!match) return [];
  const sounds = match[1]!.split('+').map((part) => part.trim().replaceAll(/\s+/g, ' '));
  return [...new Set(sounds.filter((sound, index) => sounds.indexOf(sound) !== index))];
}

export function checkUnitRules(input: RuleInput): RuleFinding[] {
  const findings: RuleFinding[] = [];
  const add = (severity: RuleSeverity, rule: string, where: string, message: string): void => {
    findings.push({ severity, rule, where, message });
  };
  const materialCodes = new Set(input.materials.map((material) => material.code));

  // Words
  const core = input.words.filter((word) => word.kind === 'CORE');
  const range = input.rules.coreWordsPerUnit;
  if (range && (core.length < range[0] || core.length > range[1])) {
    add(
      'warning',
      'core-word-count',
      'words',
      `${core.length} core words; the level rule is ${range[0]}–${range[1]}`,
    );
  }
  if (!input.isFirstUnit) {
    const review = input.words.filter((word) => word.kind === 'REVIEW').length;
    const taught = core.length + review;
    const share = taught === 0 ? 0 : review / taught;
    if (share < 0.25) {
      add(
        'warning',
        'review-share',
        'words',
        `Review words are ${Math.round(share * 100)}% of taught words; the target is 25% or more`,
      );
    }
  }
  const noBrief = core.filter((word) => !word.pictureBrief.trim());
  if (noBrief.length > 0) {
    add('info', 'picture-brief', 'words', `${noBrief.length} core words have no picture brief`);
  }

  // Materials
  for (const material of input.materials) {
    if (!TEXTLESS_TYPES.has(material.type) && !material.fullText.trim() && material.pageTexts.length === 0) {
      add('warning', 'material-text', material.code, `"${material.title}" has no text`);
    }
    if (material.type === 'STORY') {
      const pages = input.rules.storyPages;
      if (
        pages &&
        material.pageTexts.length > 0 &&
        (material.pageTexts.length < pages[0] || material.pageTexts.length > pages[1])
      ) {
        add(
          'warning',
          'story-pages',
          material.code,
          `${material.pageTexts.length} pages; the level rule is ${pages[0]}–${pages[1]}`,
        );
      }
      const max = input.rules.maxWordsPerPage;
      if (max) {
        material.pageTexts.forEach((text, index) => {
          const count = wordCount(text);
          if (count > max)
            add(
              'warning',
              'words-per-page',
              material.code,
              `Page ${index + 1} has ${count} words; the limit is ${max}`,
            );
        });
      }
    }
  }

  // Lessons
  const expected = input.expectedLessons ?? 40;
  if (input.lessons.length !== expected) {
    add('error', 'lesson-count', 'lessons', `${input.lessons.length} lessons; expected ${expected}`);
  }
  const numbers = input.lessons.map((lesson) => lesson.number);
  for (let n = 1; n <= expected; n += 1) {
    if (!numbers.includes(n)) add('error', 'lesson-missing', `lesson ${n}`, 'Lesson is missing');
  }
  for (const lesson of input.lessons) {
    const where = `lesson ${lesson.number}`;
    if (lesson.steps.length === 0) add('error', 'lesson-steps', where, 'Lesson has no flow steps');
    for (const step of lesson.steps) {
      for (const sound of repeatedSounds(step.title)) {
        add('warning', 'repeated-sound', where, `Sound Trail lists ${sound} twice ("${step.title}")`);
      }
      if (step.materialCode && !materialCodes.has(step.materialCode)) {
        add(
          'warning',
          'missing-material',
          where,
          `Step "${step.title}" uses ${step.materialCode}, which is not in the unit materials`,
        );
      }
    }
    for (const code of lesson.newToday) {
      if (!materialCodes.has(code))
        add(
          'warning',
          'missing-material',
          where,
          `NEW today lists ${code}, which is not in the unit materials`,
        );
    }
    const total = lesson.steps.reduce((sum, step) => sum + step.minutes, 0);
    if (lesson.minutes > 0 && total > 0 && (total > lesson.minutes + 2 || total < lesson.minutes - 5)) {
      add(
        'info',
        'lesson-time',
        where,
        `Steps add up to ${total} minutes; the lesson is ${lesson.minutes} minutes`,
      );
    }
  }
  return findings;
}
