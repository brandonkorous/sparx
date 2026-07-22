# 127 — Site read-path remediation

Version: 1.2.0
Author: Brandon Korous
Last Updated: 2026-07-20

> **1.2.0 — §1–§7 and §9–§11 are SHIPPED, and §8's shopper-facing pagination now is too.**
> The silent half was fixed first (truncation detectable, bindable, logged); the
> pagination half is now shipped for the navigable collection surface — the collection
> detail page pages from the URL with a real link-based pager, matching the category and
> PLP surfaces that already did. The ONE remaining item is narrowed to a scale-gated
> query-path swap (deep offset → Typesense), triggered-not-built. §2's fix deviates from
> what was proposed here — see the note in that section.

> **What this is.** The independently-shippable fixes to the storefront read path,
> extracted from [125-site-data-architecture-critical-issues.md](125-site-data-architecture-critical-issues.md).
>
> **Why it is its own doc.** [126](126-builder-op-protocol.md) is a quarters-long
> write-path and collaboration project. This is days of work, shares no dependency
> with it, and at the entity volumes we are targeting — tens to hundreds of thousands
> of products, entries, invoices, and customers per tenant — **this is the wall we hit
> first.** It should not queue behind the protocol work.
>
> One item (§6) is genuinely coupled to 126 and is marked as such.

---

## 1. Why this is urgent and 126 is not

Business-entity volume does not grow the builder tree. A product grid is one `repeat()` node carrying a collection _source_ (`{ from, id, limit }`); records are fetched at render into the `__sources` root ([builder-commerce-data.ts:156-168](../apps/site/lib/builder-commerce-data.ts#L156)). The tree stores the query, never the results.

So tree size is bounded by authoring effort, and stays roughly flat as a tenant's catalog grows from 100 products to 100,000. What is **not** flat:

- every storefront request is `no-store` and hits api-rest
- serving one page reads every page in the property, with all four tree columns
- the surface-CSS path reads and walks every published tree per request
- binding resolution truncates silently at 24 records with no pagination
- CMS pins are one HTTP round-trip each

None of that is a storage-shape problem. All of it is fixable now.

---

## 2. Fix the unselected `findMany` — highest ratio of impact to effort

```ts
// packages/builder/src/services/site-service.ts:189
export function getPublishedPageBySlug(ctx, slug) {
  return withTenant(ctx, async (tx) => {
    const [pages, site] = await Promise.all([
      tx.builderPage.findMany({
        where: { propertyId: ctx.propertyId },     // ← every page in the property
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),                                          // ← no `select` → all 4 tree columns
```

To render `/about` this transfers every page × four trees — drafts included — deserializes all of it in Prisma, and discards everything but one column of one row. At 40 pages × 150 KB trees that is ~24 MB per request, on an uncached path.

Same shape at `getPublishedHome` (`:212`) and `getPublishedByRecordType` (`:240`).

**Fix.** Add `select` naming only the needed tree column, and push the slug filter into `where`. The unique `@@unique([tenantId, propertyId, slug])` and the `[tenantId, propertyId, position]` index already back it.

The JS filter is unavoidable for the JSON-NULL check — Prisma is a type-only import there, documented at [page-service.ts:433](../packages/builder/src/services/page-service.ts#L433). The **slug match is not**. The sparx tier already does it correctly (`page-service.ts:435`), so the silica tier is a regression against its own precedent.

**The blocker is `normalizeSlug`.** Stored `/shop` vs requested `shop` is why the match moved into JS.

> **SHIPPED, differently.** This proposed normalizing on write plus a one-time backfill.
> What shipped queries BOTH forms — `slug: { in: [target, '/' + target] }` — because an
> `IN` on the `(tenant, property, slug)` unique index is exact and index-backed either
> way, and it needs no backfill migration against a FORCE-RLS table. The backfill is
> still worth doing eventually to make the stored form uniform, but it is no longer on
> the critical path for this fix.

Also add `select` to the sparx-tier single-row reads (`page-service.ts:435`, `:508`), which currently pull all four trees to use one.

---

## 3. Stop loading trees for list views

`listOrSeed` ([page-service.ts:155](../packages/builder/src/services/page-service.ts#L155)) returns `toDto` per row, and `toDto` includes `tree: row.draftTree` (`:41`). Listing page _names_ in the dashboard materializes every draft tree.

Same at `site-service.ts:332`, `:480`, `:594`, `:629`, `:890`.

**Fix.** Split the DTO. A `BuilderPageSummaryDto` without the tree for list surfaces; the full DTO only where the tree is actually rendered or edited. This is a mechanical change with a large constant-factor win on the busiest dashboard surface.

---

## 4. Fix the surface-CSS cache ordering

```ts
// packages/builder/src/services/surface-css-service.ts:118
const [trees, allowlist] = await Promise.all([readPublishedTrees(ctx), readAllowlistConfig(ctx)]);
const classes = collectClasses(trees);
const classHash = sheetCacheHash(classes, allowlist);
const cached = cache.get(key);
if (cached?.classHash === classHash) return cached.sheet;
```

**The cache check is last.** Every storefront request — cache hit or miss — runs two `withTenant` transactions, reads the `publishedTree` of every page in the property plus the layout, and walks all of them with `collectClasses`. The cache saves only the Tailwind compile.

The file header calls this "a cheap DB read." It is every published tree in the property.

**Fix, short term.** Cache the `(trees, classHash)` pair under a short TTL so a hit costs zero DB reads.

**Fix, correct.** Persist the class-set hash at publish time — the header already names this at `:16-19`. Once [126 §5.3](126-builder-op-protocol.md) lands content-addressed artifacts, the artifact hash _is_ this hash and the whole path collapses. Until then, the TTL is the right stopgap.

---

## 5. TTL-cache the tenant lookup

```ts
// services/api-rest/src/routes/v1/public/builder.ts:55
async function resolveTenantBySlug(slug: string): Promise<string> {
  const t = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
```

Uncached, while `resolvePublicPropertyId` immediately beside it has a 60s TTL cache. A storefront render makes roughly six of these, each in its own interactive transaction.

[`ttl-cache.ts:1-20`](../services/api-rest/src/lib/ttl-cache.ts) documents this exact pattern as the fix for production `P2028` "Unable to start a transaction" bursts. This is the remaining instance of the pattern that caused them.

**Fix.** Wrap it in the existing `createTtlCache`. Trivial, and it removes ~6 transaction slots per storefront render.

---

## 6. Restore caching — coupled to 126

Both active render tiers are `no-store`:

```ts
// apps/site/lib/builder.ts:53-58
// INTERIM: uncached so a publish reflects immediately. Builder content changes on
// publish, and no tag-purge is wired yet (that's the deferred Pub/Sub→cache-
// revalidation-worker slice) — a TTL here would just serve stale pages.
```

The chain is fully traceable and every link is missing:

1. `publishBuilderEvent` fires, but the publisher is still `LoggingPublisher` — `setPublisher` is never called outside tests ([events.ts:34-50](../packages/builder/src/events.ts#L34))
2. no subscriber consumes `builder.page.published`; `cache-revalidation-worker` exists but registers no builder topic
3. `apps/site/app/api/revalidate/route.ts` has **no `builder` scope** in `SCOPES`, so adding fetch tags alone would not be sufficient
4. the event payload is malformed — `{ pageId: ctx.propertyId, name: 'site' }` puts a property id in a field named `pageId` ([site-service.ts:676](../packages/builder/src/services/site-service.ts#L676)). Harmless only because nothing consumes it

**Fix.** Wire all four: correct the payload, replace the publisher, add a builder consumer to `cache-revalidation-worker`, add the `builder` scope, then restore `next: { revalidate, tags }` on the builder and silica readers.

**Coupling.** This is shippable today with slug-based tags. It gets strictly better under [126 §5.3](126-builder-op-protocol.md), where the artifact hash becomes the cache key and CDN caching becomes possible. Do not wait for 126 — do the tag version now and upgrade the key later.

---

## 7. Batch the CMS pins

```ts
// apps/site/lib/builder-data.ts:152
await Promise.all(
  ids.map((id) => getEntryById(tenantSlug, id).then(...))
);
```

One HTTP round-trip per pinned CMS entry, where commerce got a batched `ids:` endpoint. Parallelised, so latency is bounded, but it is N requests against api-rest per render. Same shape at `silica-data.ts:356-367`.

**Fix.** Add an `ids:` batch parameter to the public CMS entry endpoint and collapse to one fetch, matching `getProductsFull`.

---

## 8. Fix silent truncation

`perPage: 24` / `limit: 24` at `builder-data.ts:228`, `silica-data.ts:278`, `builder-commerce-data.ts:161`. A 100-product grid renders 24 with no pagination affordance and no signal to the author that anything was dropped.

At the catalog sizes we are targeting this is the difference between a working storefront and a broken one.

**Fix.** Two parts, and both are needed:

- **Author-facing** — the collection source inspector must surface the cap and let it be set, and the canvas must indicate truncation. Silent is the bug.
- **Shopper-facing** — real pagination or infinite scroll on collection-bound grids. Large catalogs are a Typesense query, not a `findMany`.

> **Shopper-facing pagination: SHIPPED.** The collection detail page
> ([apps/site/app/collections/[handle]/page.tsx](../apps/site/app/collections/[handle]/page.tsx))
> now reads `?page=`, fetches that page at 24/page, binds only that window to the
> template's `collection.products` grid, and renders the proven link-based SSR pager
> ([apps/site/components/pagination.tsx](../apps/site/components/pagination.tsx)) beneath
> the authored body — the same seam the category-detail core and the PLP already use. It
> was the one navigable collection surface still stuck on a single page (the silica
> composite is a bind-based grid, so it can't express a working pager itself — the route
> owns it, exactly as the category core does). `?page=` varies this `force-dynamic` route
> and each page caches independently under the commerce product tag, NOT the `builder:<slug>`
> tag (§6) — the two concerns never collide. What's left is purely the **scale query
> path** below.

---

## 9. Parallelise the root layout

[apps/site/app/layout.tsx](../apps/site/app/layout.tsx) sequentially awaits four independent reads — snapshot (`:263`), builder layout (`:272`), silica frame (`:280`), surface styles (`:308`) — before chrome renders. Four round-trips deep, serialised.

**Fix.** `Promise.all` the independent ones. `resolveSite` and `resolveActivePropertySlug` must stay ordered; the rest need not.

---

## 10. Make unknown node types visible

```ts
// packages/builder-render/src/render-leaf.tsx:899
default: {
  const atom = renderSiteUiAtom(node, {...});
  return atom === undefined ? null : atom;
}
```

An unrecognised type renders `null` with no warning, no dev placeholder, no telemetry. Content disappears silently.

This is an internal inconsistency worth naming: `resolvePathEx` ([runtime.ts:102-120](../packages/builder-schemas/src/runtime.ts#L102)) went to deliberate trouble to distinguish missing from empty precisely so "a typo'd or stale binding silently DELETES authored content" could not happen. The same failure mode is then accepted for node types.

**Fix.** Log server-side with `{ propertyId, pageId, nodeId, type }`; render a visible placeholder in preview and dev; count it as a metric. [126 §7](126-builder-op-protocol.md) makes it queryable via the node index — that is complementary, not a substitute.

---

## 11. Thread preview through the remaining tiers

`?sparxSitePreview=` works for singleton pages only. It is not threaded through `getPublishedBuilderCollection` ([builder.ts:99](../apps/site/lib/builder.ts#L99)) or anywhere in the silica tier (`lib/silica.ts` has no `previewHeaders` at all), so PDP and collection templates cannot be previewed as drafts.

**Fix.** Add the preview header to the collection and silica readers, matching the singleton path. The api-rest side already branches correctly on `tryVerifySitePreview`.

---

## 12. Status

| #   | Item                                                       | Status                                           |
| --- | ---------------------------------------------------------- | ------------------------------------------------ |
| §2  | `select` + slug in `where` on the silica published reads   | **shipped** (via dual-form `IN`, not a backfill) |
| §3  | `BuilderPageSummaryDto` for list views                     | **shipped**                                      |
| §4  | Cache checked before the tree read + publish invalidation  | **shipped**                                      |
| §5  | Shared TTL-cached tenant-slug resolver                     | **shipped** (misses deliberately uncached)       |
| §6  | Publish → Pub/Sub → worker → tag purge → cached reads      | **shipped**                                      |
| §7  | Batched CMS pin fetch (`/entries/by-ids`)                  | **shipped**                                      |
| §8  | Truncation made visible (bindable + logged)                | **shipped**                                      |
| §8  | Real pagination on the collection detail (URL + SSR pager) | **shipped**                                      |
| §8  | Deep-offset query path at catalog scale (→ Typesense)      | **specified — scale-gated, not built**           |
| §9  | Parallelised root-layout reads                             | **shipped**                                      |
| §10 | Unknown node types surfaced                                | **shipped**                                      |
| §11 | Preview on collection + silica readers                     | **shipped**                                      |

### What §8 still needs

The silent half was fixed first: a truncated list publishes `commerce.productTotal` /
`commerce.productHasMore` (exact, since the products endpoint reports a total) and
`cms.<type>HasMore` (a boolean, via an n+1 fetch — the entries endpoint returns a bare
array with no total), and logs a warning server-side either way. So a template CAN say
"Showing 24 of 137" and an operator CAN find the truncation in logs.

The pagination half is now shipped for the surface that needed it — the collection
detail page shows record 25. Of the three things the earlier pass named:

1. **A pagination control** — resolved via the route, not a new in-tree engine control.
   The bind-based composite can't express a working SSR pager (its `Pagination` atom is
   presentational — dead numbers with no href), so the route renders the link-based
   `components/pagination.tsx` beneath the authored body, exactly as the category-detail
   core does. A truly in-tree, author-placeable functional pager remains a possible
   future authoring nicety, but it is not what "show record 25" required.
2. **URL state** — done. `?page=` on the `force-dynamic` route; each page caches under
   the commerce product tag, independent of the `builder:<slug>` publish tag (§6), so the
   two never collide.
3. **A query path for large catalogs** — **the one genuinely open item.** The collection
   products endpoint pages with `skip`/`take` + `count`, which is correct and cheap into
   the low thousands but degrades at deep offsets on a very large single collection. At
   the target scale the answer is Typesense ([22](22-typesense-search-spec.md)), not a
   deeper `findMany`. This is an api-rest query-path swap behind a real scale trigger — it
   changes nothing the storefront already does, so it stays specified-not-built until a
   tenant's largest collection actually warrants it (the same discipline as the artifact
   pruner in [126 §5.3.1](126-builder-op-protocol.md)).

So the cap is no longer honest-but-hidden nor honest-but-capped: the whole collection is
reachable, and only the deep-page performance of a hypothetical huge collection is
deferred.
