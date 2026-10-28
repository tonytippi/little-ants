import { z } from 'zod';

/** Little Ants HQ roles. Teaching is a school role. */
export const ROLES = ['ADMIN', 'AUTHOR', 'REVIEWER'] as const;
export const roleSchema = z.enum(ROLES);
export type RoleName = z.infer<typeof roleSchema>;

export const SCHOOL_ROLES = ['SCHOOL_ADMIN', 'TEACHER'] as const;
export const schoolRoleSchema = z.enum(SCHOOL_ROLES);
export type SchoolRoleName = z.infer<typeof schoolRoleSchema>;

const name = z.string().trim().min(1).max(120);
const id = z.string().min(1);

// Each record has a base schema without defaults. Updates use `base.partial()`, so a PATCH that sends
// one field never resets the others (zod fills `.default()` values even inside `.partial()`).

const email = z.string().trim().toLowerCase().email();

const schoolBase = z.object({ name, active: z.boolean() });
export const schoolInput = schoolBase.extend({ active: schoolBase.shape.active.default(true) });
export const schoolUpdate = schoolBase.partial();

/** Add someone to a school: an existing account becomes a member, a new email gets an invite. */
export const schoolStaffInput = z.object({ email, role: schoolRoleSchema });
export const schoolStaffUpdate = z.object({ role: schoolRoleSchema });

const campusBase = z.object({
  name,
  address: z.string().trim().max(300),
  active: z.boolean(),
});
export const campusInput = campusBase.extend({
  address: campusBase.shape.address.default(''),
  active: campusBase.shape.active.default(true),
});
export const campusUpdate = campusBase.partial();

/** School year a date falls in, e.g. "2026-2027"; the school year starts in August. */
export function schoolYearOf(date = new Date()): string {
  const start = date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

const classBase = z.object({
  campusId: id,
  name,
  levelId: id,
  // The unit the class starts with (its first unit run). Later units: "start next unit".
  unitId: id.nullable(),
  nextLesson: z.number().int().min(1).max(40),
  schoolYear: z
    .string()
    .trim()
    .regex(/^\d{4}[–-]\d{4}$/, 'Use the form 2026-2027'),
  lessonDays: z.array(z.number().int().min(1).max(7)).max(7),
});
export const classInput = classBase.extend({
  unitId: classBase.shape.unitId.default(null),
  nextLesson: classBase.shape.nextLesson.default(1),
  lessonDays: classBase.shape.lessonDays.default([1, 2, 3, 4]),
});
/** Unit changes go through "start next unit", merges and stops through their own actions. */
export const classUpdate = classBase.omit({ campusId: true, levelId: true, unitId: true }).partial();

export const nextUnitInput = z.object({ unitId: id });
export const mergeClassInput = z.object({ targetClassId: id });

const currentYear = new Date().getFullYear();
const studentBase = z.object({
  displayName: name,
  birthYear: z
    .number()
    .int()
    .min(currentYear - 8)
    .max(currentYear)
    .nullable(),
  consentAt: z.coerce.date().nullable(),
});
export const studentInput = studentBase.extend({
  birthYear: studentBase.shape.birthYear.default(null),
  consentAt: studentBase.shape.consentAt.default(null),
});
export const studentUpdate = studentBase.partial();
export const moveStudentInput = z.object({ classId: id });

export const teacherAssignmentInput = z.object({ userIds: z.array(id).max(50) });

export const staffInviteInput = z.object({
  email,
  roles: z.array(roleSchema).min(1),
});

export const staffUpdate = z.object({
  roles: z.array(roleSchema).min(1).optional(),
  active: z.boolean().optional(),
});

export type SchoolInput = z.infer<typeof schoolInput>;
export type CampusInput = z.infer<typeof campusInput>;
export type ClassInput = z.infer<typeof classInput>;
export type StudentInput = z.infer<typeof studentInput>;
export type StaffInviteInput = z.infer<typeof staffInviteInput>;

/** A parent who may sign in to the student app for this child (by the Google account's email). */
export const parentLinkInput = z.object({
  email,
  relationship: z.string().trim().max(40).default(''),
});

/** At the two-device limit: which signed-in device to sign out for the new one. */
export const replaceDeviceInput = z.object({ signOutSessionId: id });
