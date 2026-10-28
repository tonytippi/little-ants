'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { Campus, ClassSummary, LevelOption, SchoolStaff, SchoolStudent } from './types';

/** Query keys of the school pages; ['classes'] and ['class'] prefixes refresh every class list or detail. */
export const orgKeys = {
  campuses: (schoolId: string) => ['campuses', schoolId],
  levels: ['levels'],
  classes: (schoolId: string, status: ClassListStatus) => ['classes', schoolId, status],
  allClasses: ['classes'],
  class: (id: string) => ['class', id],
  allClassDetails: ['class'],
  schoolStaff: (schoolId: string) => ['school-staff', schoolId],
  parents: (studentId: string) => ['student-parents', studentId],
  allStudentParents: ['student-parents'],
  schoolParents: (schoolId: string) => ['school-parents', schoolId],
  allSchoolParents: ['school-parents'],
  schoolStudents: (schoolId: string) => ['school-students', schoolId],
  allSchoolStudents: ['school-students'],
};

/** Every change to a child can touch class lists and details, the school's children and its parents. */
export const CHILD_KEYS = [
  orgKeys.allClassDetails,
  orgKeys.allClasses,
  orgKeys.allSchoolStudents,
  orgKeys.allSchoolParents,
  orgKeys.allStudentParents,
];

export type ClassListStatus = 'ACTIVE' | 'all';

export function useCampuses(schoolId: string) {
  return useQuery({
    queryKey: orgKeys.campuses(schoolId),
    queryFn: () => api.get<Campus[]>(`/schools/${schoolId}/campuses`),
  });
}

export function useLevels() {
  return useQuery({ queryKey: orgKeys.levels, queryFn: () => api.get<LevelOption[]>('/levels') });
}

/** Classes of a school: active ones, or every class including ended ones. */
export function useSchoolClasses(schoolId: string, status: ClassListStatus) {
  return useQuery({
    queryKey: orgKeys.classes(schoolId, status),
    queryFn: () => api.get<ClassSummary[]>(`/schools/${schoolId}/classes?status=${status}`),
  });
}

export function useSchoolStaff(schoolId: string) {
  return useQuery({
    queryKey: orgKeys.schoolStaff(schoolId),
    queryFn: () => api.get<SchoolStaff>(`/schools/${schoolId}/staff`),
  });
}

/** Children the school is responsible for, including those who left (school admins). */
export function useSchoolStudents(schoolId: string) {
  return useQuery({
    queryKey: orgKeys.schoolStudents(schoolId),
    queryFn: () => api.get<SchoolStudent[]>(`/schools/${schoolId}/students`),
  });
}
