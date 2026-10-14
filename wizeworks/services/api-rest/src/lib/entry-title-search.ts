// Finding content by its title, whatever the capitals.
//
// The list route searched `body.title` with Prisma's JSON `string_contains`, which
// has no case-insensitive mode, so "a correction" found nothing when the piece was
// called "A correction to ..." (persona P09). Titles live in the body JSON, so the
// match is one ILIKE over `body->>'title'` and `body->>'name'` (authors and other
// kinds are named, not titled), with the user's own `%` and `_` taken literally.

import { Prisma } from '@prisma/client';
import type { TxClient } from '@wizeworks/db';

/** `%text%` for ILIKE, with the LIKE wildcards in `text` escaped. */
export function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Ids of live entries whose title or name contains `text`, ignoring case. */
export async function entryIdsByTitle(tx: TxClient, text: string): Promise<string[]> {
  const pattern = containsPattern(text);
  const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT id FROM content_entries
    WHERE deleted_at IS NULL
      AND (body->>'title' ILIKE ${pattern} OR body->>'name' ILIKE ${pattern})
  `);
  return rows.map((row) => row.id);
}
