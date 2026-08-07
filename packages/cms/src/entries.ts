// Entry serializer + shared write path.
//
// `serializeEntry` is the canonical wire shape returned by GET/POST/PATCH.
// Both wire-out and audit "after" use the same shape so audit diffs are
// directly readable. The write path (`writeEntry`) creates a revision +
// rebuilds references in the same transaction every save — this is the
// only place autosave / publish / restore should touch a content entry.

import type { ContentEntry, ContentRevision, Prisma, TxClient } from '@sparx/db';
import type { ContentTypeSchema } from '@sparx/cms-schemas';
import { rebuildReferences } from './references.js';

type Json = Prisma.InputJsonValue;

/** A post's byline persona, when the read `include`d the `author` relation. */
export interface WireEntryAuthor {
  display_name: string;
  slug: string;
  bio: string | null;
  /** Media-asset id — the storefront resolves it to a URL, like `featuredImage`. */
  avatar_asset_id: string | null;
}

/** One taxonomy term an entry is filed under (a category or a tag), when the read
 *  `include`d the `terms` relation. `taxonomy_key` is the vocabulary it belongs to
 *  (`blog_category` / `blog_tag` by convention) so a consumer can split the flat list. */
export interface WireEntryTerm {
  taxonomy_key: string;
  name: string;
  slug: string;
}

export interface WireEntry {
  id: string;
  type_key: string;
  slug: string | null;
  status: ContentEntry['status'];
  body: Record<string, unknown>;
  seo: Record<string, unknown>;
  published_at: string | null;
  scheduled_at: string | null;
  archived_at: string | null;
  author_id: string | null;
  locale_code: string | null;
  parent_entry_id: string | null;
  created_at: string;
  updated_at: string;
  // Editorial relations — present ONLY when the read `include`d them (the public
  // storefront reads do; the authoring reads don't). Absent, not null, when not
  // loaded, so an existing consumer that never asked for them is byte-unchanged.
  author?: WireEntryAuthor | null;
  terms?: WireEntryTerm[];
}

/** The shape `serializeEntry` reads its optional editorial relations off — a plain
 *  `ContentEntry` (no relations loaded) is assignable, so every existing caller keeps
 *  working; a public read that `include`s `PUBLIC_ENTRY_BYLINE_INCLUDE` supplies them. */
export type EntryWithByline = ContentEntry & {
  author?: {
    displayName: string;
    slug: string;
    bio: string | null;
    avatarAssetId: string | null;
  } | null;
  terms?: { term: { name: string; slug: string; taxonomy: { key: string } } }[];
};

/** The Prisma `include` a public read passes to load an entry's byline + taxonomy in
 *  one query, shaped to match {@link EntryWithByline}. One const so the three storefront
 *  reads (list / by-slug / by-ids) stay identical and a serialized byline is never a
 *  drift risk between them. */
export const PUBLIC_ENTRY_BYLINE_INCLUDE = {
  author: { select: { displayName: true, slug: true, bio: true, avatarAssetId: true } },
  terms: {
    select: { term: { select: { name: true, slug: true, taxonomy: { select: { key: true } } } } },
  },
} as const;

export function serializeEntry(row: EntryWithByline): WireEntry {
  const wire: WireEntry = {
    id: row.id,
    type_key: row.typeKey,
    slug: row.slug,
    status: row.status,
    body: (row.body ?? {}) as Record<string, unknown>,
    seo: (row.seoJson ?? {}) as Record<string, unknown>,
    published_at: row.publishedAt?.toISOString() ?? null,
    scheduled_at: row.scheduledAt?.toISOString() ?? null,
    archived_at: row.archivedAt?.toISOString() ?? null,
    author_id: row.authorId,
    locale_code: row.localeCode,
    parent_entry_id: row.parentEntryId,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
  // Only emit the editorial fields when the read actually loaded them — `undefined`
  // (not requested) stays absent; a loaded-but-empty author is an explicit null.
  if (row.author !== undefined) {
    wire.author = row.author
      ? {
          display_name: row.author.displayName,
          slug: row.author.slug,
          bio: row.author.bio,
          avatar_asset_id: row.author.avatarAssetId,
        }
      : null;
  }
  if (row.terms !== undefined) {
    wire.terms = row.terms.map((t) => ({
      taxonomy_key: t.term.taxonomy.key,
      name: t.term.name,
      slug: t.term.slug,
    }));
  }
  return wire;
}

export interface WireRevision {
  revision_number: number;
  kind: ContentRevision['kind'];
  status: ContentRevision['status'];
  summary: string | null;
  author_id: string | null;
  created_at: string;
}

export function serializeRevisionMeta(row: ContentRevision): WireRevision {
  return {
    revision_number: row.revisionNumber,
    kind: row.kind,
    status: row.status,
    summary: row.summary,
    author_id: row.authorId,
    created_at: row.createdAt.toISOString(),
  };
}

export interface WireRevisionFull extends WireRevision {
  body: Record<string, unknown>;
  seo: Record<string, unknown>;
}

export function serializeRevisionFull(row: ContentRevision): WireRevisionFull {
  return {
    ...serializeRevisionMeta(row),
    body: (row.body ?? {}) as Record<string, unknown>,
    seo: (row.seoJson ?? {}) as Record<string, unknown>,
  };
}

// Records a new revision row for an entry. Revision numbers are dense and
// monotonic per entry — we compute the next one via a max() lookup inside
// the same transaction, which the (entry_id, revision_number) UNIQUE keeps
// honest under concurrent writes (a colliding INSERT fails with P2002, the
// caller's PATCH retries once).

export async function recordRevision(
  tx: TxClient,
  args: {
    tenantId: string;
    entryId: string;
    body: Record<string, unknown>;
    seoJson: Record<string, unknown>;
    status: string;
    kind: 'autosave' | 'manual';
    authorId: string | null;
    summary?: string;
  }
): Promise<ContentRevision> {
  const last = await tx.contentRevision.findFirst({
    where: { entryId: args.entryId },
    orderBy: { revisionNumber: 'desc' },
    select: { revisionNumber: true },
  });
  const next = (last?.revisionNumber ?? 0) + 1;
  return tx.contentRevision.create({
    data: {
      tenantId: args.tenantId,
      entryId: args.entryId,
      revisionNumber: next,
      kind: args.kind,
      body: args.body as Json,
      seoJson: args.seoJson as Json,
      status: args.status,
      authorId: args.authorId,
      summary: args.summary ?? null,
    },
  });
}

// Helper for the create / update path — rebuild the reference edge list
// against the type's schema so usage tracking + broken-link detection stay
// consistent with whatever the body looks like now.

export async function syncReferences(
  tx: TxClient,
  tenantId: string,
  entryId: string,
  schema: ContentTypeSchema,
  body: Record<string, unknown>
): Promise<void> {
  await rebuildReferences(tx, tenantId, entryId, schema, body);
}
