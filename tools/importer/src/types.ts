import type {
  LessonStage,
  MaterialType,
  ProductionStage,
  ProductionState,
  StepKind,
  WordKind,
} from '@little-ants/db';

export type IssueLevel = 'error' | 'warning' | 'info';

export interface ImportIssue {
  level: IssueLevel;
  where: string;
  message: string;
}

export interface UnitOverview {
  code: string;
  number: number;
  levelNumber: number;
  title: string;
  leadCharacterNote: string;
  circle: string;
  vnLink: string;
  bigQuestion: string;
  value: string;
  party: string;
  levelRulesNote: string;
  canDoGoals: string[];
  keyLanguage: string[];
  sounds: { sound: string; words: string }[];
}

export interface WordRow {
  cardId: string;
  order: number;
  text: string;
  partOfSpeech: string;
  kind: WordKind;
  group: string;
  fromUnit: string;
  pictureBrief: string;
  notes: string;
}

export interface LinkRow {
  what: string;
  fromUnit: string;
  how: string;
  where: string;
}

export interface MaterialRow {
  code: string;
  type: MaterialType;
  typeLabel: string;
  title: string;
  format: string;
  targetLanguage: string;
  fullText: string;
  actions: string;
  teacherNotes: string;
}

export interface ClassOverviewRow {
  lesson: number;
  week: number;
  phase: string;
  /** Material codes named in the row, in column order. */
  materialCodes: string[];
  notes: string;
}

export interface PrepRow {
  lesson: number;
  newToday: string[];
  items: string[];
  prepMinutes: number | null;
  notes: string;
}

export interface ProductionRow {
  code: string;
  owner: string;
  states: Partial<Record<ProductionStage, ProductionState>>;
  dueDate: Date | null;
  notes: string;
}

export interface GateRow {
  gate: number;
  order: number;
  text: string;
  signer: string;
  done: boolean;
  doneAt: Date | null;
  notes: string;
}

export interface MasterSheetData {
  overview: UnitOverview;
  words: WordRow[];
  links: LinkRow[];
  materials: MaterialRow[];
  classOverview: ClassOverviewRow[];
  prep: PrepRow[];
  production: ProductionRow[];
  gates: GateRow[];
}

export interface LessonStepData {
  minutes: number;
  kind: StepKind;
  title: string;
  materialCode: string | null;
  teacherText: string;
  childrenText: string;
}

export interface LessonData {
  number: number;
  week: number;
  stage: LessonStage;
  minutes: number;
  newToday: string[];
  goals: string[];
  keyLanguage: string;
  prepare: string[];
  prepMinutes: number | null;
  steps: LessonStepData[];
  support: string;
  challenge: string;
  lookFor: string;
  homeLink: string;
}

export interface LessonPlanData {
  lessons: LessonData[];
  parentMessage: string;
}

export interface ContentTextEntry {
  code: string;
  title: string;
  format: string;
  pages: { number: number; text: string }[];
  /** Body lines that are not pages or labelled fields (song/rhyme text). */
  lines: string[];
  targetLanguage: string;
  actions: string;
}
