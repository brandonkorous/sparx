# MCP + Media — agent parity & organization

Version: 0.1
Author: Brandon Korous
Last Updated: 2026-07-25

> A design note for two improvements that surfaced while wiring Pinterest and
> posting from the composer by hand (2026-07-25). Both are about the platform's
> own rules — **API-first / MCP-first** and **the site IS the business** — not new
> product surface. Written to be built against; the social piece ships first.
>
> Related: [133 — Social Media Posting](../133-social-media-posting.md),
> [social.md](social.md) (living tracker), [07 — MCP server spec](../07-mcp-server-spec.md),
> [15 — CMS media] model at [`wizeworks/packages/db/prisma/schema/15-cms-media.prisma`](../../packages/db/prisma/schema/15-cms-media.prisma).

---

## 1. MCP social posting — the one missing tool (SHIP FIRST)

### Where we are

The `social` MCP tool set ([`wizeworks/packages/social/src/mcp/tools.ts`](../../packages/social/src/mcp/tools.ts))
already has **full composer parity**: `create_social_post` (body, link,
`mediaAssetIds` ≤ 20, `targets[]`), `update`/`delete`, the whole lifecycle
(`submit_for_approval` / `schedule` / `approve` / `reject` / `publish`), and the
reads `list_social_posts` / `get_social_post`. Media upload is reachable too
(`@wizeworks/media/mcp`: `upload_image`, `create_image_upload`, `set_image_from_url`).
All are registered in [`wizeworks/services/api-mcp/src/tool-registry.ts`](../../services/api-mcp/src/tool-registry.ts)
and gated on the `social` module flag at dispatch.

So an agent can already do **almost** the entire flow we did by hand: upload media
→ compose a draft with those asset ids → fan out to targets → schedule/publish.

### The gap

`create_social_post` requires `targets[].targetId` (a `SocialTarget` UUID), but
**there is no MCP tool to _discover_ those ids.** An agent is handed a keyhole:
it can post, but it can't see which accounts/pages/boards exist to post to. The
manage-UI reads them from `GET /v1/social` → `listSocialConnections`, which lives
in api-rest's lib and is **not** exposed over MCP.

Connecting an account (OAuth) is deliberately **not** an MCP tool and should stay
that way — an agent can't and shouldn't complete a Facebook login. The gap is
purely **read**.

### The fix

1. **Move the read view into the package** so both transports share it (the
   "one service, many transports" rule the module already follows). Add
   `listSocialConnections` + `SocialConnectionView` / `SocialTargetView` to
   `wizeworks/packages/social/src/connections.ts`, export from `@wizeworks/social/service`, and
   have api-rest's [`social-connections.ts`](../../services/api-rest/src/lib/social-connections.ts)
   re-export it (its connect/upsert/target-sync/disconnect stay — they're
   provisioning, adapter- and crypto-bound).

2. **Add one read tool** `list_social_connections` (`read:social`, no
   confirmation): returns each connection (platform, status, `propertyId`,
   display name, avatar) with its `targets[]` (`id`, `name`, `enabled`,
   `externalTargetId`). The tool description points the agent at using a target's
   `id` as `create_social_post` → `targets[].targetId`, and notes only `enabled`
   targets accept posts.

That single tool turns "the posting tools exist" into "an agent can run a
tenant's social from scratch": **list connections → (upload media) → create draft
→ schedule/publish.**

### Out of scope (correct as-is)

Account connect/disconnect, per-target enable toggle, and metrics refresh remain
provisioning surfaces behind the OAuth/settings routes — not agent-authorable.

---

## 2. Media organization — scope first, folders second

> **Status (2026-07-25): Slice A (site-scoping) + Slice B (auto-groups AND
> collections) are BUILT, APPLIED, and green** — three migrations on docker, client
> regenerated, full repo typecheck 93/93, media tests passing.
>
> **Slice B (collections) — built:** `MediaCollection` + `MediaAssetCollection`
> join (migration [`20270118000002_media_collections`](../../packages/db/prisma/migrations/20270118000002_media_collections/migration.sql),
> both RLS-isolated; site-scoped like assets; an asset can be in many collections).
> Routes [`collections.ts`](../../services/api-rest/src/routes/v1/media/collections.ts):
> list/create/rename/delete + add/remove assets (adds validate ownership so a forged
> id can't pin another tenant's asset), plus a `?collection=` filter on the asset
> list. Picker ([`media-collections.ts`](../../apps/workbench/surfaces/cms/media-collections.ts)
> hooks + [`media-picker.tsx`](../../apps/workbench/surfaces/cms/media-picker.tsx)):
> the group row now carries collection chips + "New collection" (inline create), and
> each tile has a **"save to collection"** menu (add, or remove when browsing one) —
> the Pinterest board pattern. **Follow-up:** rename + delete-collection from the UI
> (routes exist; no picker control yet, delete wants a confirm), and the collection
> row on the standalone media-manager surface.
>
> **Slice B (auto-groups) — built:** `MediaAsset.source` (soft VarChar label,
> migration [`20270118000001_media_source`](../../packages/db/prisma/migrations/20270118000001_media_source/migration.sql)),
> stamped at upload from the surface — logo slot → `brand`, product media →
> `product`, social composer → `marketing`, CMS/author → `content`, else `NULL` =
> "Uploaded". The upload route + both `useUploadMedia` hooks pass it; the
> `MediaPickerProvider` takes a `source` prop (wired at each mount); the list route
> filters by `source` (`none` = the NULL/"Uploaded" bucket); the picker shows a
> fixed **All · Brand · Product · Marketing · Content · Uploaded** group row — zero
> filing. Follow-up: the standalone `media-list` manager + commerce `media-field`
> don't show the group row yet (the shared picker does).
>
> **Built in Slice A:**
>
> - `MediaAsset.propertyId` (nullable → `Property?`, `onDelete: SetNull`) +
>   `@@index([tenantId, propertyId, updatedAt Desc])` —
>   [`15-cms-media.prisma`](../../packages/db/prisma/schema/15-cms-media.prisma),
>   back-relation on [`08-property.prisma`](../../packages/db/prisma/schema/08-property.prisma).
> - Hand-authored, non-destructive migration (add column + FK + index, **no
>   backfill**, no RLS change — the existing `tenant_isolation` policy covers it):
>   [`20270118000000_media_site_scoping`](../../packages/db/prisma/migrations/20270118000000_media_site_scoping/migration.sql).
>   `prisma validate` passes.
> - **Browser upload route** stamps the active site (`resolvePropertyId` off
>   `x-sparx-property-id`, fails closed to primary) —
>   [`uploads.ts`](../../services/api-rest/src/routes/v1/media/uploads.ts).
> - **List route** scopes to "this site ∪ shared" via new
>   `mediaSiteVisibilityWhere` + `resolveListScope`, and **skips scoping when
>   resolving an explicit `ids` set** so a referenced asset never vanishes —
>   [`assets.ts`](../../services/api-rest/src/routes/v1/media/assets.ts),
>   [`property.ts`](../../services/api-rest/src/lib/property.ts).
> - **The picker needs no change** — the workbench api client already attaches
>   `x-sparx-property-id` to every request, so the picker is site-scoped for free.
>
> **Handoff to make it live (DB-impact rule — I don't run these):**
> `prisma migrate dev` locally (or the DB Migrate workflow on `main`) + `prisma
generate`. Until the client is regenerated, `mediaSiteVisibilityWhere` shows 2
> expected `propertyId`-not-on-`MediaAssetWhereInput` typecheck errors; they clear
> on generate. Then deploy api-rest.
>
> **Follow-ups (not blocking):**
>
> - **Secondary create paths default to shared (NULL):** the `@wizeworks/media`
>   asset-service (MCP `upload_image` etc.), blueprint installer, dropship import,
>   and seed do NOT stamp `propertyId` yet — their uploads are tenant-wide until we
>   thread an optional `propertyId` through `MediaWriteContext`. Non-breaking; the
>   leak path (workbench picker) is closed.
> - **"Make shared / move to site" affordance** in the picker (flip an asset's
>   `propertyId` between a site and NULL) — the model supports it; no UI yet.

### Where we are

`MediaAsset` ([`15-cms-media.prisma`](../../packages/db/prisma/schema/15-cms-media.prisma))
is a **flat list keyed on `tenantId`**. No `propertyId`, no `folderId`, no
`collectionId`, no `tags`. The library query
([`GET /v1/media/assets`](../../services/api-rest/src/routes/v1/media/assets.ts))
filters by tenant (RLS) + search string + `status` + mime-type prefix only. The
picker ([`media-picker.tsx`](../../apps/workbench/surfaces/cms/media-picker.tsx))
consumes exactly that.

### The real problem is scope, not folders

Media is `tenantId`-scoped, **not site-scoped**. That fails the platform's own
test directly — _"the site IS the business; would Bob's Parts and Savory Donuts
(two unrelated businesses under one owner) share this?"_ They would **not** share
brand or product photos, yet today they see each other's assets in one picker.
**Folders on top of the wrong scope just organize a leak.** Fix scope first.

### Recommended build, in order

1. **Site-scope media.** Add nullable `propertyId` to `MediaAsset`
   (`NULL` = tenant-wide/shared, e.g. a group logo used across a tenant's sites;
   everything else belongs to a site — burden of proof on sharing, per the rule).
   Thread `propertyId` through upload → the list query (`?propertyId=`) → the
   picker (default to the active site, with an explicit "shared" affordance).
   Backfill existing assets to the tenant's primary site.
   - Blast radius is friendly: **168 refs across 58 files, mostly FK-less**
     (`mediaAssetIds String[]`, loose ids). The change is additive — a new column
     - a filter param; no consumer breaks unless it opts into the filter.

2. **Then organization — auto-groups, not rigid folders.** For the non-technical
   audience, derive groups from what the system already knows instead of asking
   owners to file things:
   - **Auto-groups by source/usage** — an asset uploaded on a product, via the
     social composer, or into a logo slot surfaces automatically as
     _Product photos · Marketing · Brand · Uploaded_. Zero filing.
   - **Optional custom collections** (many-to-many) for the cross-cutting cases —
     one image can be "Brand" _and_ "Spring campaign". A rigid single-parent
     folder forces "which one folder?", the wrong question for media that is
     genuinely a product shot AND an ad AND a social slide.

   New `MediaCollection` model (`{ id, tenantId, propertyId, name }`) + a
   `MediaAssetCollection` join; auto-groups need no schema (derived from
   existing references / a `source` label at upload). Both touch only the list
   query + picker, additively.

### Sequencing

Site-scoping is the correctness fix and unblocks the rest; ship it before
collections. Auto-groups can land with, or just after, scoping since they lean on
data we already have.
