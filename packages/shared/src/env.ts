import { z } from 'zod';

/**
 * Validate environment variables against a zod schema.
 * Throws one error that lists every invalid variable by name (never by value).
 */
export function parseEnv<T extends z.ZodType>(schema: T, source: Record<string, string | undefined>): z.infer<T> {
  // `NAME=` in a dotenv file means "not set", so optional settings fall back to their defaults.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined && value.trim() !== ''));
  const result = schema.safeParse(cleaned);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment:\n  ${problems.join('\n  ')}`);
  }
  return result.data;
}
