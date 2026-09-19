// Keeping a content entry findable, whichever of the two kinds it is.
//
// One table, `content_entries`, is projected into the search index by TWO
// projectors that split on a single column:
//
//   cms_page   ← typeKey = 'page'   (a tenant's policy + standalone pages)
//   cms_entry  ← every other typeKey (posts, recipes, whatever the type says)
//
// The split is what stops the same row being indexed twice, and it is invisible
// from the route: a PATCH, a publish and a delete all arrive holding an id and
// nothing else. Reading the row back just to pick a name would be a database
// round-trip to answer a question neither projector needs asked, because each
// one ALREADY refuses a row that is not its kind — it returns null, and the
// indexer treats a null projection as "remove this", not as an error.
//
// So both are signalled, always. The wrong one is a no-op removal of a document
// that was never written, and the pair is self-correcting in the one case that
// would otherwise rot: an entry whose typeKey CHANGES moves from one index name
// to the other in the same breath, with no orphan left behind.
//
// Why this is a module rather than two lines at each call site: six handlers
// across three files write these rows (create, update, delete, publish,
// unpublish, restore), and the reason for signalling twice is not something the
// next person should have to re-derive from a pair of literals.
// [[feedback_a_fix_leaves_its_neighbour_behind]]

import { indexEntity } from '@wizeworks/events';

export interface ContentSearchActor {
  tenantId: string;
  actorId?: string | null;
}

/**
 * Tell the search index that a content entry changed.
 *
 * Call it AFTER the transaction commits. It never throws into the caller —
 * `indexEntity` detaches the publish — so a search index that is slow or
 * unreachable can never fail somebody's save.
 *
 * @param op 'upsert' re-projects the row; 'delete' removes both documents.
 */
export async function indexContentEntry(
  auth: ContentSearchActor,
  entryId: string,
  op: 'upsert' | 'delete' = 'upsert'
): Promise<void> {
  // Written out rather than looped over a pair. `check:search-entities` reads
  // these literals to prove every projector has a live signal, and a name it
  // cannot see is a name it reports as missing — which is the good failure. The
  // bad one is a name it counts from somewhere that is not a signal at all, and
  // that is exactly how `cms_page` sat unindexed while the check printed a tick.
  await indexEntity({
    tenantId: auth.tenantId,
    actorId: auth.actorId ?? null,
    entityType: 'cms_entry',
    recordId: entryId,
    op,
  });
  await indexEntity({
    tenantId: auth.tenantId,
    actorId: auth.actorId ?? null,
    entityType: 'cms_page',
    recordId: entryId,
    op,
  });
}
