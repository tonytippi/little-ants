import { z } from 'zod';

export const ROLES = ['ADMIN', 'AUTHOR', 'REVIEWER', 'TEACHER'] as const;
export const roleSchema = z.enum(ROLES);
export type RoleName = z.infer<typeof roleSchema>;

const name = z.string().trim().min(1).max(120);
const id = z.string().min(1);

// Each record has a base schema without defaults. Updates use `base.partial()`, so a PATCH that sends
// one field never resets the others (zod fills `.default()` values even inside `.partial()`).

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
  currentUnitId: id.nullable(),
  nextLesson: z.number().int().min(1).max(40),
  schoolYear: z
    .string()
    .trim()
    .regex(/^\d{4}[–-]\d{4}$/, 'Use the form 2026-2027'),
  lessonDays: z.array(z.number().int().min(1).max(7)).max(7),
  active: z.boolean(),
});
export const classInput = classBase.extend({
  currentUnitId: classBase.shape.currentUnitId.default(null),
  nextLesson: classBase.shape.nextLesson.default(1),
  lessonDays: classBase.shape.lessonDays.default([1, 2, 3, 4]),
  active: classBase.shape.active.default(true),
});
export const classUpdate = classBase.partial();

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
export const studentUpdate = studentBase.partial().extend({
  status: z.enum(['ACTIVE', 'LEFT']).optional(),
  classId: id.optional(),
});

export const teacherAssignmentInput = z.object({ userIds: z.array(id).max(50) });

export const staffInviteInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  roles: z.array(roleSchema).min(1),
});

export const staffUpdate = z.object({
  roles: z.array(roleSchema).min(1).optional(),
  active: z.boolean().optional(),
});

export type CampusInput = z.infer<typeof campusInput>;
export type ClassInput = z.infer<typeof classInput>;
export type StudentInput = z.infer<typeof studentInput>;
export type StaffInviteInput = z.infer<typeof staffInviteInput>;
