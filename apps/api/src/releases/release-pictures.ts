import type { PrismaClient } from '@little-ants/db';
import type { ReleaseMedia } from '@little-ants/shared';

/**
 * The picture that stands for each published unit (its cover, else its lead character's art), keyed by unit
 * code, read from the latest release so it is always an approved, public file. Only these two fields are read
 * from the payload.
 */
export async function releasePictures(db: PrismaClient): Promise<Map<string, ReleaseMedia>> {
  const rows = await db.$queryRaw<{ code: string; picture: ReleaseMedia | null }[]>`
    SELECT DISTINCT ON (r."unitId") u.code AS code,
           COALESCE(NULLIF(r.payload->'unit'->'cover', 'null'::jsonb),
                    r.payload->'unit'->'leadCharacter'->'image') AS picture
    FROM "UnitRelease" r JOIN "Unit" u ON u.id = r."unitId"
    ORDER BY r."unitId", r.version DESC`;
  return new Map(rows.flatMap((row) => (row.picture ? [[row.code, row.picture] as const] : [])));
}
