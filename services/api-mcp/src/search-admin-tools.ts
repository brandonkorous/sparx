// Search maintenance MCP tool (docs/22 §7).
//
//   rebuild_search_index — write:search, confirmation:true
//
// Every other search tool is a READ (`@sparx/search`'s `searchMcpTools`). This one
// writes, so it lives here rather than in `@sparx/search`: publishing needs
// `@sparx/events` → `@google-cloud/pubsub`, and `@sparx/search` is imported by the
// Next apps for the ⌘K palette — dragging a Pub/Sub client into that dependency
// graph to serve one server-only tool is the wrong trade. Same reasoning (and the
// same module-level-publisher shape) as `domain-tools.ts`.
//
// The index is DERIVED state: the commerce-indexer reprojects each entity as
// `product.*` / `order.*` / `crm.customer.*` events land, so a healthy tenant never
// needs this. It exists for the three cases where the derived copy and Postgres have
// actually diverged — first population of a catalog that predates the index, a
// collection-schema bump, and recovery after the indexer was down or misconfigured.
// Without it the only remedy was the platform-operator endpoint, which a tenant (or
// their agent) cannot reach: "my products are in the dashboard but the live site
// search finds nothing" was unfixable from inside the tenant.

import { z } from 'zod';
import crypto from 'node:crypto';
import { createPublisher, publishEvent, type PublisherLogger } from '@sparx/events';

const pubLogger: PublisherLogger = {
  info: (obj, msg) => console.info(msg ?? '', obj),
  warn: (obj, msg) => console.warn(msg ?? '', obj),
  error: (obj, msg) => console.error(msg ?? '', obj),
};
const publisher = createPublisher({ logger: pubLogger });

interface Ctx {
  tenantId: string;
  userId: string;
}

/** Mirrors the worker's `ReindexTarget` (services/commerce-indexer/src/reindex.ts).
 *  `entities` is the universal collection behind cross-type search; the other three
 *  are the rich per-type collections. Omitting the field rebuilds all four. */
const RebuildSearchIndexInput = z.object({
  collections: z
    .array(z.enum(['products', 'customers', 'orders', 'entities']))
    .min(1)
    .max(4)
    .optional(),
  /** Delete this tenant's existing documents before reloading. Use it when the
   *  index holds records that no longer exist in the database (a restore, a bad
   *  import); leave it off otherwise, because it opens a brief window where the
   *  collection is empty and the live site finds nothing. */
  dropStale: z.boolean().default(false),
});

const rebuildSearchIndexTool = {
  name: 'rebuild_search_index',
  description:
    "Rebuild this tenant's search index from the database. Fixes a search index that has drifted out of sync — products that exist in the catalog but return no results in site search, the site's search page, or search_products. Rebuilds products, customers, orders, and the cross-type index unless you narrow it with `collections`. Runs in the background: the call returns immediately with a runId and a large catalog can take a few minutes to finish. Safe to run more than once. Only set `dropStale` when the index contains records that are gone from the database — it empties the index first, so search returns nothing until the rebuild completes.",
  scope: 'write:search' as const,
  confirmation: true,
  input: RebuildSearchIndexInput,
  run: async (ctx: Ctx, raw: unknown) => {
    const input = RebuildSearchIndexInput.parse(raw);
    const runId = `reindex_${crypto.randomUUID().replace(/-/g, '')}`;
    await publishEvent(
      publisher,
      'search.reindex.requested',
      ctx.tenantId,
      ctx.userId,
      {
        runId,
        collections: input.collections,
        dropStale: input.dropStale,
      },
      pubLogger
    );
    return {
      runId,
      accepted: true,
      collections: input.collections ?? ['products', 'customers', 'orders', 'entities'],
      dropStale: input.dropStale,
      note: 'Rebuild started in the background. Re-run a search in a minute or two to confirm.',
    };
  },
};

export const searchAdminMcpTools = [rebuildSearchIndexTool];
