import { TEACHER_APP_URL } from '../../../lib/api';

/** "Watch on TV": the classroom TV screen, which shows a code for the teacher's tablet to scan. */
export function GET(): Response {
  return Response.redirect(`${TEACHER_APP_URL}/screen`, 302);
}
