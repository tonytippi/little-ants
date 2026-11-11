'use client';

import { Select } from '@little-ants/ui/field';
import { useCurrentSchool } from '../lib/school';

/** The school filter of a school page's toolbar; left out for people who run only one school. */
export function SchoolSelect() {
  const { schools, school, setSchoolId } = useCurrentSchool();
  if (!school || schools.length < 2) return null;
  return (
    <Select aria-label="School" value={school.id} onChange={(event) => setSchoolId(event.target.value)}>
      {schools.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
          {item.active ? '' : ' (inactive)'}
        </option>
      ))}
    </Select>
  );
}
