// What on her site links to one piece.
//
// Deleting or taking down a piece breaks every link to it, and the question before
// either said nothing about that: she deleted a correction note that her mill piece
// linked to, and the mill piece went on sending readers to a page that was not there
// (persona P09). Links live as `href` text inside each piece's body JSON and inside
// the site's page and layout trees, and a reference field (an author, a related piece)
// is a row in `content_references`, so all three are read here.

import { Prisma } from '@prisma/client';
import type { TxClient } from '@wizeworks/db';

export interface LinkingThing {
  kind: 'entry' | 'page' | 'layout';
  id: string;
  title: string;
  /** Whether readers can follow the link today. */
  live: boolean;
}

/**
 * ILIKE patterns that find a link to `path` in stored JSON: the path written alone or
 * after a host, ending at the closing quote, a slash, a `#` or a `?`. `/articles/a`
 * never matches `/articles/a-b`.
 */
export function linkPatterns(path: string): string[] {
  const safe = path.replace(/[\\%_]/g, (c) => `\\${c}`);
  return ['"', '/"', '#', '?'].map((end) => `%${safe}${end}%`);
}

export async function linkingThings(
  tx: TxClient,
  entryId: string,
  path: string | null
): Promise<LinkingThing[]> {
  const patterns = path ? linkPatterns(path) : [];
  const rows = await tx.$queryRaw<LinkingThing[]>(Prisma.sql`
    SELECT 'entry' AS kind, e.id::text AS id,
           COALESCE(NULLIF(e.body->>'title', ''), NULLIF(e.body->>'name', ''), e.slug, 'Untitled') AS title,
           e.status = 'published' AS live
    FROM content_entries e
    WHERE e.deleted_at IS NULL AND e.id <> ${entryId}::uuid
      AND (
        e.body::text ILIKE ANY (${patterns}::text[])
        OR EXISTS (
          SELECT 1 FROM content_references r
          WHERE r.from_entry_id = e.id AND r.to_entry_id = ${entryId}::uuid
        )
      )
    UNION ALL
    SELECT 'page', p.id::text, p.name, p.silica_published_tree::text ILIKE ANY (${patterns}::text[])
    FROM builder_pages p
    WHERE p.silica_published_tree::text ILIKE ANY (${patterns}::text[])
       OR p.silica_draft_tree::text ILIKE ANY (${patterns}::text[])
    UNION ALL
    SELECT 'layout', l.id::text, l.name,
           l.is_active AND l.silica_published_tree::text ILIKE ANY (${patterns}::text[])
    FROM builder_layouts l
    WHERE l.silica_published_tree::text ILIKE ANY (${patterns}::text[])
       OR l.silica_draft_tree::text ILIKE ANY (${patterns}::text[])
    LIMIT 50
  `);
  return rows.map((row) => ({ ...row, live: Boolean(row.live) }));
}
