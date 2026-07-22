# 125 — Site data architecture: critical issues

Version: 1.0.0
Author: Brandon Korous
Last Updated: 2026-07-19

> **What this is.** A grounded audit of how site data is actually stored, written,
> published, and read today — and the specific places where that structure is
> fragile, lossy, or expensive. Findings are from a code read on 2026-07-19 across
> `packages/db/prisma/schema`, `packages/builder-schemas`, `packages/builder`,
> `packages/site-themes`, `packages/surface-compile`, `services/api-rest`,
> `apps/site`, and `apps/dashboard/app/(dashboard)/builder`.
>
> This is a **problem statement, not a plan.** Every issue below is written so it
> can be argued with: what the code does, where, and why it matters. Fixes are
> named where they are obvious, but sequencing is a separate decision.

---

## 1. The shape of it: three generations, all live

The site model is not one design. It is three, layered, running simultaneously.

| Gen | Storage tier                                  | Introduced   | Style                                                                                                                  | Status                                              |
| --- | --------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | `sitebuilder_*`                               | Jun 2026     | **Relational** — a row per section, per layout, per assignment; publish snapshots into 5 JSON columns on `SiteVersion` | Legacy; retirement is intended to be a deletion     |
| 2   | `builder_*` (`draft_tree` / `published_tree`) | Jun 2026 →   | **JSON-blob-first** — a whole page is one column                                                                       | Still wired to most ancillary machinery             |
| 3   | `silica_*` columns on the same rows           | Oct–Dec 2026 | JSON-blob, silica-native                                                                                               | **What actually renders today**; cutover unfinished |

Gen 2's header in [51-builder.prisma](../packages/db/prisma/schema/51-builder.prisma) states the intent explicitly — Builder was given its own clean storage "so the eventual Site Builder retirement is a deletion rather than a surgical extraction." That worked. What was not anticipated is Gen 3 landing _inside_ Gen 2's rows rather than beside them, which is the root of §6 and §7 below.

3 of the last 10 migrations are silica-cutover work. The site surface is the most actively churned area of the schema (~59 of 184 migrations touch it).

### Where the JSONB actually is

| Model                                                                                                                    | JSON columns                                                                     | Payload                                    |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------ |
| `BuilderPage`                                                                                                            | 4 — `draft_tree`, `published_tree`, `silica_draft_tree`, `silica_published_tree` | entire page body                           |
| `BuilderLayout`                                                                                                          | 4 — same pattern                                                                 | entire site chrome                         |
| `BuilderSite`                                                                                                            | **5, and no other data columns**                                                 | theme, symbols, saved-theme library        |
| `BuilderEmail`                                                                                                           | 4 (2 marked RETIRED)                                                             | email documents                            |
| `SiteVersion`                                                                                                            | 5 snapshots                                                                      | legacy publish state                       |
| `Property`                                                                                                               | 3                                                                                | `settings`, `moduleScope`, `brandOverride` |
| `ContentEntry` / `ContentRevision`                                                                                       | 2 each                                                                           | `body`, `seoJson`                          |
| `FormSubmission`                                                                                                         | 3                                                                                | `fields`, `attachments`, `context`         |
| `BuilderArchetype`, `BuilderComponentVersion`, `PlatformComponent`, `TenantSectionDefinition`, `TenantBlueprintInstall*` | 1–2 each                                                                         | trees, prop specs, merge baselines         |

Universal convention, stated in the schema itself: **shape is validated by a TS package, never by the DB.** That is a defensible choice. The issues below are about where it is not actually being upheld.

---

## 2. Validation is one-directional — and the live tier is barely validated at all

**Write is gated. Read is an unchecked cast.**

Every read site does the same thing:

```ts
// packages/builder/src/services/page-service.ts:41
// Stored validated on write; the editor depends on a well-formed tree.
tree: row.draftTree as unknown as BuilderNode,
```

This pattern repeats at roughly 15 call sites across `page-service.ts` (`:41`, `:442`, `:469`, `:491`, `:515`, `:571`), `site-service.ts` (`:80`, `:86`, `:161`, `:180`), and `surface-css-service.ts` (`:99`, `:105`, `:144`, `:150`). The entire invariant rests on the write gate holding, forever, for every row ever written.

Three holes in that:

**2.1 — Silica trees are effectively unvalidated in both directions.** The write schema is:

```ts
// packages/builder-schemas/src/site-sync.ts:69-71
export const SilicaTreeInput = z.looseObject({
  kind: z.string(),
}) as unknown as z.ZodType<SilicaNode>;
```

`{ kind: "x" }` passes. Zod never walks the tree. The rationale (`site-sync.ts:12-15`, `:60-68`) is sound in isolation — silica authored and validated the shape, and `z.custom` broke MCP `tools/list` — but the net effect is that **the tier that renders today has no schema enforcement at either boundary.**

**2.2 — Unknown node types render as `null`, silently.**

```ts
// packages/builder-render/src/render-leaf.tsx:899
default: {
  const atom = renderSiteUiAtom(node, {...});
  return atom === undefined ? null : atom;
}
```

No warning, no dev placeholder, no telemetry. A tree written by an older or newer builder version loses content with zero signal. The container wrapper still renders, so you get an empty `<div data-bx-type="Unknown">` — diagnosable in the DOM, but only if you already suspect it.

This is worth calling out as an internal inconsistency: `resolvePathEx` ([runtime.ts:120](../packages/builder-schemas/src/runtime.ts#L120)) went to real trouble to distinguish _missing_ from _empty_ precisely so "a typo'd or stale binding silently DELETES authored content" could not happen. The same failure mode is then accepted for node types.

**2.3 — Per-type props are never validated.** `BuilderNodeSchema.props` is `z.record(z.string(), z.unknown())` ([node.ts:160](../packages/builder-schemas/src/node.ts#L160)). The registry's `PropSpec[]` drives inspector controls only. A `Heading` with `props: { level: 'h9' }` persists cleanly and fails at render. The only per-type validation anywhere is for tenant components, at expand-time (`coerceInstanceProps`, [component.ts:105](../packages/builder-schemas/src/component.ts#L105)), and it drops bad values rather than rejecting.

Also: `import-export.ts:10-11` deliberately allows unknown node `type`s for forward-compat, so an import can persist types no registry entry resolves — which lands directly in §2.2.

---

## 3. Whole-site replace on every autosave

The silica `<Builder>` owns the whole multi-page site in memory and hands the host the complete `Site` on every change.

```ts
// apps/dashboard/app/(dashboard)/builder/_builder/silica-studio.tsx:41-53
function toSyncInput(site: Site): SiteSyncInput {
  return {
    pages: site.pages.map((p) => ({ id: p.id, name: p.name, slug: p.slug, root: p.root })),
    ...(site.frame ? { frame: { root: site.frame.root } } : {}),
    ...(site.symbols ? { symbols: site.symbols } : {}),
    ...(site.theme ? { theme: site.theme } : {}),
    ...(site.savedThemes ? { savedThemes: site.savedThemes } : {}),
  };
}
const AUTOSAVE_MS = 700;
```

There is **no diffing and no patching anywhere on this path.** A one-character heading edit on page 1 of a 12-page site ships all 12 page trees, the frame, the symbol library, the theme, and the saved-theme library.

`siteService.sync` ([site-service.ts:325-453](../packages/builder/src/services/site-service.ts#L325)) then reconciles per row: delete absent pages, `update` every existing page with `silicaDraftTree` + `position`, create new ones, write frame to the active layout, upsert `builder_sites`.

**Write amplification:** every page row in the property is UPDATEd on every autosave burst — sequentially, inside one interactive transaction, each a full JSONB column rewrite (Postgres TOAST rewrite per row). Untouched pages included, because the payload always carries them.

The legacy path (`use-builder-editor.ts:250-282`, 800ms debounce → `PATCH /v1/builder/pages/:id`) is field-partial but still a full tree replace for that one page.

---

## 4. The binding payload limit is undeclared, and it is the tightest one

Three limits sit on this path:

1. **Next.js server-action body limit — 1 MB, unconfigured.** `apps/dashboard/next.config.mjs` sets no `experimental.serverActions.bodySizeLimit`, so the Next default applies. `syncBuilderSite` is a server action carrying the whole site.
2. api-rest global `bodyLimit: 5 * 1024 * 1024` — [app.ts:711](../services/api-rest/src/app.ts#L711), commented "5 MiB — rich-text bodies, not media."
3. MCP paths: 512 KiB (`services/mcp-site/src/app.ts:120`, `services/api-mcp/src/app.ts:54`).

The tuned 5 MiB limit **never applies from the dashboard** — Next caps first, at a fifth of it, implicitly.

Failure mode: the client re-queues the payload and sets an error badge ([silica-studio.tsx:166-171](<../apps/dashboard/app/(dashboard)/builder/_builder/silica-studio.tsx#L166>)), then retries the same oversized payload forever. The author sees a generic error and loses everything typed since. **There is no tree-size limit anywhere else** — no node cap, no depth cap, no byte check on write. The only bounded input in the system is `CompilePreviewInput`'s `.max(2000)` classes, on the editor preview path.

---

## 5. No concurrency control, and the blast radius is the whole site

No version column, no `updatedAt` precondition, no ETag/If-Match, no optimistic lock, no advisory lock on any builder tree. `sync` reads then writes inside one `withTenant` transaction, which gives default isolation and nothing more.

Two editors on one site: both hold a full in-memory `Site`. B's 700ms autosave overwrites A's page trees wholesale; A's next keystroke overwrites B's. Neither is notified. Because the payload is the whole site, **one editor typing on the About page silently reverts the other's Home page edits.** That is materially worse than field-level last-write-wins.

The one existing guard is explicitly not a concurrency control:

```ts
// packages/builder/src/services/site-service.ts:299-315
export function wouldClobberSite(
  storedPageIds: readonly string[],
  incomingPageIds: readonly string[]
): boolean {
  if (storedPageIds.length === 0) return false;
  const incoming = new Set(incomingPageIds);
  return !storedPageIds.some((id) => incoming.has(id));
}
```

It catches _zero_ id overlap only. It exists (`:336-366`) because a transient read failure once made the studio seed a pristine starter over a real tenant, and the first autosave deleted every page. `SyncOptions.allowReplace` bypasses it; only `installSite` sets it.

The `beforeunload` / leave guard (`silica-studio.tsx:229-258`) is about _unpublished_ changes, not _conflicting_ ones.

---

## 6. No server-side history — for the store with the most destructive write semantics

There is no `BuilderPageRevision`, no snapshot table, no `draft_tree` archive. The full builder table set is `BuilderPage`, `BuilderPageAssignment`, `BuilderSite`, `BuilderLayout`, `BuilderEmail`, `BuilderComponent`, `BuilderComponentVersion`, `BuilderGovernance`, `BuilderArchetype`, `PlatformComponent`. Only `BuilderComponentVersion` is versioned, and that is for tenant _components_, not pages.

Compare CMS, which got it right ([11-cms-content.prisma:103-122](../packages/db/prisma/schema/11-cms-content.prisma#L103)):

```prisma
model ContentRevision {
  entryId        String   @map("entry_id") @db.Uuid
  revisionNumber Int      @map("revision_number")
  body           Json
  seoJson        Json     @map("seo_json")
  status         String   @db.VarChar(20)
  authorId       String?  @map("author_id") @db.Uuid
  summary        String?  @db.VarChar(500)
  @@unique([entryId, revisionNumber])
```

Undo is purely in-browser. Silica sets `persistKey={null}` (`silica-studio.tsx:266-268`), explicitly disabling silica's own IndexedDB crash-recovery — "Server-authoritative — the debounced onChange is the durable store." The legacy path has a bounded linear stack, `HISTORY_LIMIT = 100`, reset on page switch.

**Practical consequence:** `published_tree` is the only recoverable prior state, and only if you have not published since. Autosave fires 700ms after a burst, so there is no window to "not save." A tab close after a bad edit is permanent. Draft saves are deliberately un-audited on both paths, so even the audit log carries no trail.

---

## 7. The silica cutover left the ancillary machinery on the dead path

The cutover is a **parallel run with lazy re-seed** — not a dual-write, not a migration. `isSilica = (r) => r.silicaDraftTree != null` ([site-service.ts:58](../packages/builder/src/services/site-service.ts#L58)) is the entire discriminator. There is **no `draft_tree` → `silica_draft_tree` converter for pages** (emails got one: `email-legacy-to-silica.ts`). A silica-only row parks a blank stub in the NOT-NULL legacy column (`draftTree: asJson(blankPageTree())`, `:414`), and the two columns diverge permanently and intentionally.

What that broke:

| Publish step                | Silica publish | Legacy publish                           |
| --------------------------- | -------------- | ---------------------------------------- |
| draft → published tree copy | ✓              | ✓                                        |
| Tenant component expansion  | ✗              | ✓ `expandTreeForPublish`                 |
| Form-definition extraction  | n/a by design¹ | ✓ `syncFormDefinitions`                  |
| SEO audit snapshot          | ✗              | ✓ `auditAndStore`                        |
| Search index                | ✗              | ✗ (no builder→search integration exists) |
| Cache purge                 | ✗              | ✗                                        |

¹ Forms are fine — the config now only ever lives in the `FormDefinition` row, written directly from the inspector ([form-definition-service.ts:72-78](../packages/builder/src/services/form-definition-service.ts#L72)): "a recipient address cannot leak into a published tree it was never in." Correct design. Noted only because the legacy extraction is still the sole writer of `pageSlug` on that row.

**SEO audit is doubly broken.** `POST /v1/builder/site/publish` does not call it at all. And when it does run, `buildAuditableEntity` reads `page.publishedTree ?? page.draftTree` ([seo-audit.ts:64](../services/api-rest/src/lib/seo-audit.ts#L64)) — the _legacy_ columns — which for a silica page hold the blank stub. So any audit that fires scores an empty tree.

**Builder events go nowhere.** `publishBuilderEvent({ topic: 'builder.page.published', ... })` fires, but the active publisher is still `LoggingPublisher` ([events.ts:34-50](../packages/builder/src/events.ts#L34)) — `setPublisher` is never called outside tests. Grep finds only producers and the enum; no subscriber. Separately, `site-service.ts:676` passes `payload: { pageId: ctx.propertyId }` — a property id in a field named `pageId`. Harmless today only because nothing consumes it.

---

## 8. Read path: unselected `findMany` over four tree columns, uncached

To serve one page, the silica read pulls every page in the property with all four tree columns:

```ts
// packages/builder/src/services/site-service.ts:189
export function getPublishedPageBySlug(ctx, slug) {
  return withTenant(ctx, async (tx) => {
    const [pages, site] = await Promise.all([
      tx.builderPage.findMany({
        where: { propertyId: ctx.propertyId },     // ← every page in the property
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),                                          // ← no `select` → all 4 trees
      tx.builderSite.findUnique({ where: { propertyId: ctx.propertyId } }),
    ]);
    const target = normalizeSlug(slug);
    const row = pages.filter(isSilicaPublished).find((r) => normalizeSlug(r.slug) === target && ...);
```

Same shape at `getPublishedHome` (`:212`) and `getPublishedByRecordType` (`:240`). Cost model: a 40-page site with 150 KB trees moves **~24 MB out of Postgres per request** to render one page, drafts included, then discards all but one column of one row.

The JS filter is unavoidable for the JSON NULL check (Prisma is a type-only import there — documented at `page-service.ts:433`). The **slug match is not** — `where: { slug }` is available, backed by `@@unique([tenantId, propertyId, slug])`. The sparx tier already does exactly that (`page-service.ts:435`), so the silica tier is a regression against its own precedent. The likely cause is the `normalizeSlug` mismatch (stored `/shop` vs segment `shop`), fixable by normalizing on write.

**Whole trees load for list views too.** `listOrSeed` (`page-service.ts:155`) returns `toDto` per row, and `toDto` includes the tree — so listing page _names_ in the dashboard materializes every draft tree. Same at `site-service.ts:332`, `:480`, `:594`, `:629`, `:890`.

**And none of it is cached.** Both active tiers are `no-store`:

```ts
// apps/site/lib/builder.ts:53-58
// INTERIM: uncached so a publish reflects immediately. Builder content changes on
// publish, and no tag-purge is wired yet (that's the deferred Pub/Sub→cache-
// revalidation-worker slice) — a TTL here would just serve stale pages. Restore
// `next: { revalidate, tags: ['builder:<slug>'] }` once publish purges the tag.
```

Everything traces back to the one missing event consumer in §7. Note also that `apps/site/app/api/revalidate/route.ts` has **no `builder` scope** in its `SCOPES` list, so adding tags alone would not be enough.

---

## 9. Secondary findings

**9.1 — The surface-CSS cache checks itself last.** [surface-css-service.ts:118](../packages/builder/src/services/surface-css-service.ts#L118) reads every published tree in the property and walks them with `collectClasses` _before_ comparing the hash to the cache. The cache saves only the Tailwind compile. The file's own header calls the DB read "cheap"; it is every published tree in the property, on every storefront request. The header already names the real fix at `:16-19` — precompute the class-set hash at publish.

**9.2 — `resolveTenantBySlug` is uncached** ([public/builder.ts:55](../services/api-rest/src/routes/v1/public/builder.ts#L55)) while `resolvePublicPropertyId` beside it has a 60s TTL cache. [`ttl-cache.ts:1-20`](../services/api-rest/src/lib/ttl-cache.ts) documents this exact pattern as the fix for prod `P2028` "Unable to start a transaction" bursts. A storefront render makes ~6 of these uncached lookups, each its own interactive transaction.

**9.3 — `silicaDraftSymbols` is written unconditionally.** [site-service.ts:440](../packages/builder/src/services/site-service.ts#L440) does `silicaDraftSymbols: asJson(input.symbols ?? {})`, while theme and savedThemes one line up are guarded on presence — guarding that exists specifically to prevent this bug class. A sync payload lacking `symbols` **wipes the symbol library to `{}`**.

**9.4 — CMS pins are N+1.** [builder-data.ts:152](../apps/site/lib/builder-data.ts#L152) does one HTTP round-trip per pinned CMS entry, where commerce got a batched `ids:` endpoint. Parallelised, so latency is bounded, but it is N requests. Same shape in `silica-data.ts:356-367`.

**9.5 — Two render walkers must stay byte-identical.** `SilicaBody` renders to an HTML string; `SilicaChrome` walks to React because `children` drops at the Outlet across the Next layout/page boundary. The header (`silica-chrome.tsx:11-17`) acknowledges it "mirrors `toHtml`'s element/component/meta emission so the chrome matches a toHtml'd frame byte-for-byte." An acknowledged drift risk with no test pinning it.

**9.6 — Preview coverage is partial.** `?sparxSitePreview=` works for singleton pages. It is **not** threaded through `getPublishedBuilderCollection` ([builder.ts:99](../apps/site/lib/builder.ts#L99)) or anywhere in the silica tier (`lib/silica.ts` has no `previewHeaders` at all), so PDP and collection templates can never be previewed as draft.

**9.7 — Fixed fan-out truncation with no signal.** `perPage: 24` / `limit: 24` at `builder-data.ts:228`, `silica-data.ts:278`, `builder-commerce-data.ts:161`. A 100-product grid renders 24 with no pagination affordance.

**9.8 — Constraints that exist only in migration SQL.** Five partial unique indexes Prisma cannot express, and therefore cannot verify against drift: `properties WHERE is_primary`, `builder_layouts WHERE is_active`, `builder_pages WHERE is_default`, `builder_emails` (×2 on `key`), `navigation_menus` (×2 on `location`).

**9.9 — Property scoping is uneven.** `Redirect` and `SeoAudit` are tenant-wide, not property-scoped, in an otherwise per-site model. `SiteLayoutBlock` and `SiteTheme` are tenant-scoped by deliberate choice; the first two look like gaps rather than decisions.

**9.10 — Three different SEO storage shapes.** Inline columns on `BuilderPage`, `seoJson` JSONB on `ContentEntry`, and `seoTitle`/`metaDescription` columns on the legacy `Page`.

---

## 10. What is working well

Worth recording so a rewrite does not discard it.

- **Binding resolution is a proper two-phase collect-then-batch**, not N+1. `collectBindingRefs` ([runtime.ts:213](../packages/builder-schemas/src/runtime.ts#L213)) walks the tree with zero I/O, dedupes by stable key, and the loader issues one batched fetch per kind, all in `Promise.all`. Results park under reserved `__pins` / `__sources` roots.
- **`resolvePathEx` distinguishes missing from empty** using `in` (`runtime.ts:102-120`), specifically so a stale binding cannot silently delete authored content.
- **`mergeDataRoots`** (`builder-data.ts:171`) deep-merges pin writers so commerce and CMS cannot clobber each other.
- **Blueprint install deliberately does not re-stamp node ids** ([site-service.ts:817-835](../packages/builder/src/services/site-service.ts#L817)) — because the three-way merge in `packages/blueprints/src/merge.ts` keys on node id across versions. Page _row_ ids are minted; node ids are written through verbatim. That distinction is correct and subtle.
- **Raw-element rendering is properly gated.** `safeElementAttrs` ([element.ts:589](../packages/builder-schemas/src/element.ts#L589)) enforces a per-tag allowlist, URL scheme checks, forced `rel="noopener noreferrer"` on `target=_blank`, and drops objects rather than stringifying.
- **The class-policy floor is unrepresentable-if-insecure.** `createSilicaClassValidator` returns `undefined` when there are no custom rules, so the host can only tighten silica's floor, never loosen it (`silica-class-policy.ts:1-13`).
- **The catalog contract is real.** `catalog/CONTRACT.md` plus a test suite that parses every entry through `BuilderNodeSchema`, asserts unique ids per tree, and pins the email surface to zero `el:*` types.

---

## 11. Open questions for the architecture discussion

1. **Is whole-site-payload the right unit at all?** Per-page sync would fix §3's write amplification and shrink §5's blast radius to one page, but silica's engine owns the whole `Site` — so this is a question about the host/engine contract, not a local fix.
2. **Does the builder need a revision table, or is publish-as-checkpoint enough?** CMS answered this one way. The builder's write semantics argue for more history, not less.
3. **Should the legacy `draft_tree`/`published_tree` columns be dropped now?** They are the reason §7's machinery reads stubs. Dropping them forces the SEO/component/search integrations to move rather than silently no-op.
4. **What is the intended validation boundary for silica trees?** Today: none, either direction. Options range from "silica owns it, accept the cast" to a structural walk on write.
5. **What unblocks caching?** Everything in §8 traces to one unimplemented Pub/Sub → revalidation consumer. Is that a slice, or does the read path get restructured first?
6. **Should tree size be bounded, and where?** A declared limit with a real error beats an undeclared 1 MB Next default with an infinite retry loop.

---

## Related

- [98-builder-customization-rebuild.md](98-builder-customization-rebuild.md) — the composition model and layout invariants
- [118-builder-silicaui-html-migration.md](118-builder-silicaui-html-migration.md) — the cutover this audit finds mid-flight
- [120-email-builder-silica-adoption.md](120-email-builder-silica-adoption.md) — the email half, which _did_ get a converter
- [47-class-first-authoring-model.md](47-class-first-authoring-model.md) — why `class` is the sole styling surface
- [55-blueprint-updates.md](55-blueprint-updates.md) — the node-id-keyed three-way merge that constrains stamping
- [packages/db/CLAUDE.md](../packages/db/CLAUDE.md) — migration pipeline and RLS mechanics
