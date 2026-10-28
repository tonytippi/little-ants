'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { Campus, ClassSummary, LevelOption, SchoolStaff } from './types';

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
};

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
