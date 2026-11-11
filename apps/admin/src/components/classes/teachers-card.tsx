import { Card } from '@little-ants/ui/feedback';
import type { ClassDetail } from '../../lib/types';

/** Who teaches the class; changed with the Teachers button in the page header. */
export function TeachersCard({ klass }: { klass: ClassDetail }) {
  return (
    <Card>
      <h2 className="mb-3 font-bold">Teachers</h2>
      {klass.teachers.length ? (
        <ul className="flex flex-col gap-1 text-sm">
          {klass.teachers.map(({ user }) => (
            <li key={user.id}>
              <span className="font-semibold">{user.name}</span>{' '}
              <span className="text-xs text-bark-500">{user.email}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-bark-500">No teachers yet.</p>
      )}
    </Card>
  );
}
