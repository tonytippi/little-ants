/** URLs of the app's screens. Every screen is a static route so it opens offline once cached. */

interface LessonRef {
  unit: string;
  lesson: number;
  classId?: string | null;
}

function query(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value !== null && value !== undefined && value !== '') search.set(key, String(value));
  return search.toString();
}

export const links = {
  home: () => '/',
  unit: (unit: string, classId?: string | null) => `/unit?${query({ unit, class: classId })}`,
  teach: ({ unit, lesson, classId }: LessonRef) => `/teach?${query({ unit, lesson, class: classId })}`,
  prepare: ({ unit, lesson, classId }: LessonRef) => `/prepare?${query({ unit, lesson, class: classId })}`,
  observe: (classId: string, unit: string, lesson?: number) =>
    `/observe?${query({ class: classId, unit, lesson })}`,
  print: ({ unit, lesson }: LessonRef) => `/print?${query({ unit, lesson })}`,
  preview: (unit: string, lesson?: number) => `/preview?${query({ unit, lesson })}`,
  present: (unit: string, lesson: number, session: string, preview: boolean) =>
    `/present?${query({ unit, lesson, session, preview: preview ? 1 : null })}`,
};
