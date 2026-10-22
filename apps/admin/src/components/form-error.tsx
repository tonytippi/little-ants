import { ApiError } from '@little-ants/ui/lib/api-client';

/** Error box for a failed save, listing field issues and release blockers when the API sends them. */
export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : 'Something went wrong';
  const issues = error instanceof ApiError ? (error.body.issues ?? []) : [];
  const blockers =
    error instanceof ApiError && Array.isArray(error.body.blockers) ? (error.body.blockers as string[]) : [];
  return (
    <div role="alert" className="rounded-xl border border-ant-100 bg-ant-50 px-4 py-3 text-sm text-ant-700">
      <p className="font-semibold">{message}</p>
      {issues.length || blockers.length ? (
        <ul className="mt-1 list-disc pl-5">
          {issues.map((issue) => (
            <li key={issue.path}>
              {issue.path ? <strong>{issue.path}: </strong> : null}
              {issue.message}
            </li>
          ))}
          {blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
