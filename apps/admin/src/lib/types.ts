/** Response shapes of the Little Ants API used by Admin. */

export type ContentStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'ARCHIVED';
/** Little Ants HQ roles. Teaching is a role at a school. */
export type Role = 'ADMIN' | 'AUTHOR' | 'REVIEWER';
export type SchoolRole = 'SCHOOL_ADMIN' | 'TEACHER';
export type ClassStatus = 'ACTIVE' | 'MERGED' | 'STOPPED';
export type EnrollmentEnd = 'LEFT' | 'MOVED' | 'MERGED' | 'CLASS_STOPPED';

export interface UnitSummary {
  id: string;
  code: string;
  number: number;
  title: string;
  status: ContentStatus;
  version: number;
  level: { number: number; name: string };
  leadCharacter: string;
  counts: { words: number; materials: number; lessons: number };
  contentStatus: Partial<Record<ContentStatus, number>>;
  production: { done: number; total: number };
  latestRelease: { version: number; publishedAt: string } | null;
}

export interface Word {
  id: string;
  cardId: string;
  order: number;
  text: string;
  partOfSpeech: string;
  kind: 'CORE' | 'EXTRA' | 'REVIEW';
  group: string;
  fromUnit: string;
  pictureBrief: string;
  notes: string;
  imageAssetId: string | null;
  status: ContentStatus;
  version: number;
}

export interface ProductionRow {
  id: string;
  materialId: string;
  stage: string;
  state: string;
  owner: string;
  dueDate: string | null;
  notes: string;
}

export interface MaterialSummary {
  id: string;
  code: string;
  type: string;
  title: string;
  format: string;
  targetLanguage: string;
  status: ContentStatus;
  version: number;
  firstLesson: number | null;
  _count: { pages: number; assets: number };
  production: ProductionRow[];
}

export interface LessonSummary {
  id: string;
  number: number;
  week: number;
  stage: string;
  minutes: number;
  newToday: string[];
  status: ContentStatus;
  version: number;
}

export interface UnitDetail {
  id: string;
  code: string;
  number: number;
  title: string;
  status: ContentStatus;
  version: number;
  leadCharacterId: string | null;
  leadCharacterNote: string;
  circle: string;
  vnLink: string;
  bigQuestion: string;
  value: string;
  party: string;
  sounds: string;
  keyLanguage: string[];
  parentMessage: string;
  levelRulesNote: string;
  links: { what: string; fromUnit: string; how: string; where: string }[];
  level: { id: string; number: number; name: string; ageBand: string; lessonMinutes: string };
  leadCharacter: { id: string; name: string; artAssetId: string | null } | null;
  words: Word[];
  materials: MaterialSummary[];
  lessons: LessonSummary[];
  canDoGoals: { id: string; order: number; text: string }[];
  pictures: UnitPicture[];
  gateChecks: {
    id: string;
    gate: number;
    order: number;
    text: string;
    signer: string;
    done: boolean;
    doneAt: string | null;
    notes: string;
  }[];
  releases: {
    id: string;
    version: number;
    note: string;
    publishedAt: string;
    publishedBy: { name: string } | null;
  }[];
}

export interface Asset {
  id: string;
  kind: 'IMAGE' | 'AUDIO' | 'VIDEO' | 'PDF';
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: ContentStatus;
  version: number;
  previousId: string | null;
  createdAt: string;
  url: string;
  uploadedBy?: { name: string } | null;
}

export interface AssetListItem extends Asset {
  materialAssets: { role: string; material: { id: string; code: string; unit: { code: string } } }[];
}

export interface AssetDetail extends Asset {
  olderVersions: { id: string; version: number; status: ContentStatus; createdAt: string }[];
}

export interface MaterialPage {
  id: string;
  number: number;
  text: string;
  imageAssetId: string | null;
  audioAssetId: string | null;
  /** Page and material links come without a view URL. */
  imageAsset: LinkedAsset | null;
  audioAsset: LinkedAsset | null;
}

export type LinkedAsset = Omit<Asset, 'url'> & { url?: string };

export interface MaterialDetail {
  id: string;
  code: string;
  type: string;
  title: string;
  format: string;
  targetLanguage: string;
  fullText: string;
  actions: string;
  teacherNotes: string;
  firstLesson: number | null;
  status: ContentStatus;
  version: number;
  unit: { id: string; code: string; title: string };
  pages: MaterialPage[];
  assets: { id: string; role: string; order: number; assetId: string; asset: LinkedAsset }[];
  production: ProductionRow[];
  usedInLessons: { id: string; number: number }[];
}

export interface LessonStep {
  id: string;
  order: number;
  minutes: number;
  kind: string;
  title: string;
  materialId: string | null;
  teacherText: string;
  childrenText: string;
  material: { id: string; code: string; title: string; type: string } | null;
}

export interface LessonDetail {
  id: string;
  unitId: string;
  number: number;
  week: number;
  stage: string;
  minutes: number;
  newToday: string[];
  goals: string[];
  keyLanguage: string;
  support: string;
  challenge: string;
  lookFor: string;
  homeLink: string;
  prepMinutes: number | null;
  notes: string;
  status: ContentStatus;
  version: number;
  unit: { id: string; code: string; title: string; level: { number: number; name: string } };
  steps: LessonStep[];
  prepItems: {
    id: string;
    order: number;
    text: string;
    materialId: string | null;
    material: { id: string; code: string } | null;
  }[];
  previousId: string | null;
  nextId: string | null;
}

export interface Revision {
  id: string;
  entityType: string;
  entityId: string;
  version: number;
  snapshot: Record<string, unknown>;
  note: string;
  createdAt: string;
  author: { name: string } | null;
}

export interface RuleFinding {
  severity: 'error' | 'warning' | 'info';
  rule: string;
  where: string;
  message: string;
}

export interface Campus {
  id: string;
  name: string;
  address: string;
  active: boolean;
}

export interface LevelOption {
  id: string;
  number: number;
  name: string;
  ageBand: string;
  units: { id: string; code: string; title: string }[];
}

export interface School {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  /** The signed-in person's role here; HQ admins act as school admins everywhere. */
  myRole: SchoolRole | null;
  _count: { campuses: number; staff: number };
}

export interface SchoolStaffMember {
  role: SchoolRole;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    active: boolean;
    /** Active classes of this school the person teaches. */
    assignments: { class: { id: string; name: string } }[];
  };
}

export interface SchoolInvite {
  id: string;
  email: string;
  schoolRole: SchoolRole | null;
  createdAt: string;
}

export interface SchoolStaff {
  members: SchoolStaffMember[];
  invites: SchoolInvite[];
}

interface ClassBase {
  id: string;
  name: string;
  schoolYear: string;
  status: ClassStatus;
  endedAt: string | null;
  mergedIntoId: string | null;
  nextLesson: number;
  lessonDays: number[];
  campusId: string;
  levelId: string;
  currentUnitId: string | null;
  level: { id: string; number: number; name: string };
  currentUnit: { id: string; code: string; title: string } | null;
  teachers: { user: { id: string; name: string; email: string } }[];
}

export interface ClassSummary extends ClassBase {
  campus: { id: string; name: string };
  /** Open enrollments: children in the class now. */
  _count: { enrollments: number };
}

/** A child. Children are not tied to one class; their classes over time are enrollments. */
export interface Student {
  id: string;
  displayName: string;
  birthYear: number | null;
  consentAt: string | null;
}

export interface Enrollment {
  id: string;
  /** Date columns: midnight UTC of the day. */
  startedOn: string;
  endedOn: string | null;
  endReason: EnrollmentEnd | null;
  student: Student;
}

export interface ClassUnitRun {
  id: string;
  startedOn: string;
  endedOn: string | null;
  unit: { code: string; title: string };
}

export interface ClassDetail extends ClassBase {
  campus: { id: string; name: string; school: { id: string; name: string } };
  mergedInto: { id: string; name: string } | null;
  /** Newest first. */
  unitRuns: ClassUnitRun[];
  /** Open enrollments first. */
  enrollments: Enrollment[];
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  image: string | null;
  roles: Role[];
  active: boolean;
  createdAt: string;
  assignments: { class: { id: string; name: string } }[];
}

export interface StaffInvite {
  id: string;
  email: string;
  roles: Role[];
  /** Set when a school invited the person. */
  schoolId: string | null;
  schoolRole: SchoolRole | null;
  createdAt: string;
}

export interface ReleaseCheck {
  blockers: string[];
  warnings: string[];
}

export interface TeacherNote {
  id: string;
  lessonNumber: number;
  taughtAt: string;
  notes: string;
  teacher: { name: string };
  class: { name: string };
}

export type ImportRunStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface ImportRun {
  id: string;
  status: ImportRunStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  message: string;
  archive: string | null;
  requestedBy: { id: string; name: string } | null;
  report?: string | null;
}

export interface UnitPicture {
  id: string;
  role: 'cover' | 'place';
  label: string;
  order: number;
  assetId: string;
  asset: Omit<Asset, 'url'> & { url?: string };
}

/** A parent email linked to a child; parents sign in to the Listening Time app with it. */
export interface StudentParent {
  relationship: string;
  parent: { id: string; email: string; name: string; lastSignInAt: string | null };
}
