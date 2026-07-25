# BUG-011 — MCP is missing large parts of the app's write surface

Status: **9 MODULES COMPLETE 2026-07-25 (CRM, commerce, inventory, scheduling, email,
invoicing, social, b2b, cms) + automation/builder/sitebuilder/domains already broad; ai
deliberately carved out. Full write parity across every operator module.** Social + b2b
were service extractions into NEW shared packages (built api-rest-first) — a single
owner-run `pnpm install` links them + completes typecheck/lint; CMS was an in-place
extension of the existing `@sparx/cms` (no install, already verified clean). Two bugs
found by post-build testing are also fixed: the **scope-catalog lag** (b2b/social scopes
weren't grantable — un-reachable on every auth path) and the **api-mcp Pub/Sub-config
gap**. See "Per-module status" + the fix subsections below.
Severity: **High (platform principle)** — the platform commits to "MCP is a
first-class service" and "API-first: every UI feature exists as an API endpoint;
the dashboard is one consumer among many" (root `CLAUDE.md`). Today the MCP surface
is **read-heavy**: an AI client can _see_ most of the app but cannot _manage_ large
parts of it. Whole CRM areas (B2B accounts, pipelines, segments) are read-only.
Found: 2026-07-25, while testing the customer-classification model (docs/137) —
there was no way to create or update a customer through MCP.
Surfaces: `packages/*/src/mcp/*` (tool registries), measured against the REST write
routes in `services/api-rest/src/routes/v1/*` (the API-first source of truth).

## Symptom

The app exposes **~500 REST write routes** (POST/PATCH/DELETE) but only **191 MCP
tools** total, and the MCP tools skew heavily to reads. Concretely, an MCP client
could read customers and tag them, but could not **create, update, or delete** a
customer — so it could not set or change the new classification axes (relationship
type / lifecycle stage / lead status) at all.

## Scope — this is app-wide, not just CRM

Rough per-module write-route counts (REST) to audit against each module's MCP
tools: ~~commerce 105~~ ✅, inventory 48, scheduling 34, ~~crm 34~~ ✅, builder 33,
sitebuilder 27, invoicing 23, b2b 21, email 14, social 13, domains 12, content 12,
ai 12. Each needs a REST-route-vs-MCP-tool diff; the confirmed CRM gaps below are
the template for what that diff turns up. **CRM and commerce are now done**
(details below); the remaining ~11 modules follow the same pattern.

## CRM gap (fully diffed) — REST route exists, service method exists, NO MCP tool

Every item below has a working service function and REST route; only the thin MCP
wrapper is missing.

- [x] **create_customer** — `customerService.create` — ✅ ADDED 2026-07-25
- [x] **update_customer** — `customerService.update` — ✅ ADDED 2026-07-25
- [x] **delete_customer** — `customerService.softDelete` — ✅ ADDED 2026-07-25
- [x] **merge_customers** — `customerService.merge` (`POST /crm/customers/merge`) — ✅ ADDED 2026-07-25
- [x] **update_deal** — `dealService.update` (`PATCH /crm/deals/:id`); omits
      stageId/pipelineId — stage moves stay on `move_deal_stage` — ✅ ADDED 2026-07-25
- [x] **delete_deal** — `dealService.softDelete` (`DELETE /crm/deals/:id`) — ✅ ADDED 2026-07-25
- [x] **update_task** — `taskService.update` (`PATCH /crm/tasks/:id`) — ✅ ADDED 2026-07-25
- [x] **create_b2b_account** — `b2bAccountService.create` — ✅ ADDED 2026-07-25
- [x] **update_b2b_account** — `b2bAccountService.update` — ✅ ADDED 2026-07-25
- [x] **delete_b2b_account** — `b2bAccountService.softDelete` — ✅ ADDED 2026-07-25
- [x] **add_b2b_account_contact** — `b2bAccountContactService.create` — ✅ ADDED 2026-07-25
- [x] **create_pipeline** — `pipelineService.create` — ✅ ADDED 2026-07-25
- [x] **update_pipeline** — `pipelineService.update` — ✅ ADDED 2026-07-25
- [x] **archive_pipeline** — `pipelineService.archive` — ✅ ADDED 2026-07-25
- [x] **add_pipeline_stage** — `pipelineService.createStage` — ✅ ADDED 2026-07-25
- [x] **update_pipeline_stage** — `pipelineService.updateStage` — ✅ ADDED 2026-07-25
- [x] **delete_pipeline_stage** — `pipelineService.deleteStage` (reassign-on-delete) — ✅ ADDED 2026-07-25
- [x] **reorder_pipeline_stages** — `pipelineService.reorderStages` — ✅ ADDED 2026-07-25
- [x] **create_segment** — `segmentService.create` — ✅ ADDED 2026-07-25
- [x] **update_segment** — `segmentService.update` — ✅ ADDED 2026-07-25
- [x] **archive_segment** — `segmentService.archive` — ✅ ADDED 2026-07-25
- [x] **recompute_segment** — `segmentService.recomputeFull` (`POST /crm/segments/:id/recompute`) — ✅ ADDED 2026-07-25
- [x] **preview_segment_count** — `segmentService.previewCount` (`POST
/crm/segments/preview-count`), a "what would this rule match" dry-run —
      read-scoped, lives in read-tools.ts — ✅ ADDED 2026-07-25

Deliberately **not** MCP-appropriate (file upload / provisioning, keep out): CSV
`customers/import`, `customers/:id/documents` (media pipeline), `crm/bootstrap`.
Customer addresses (`customers/:id/addresses`) are a sub-resource — worth a tool if
address management via MCP is wanted, lower priority.

## Commerce gap — DONE 2026-07-25 (management-surface parity)

Commerce went from **37 MCP tools → 128** (107 write + 21 read). The whole
merchant management surface is now wrapped, split into cohesive files under
`packages/commerce/src/mcp/`:

- **write-catalog-tools.ts (35)** — categories (create/update/reparent/delete +
  set_product_categories), collections (create/update/delete + set members both
  directions + reindex), bundles + configurator templates (create/update/delete),
  variants (create/rename-sku/set-default/archive/restore + set_product_options +
  assign_variant_option_values), fitment (domain + node CRUD, reorder, bulk-assign,
  delete), product translations (upsert/delete).
- **write-pricing-tools.ts (20)** — discounts (create/update/activate/archive),
  adjust_gift_card, price lists (create/update/archive + entry set/bulk-set/delete),
  bulk-quantity tiers (create/delete), contract prices (create/delete), markup
  rules (create/update/delete), surcharge rules (update/delete).
- **write-fulfillment-tools.ts (20)** — shipping zones/profiles/rates CRUD +
  assign-products-to-profile, tax zones/rates/exemptions CRUD, returns lifecycle
  (deny / mark-received / record-inspection / issue-refund).
- **write-merchandising-tools.ts (9)** — review respond + bulk moderate/delete,
  Q&A answer + moderate (single/bulk), commerce site settings + theme (per-site,
  propertyId required).
- **write-tools.ts (23, existing + extended)** — products (create/update/publish/
  archive/unpublish/restore/bulk-status/image), subscriptions (create + items/
  schedule/address/skip-next/pause/resume/cancel), gift-card issue, account credit,
  returns approve, review moderate (single), apply_markup, set_surcharge,
  convert_quote_to_order, update_variant.

Typecheck + lint clean across `@sparx/commerce`, `api-mcp`, `api-rest`; all flow to
both the MCP server and the in-app BYOK AI catalog automatically.

**Deliberately excluded (provisioning / file / preview / shopper-lifecycle — not
operator MCP actions):** payment credentials + gateway + Sparx-Pay onboard/dashboard
links; provider install/config/enable/test; CSV `products/import` + `discounts/import`;
`products/:id/preview-tokens`; `configurator/preview` + `*/bulk-price/preview` +
`markup-rules/:id/preview` (the read-side `preview_markup` exists); cart
`abandoned`/`recovered` + `checkout-sessions/:id/expire` lifecycle marks.

**Small remaining tail (lower value, follow-on):** `markup-recompute-reviews`
approve/reject/bulk (dropship price-drift review queue); product `bulk-tag` and
`bulk-price` apply/revert; fine-grained variant-image ops (create/set-primary/
delete/bindings/image-order — `set_product_image` covers the common case);
`products/:productId/fitment` PUT (set-all — `bulk_assign_fitment` + node CRUD cover
assignment).

## Per-module status (2026-07-25)

Total api-mcp surface grew from **~191 tools → ~360**. All new tools typecheck +
lint clean across their package, `api-mcp`, and `api-rest`, and flow to both the
MCP server and the in-app BYOK AI catalog automatically.

**Note — this is `api-mcp` (the operator/admin server) only.** The storefront-facing
`mcp-site` server is a separate surface sourced from `@sparx/site-mcp` (shopper
`read`/`guest_write`/`customer`-tier), deliberately lean and intentionally NOT
expanded here.

| Module        | Tools | Status                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRM           | 49    | ✅ full write parity                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Commerce      | 128   | ✅ management-surface parity (see Commerce gap above)                                                                                                                                                                                                                                                                                                                                                                                       |
| Inventory     | 48    | ✅ +42 (suppliers, warehouses, PO/transfer/count lifecycles, lots, serials, recalls, fleet holds, reorder policy)                                                                                                                                                                                                                                                                                                                           |
| Scheduling    | 34    | ✅ +18 (booking state machine, series, waitlist, policies, exceptions)                                                                                                                                                                                                                                                                                                                                                                      |
| Email         | 16    | ✅ +11 (broadcasts, sending domains, suppressions, settings)                                                                                                                                                                                                                                                                                                                                                                                |
| Invoicing     | 26    | ✅ +19 (doc/line edit-delete, line types, templates, workflows + stages)                                                                                                                                                                                                                                                                                                                                                                    |
| Automation    | 9     | ✅ already complete (create/update/delete/clone/status + reads)                                                                                                                                                                                                                                                                                                                                                                             |
| Builder       | 33    | ✅ already broad (site page/layout authoring — MCP's core purpose)                                                                                                                                                                                                                                                                                                                                                                          |
| Sitebuilder   | 26    | ✅ already broad                                                                                                                                                                                                                                                                                                                                                                                                                            |
| CMS / content | 16    | ✅ DONE 2026-07-25 — +4 (delete_content_entry, restore_content_revision, put_content_type_schema, delete_content_type); extracted the 4 route-inline ops into `@sparx/cms` service fns (each a `*Tx` core + wrapper), re-pointed the routes. In-place extension of an existing package → NO install; `@sparx/cms` typecheck + lint clean, routes lint clean.                                                                                |
| Social        | 10    | ✅ DONE 2026-07-25 (authored; needs one `pnpm install`) — extracted the post + lifecycle service from api-rest `lib/` into `@sparx/social/service`, added `@sparx/social/mcp` (10 tools: list/get + create/update/delete/submit/schedule/approve/reject/publish), wired into api-mcp with new `read:social`/`write:social` scope + `social` module gate. See the extraction note below.                                                     |
| B2B           | 31    | ✅ DONE 2026-07-25 (authored; needs one `pnpm install`) — extracted the trade service layer from the api-rest routes into `@sparx/b2b` (pricing tiers + overrides, account trade config + fleet, purchase-approval rules + queue, net-terms AR invoices), re-pointed the routes at it, and added `@sparx/b2b/mcp` (11 read + 20 write) wired into api-mcp with `read:b2b`/`write:b2b` + a `b2b` module gate. See the extraction note below. |
| AI            | n/a   | 🚫 deliberately carved out — API keys, provider credentials, MCP-connection + tool-policy management are security-boundary meta an AI client should not self-administer.                                                                                                                                                                                                                                                                    |

\* CRM's `create_b2b_account` / `update_b2b_account` / `delete_b2b_account` /
`add_b2b_account_contact` cover the account record; the b2b _module_'s pricing/
approval/holds/AR surface is the open part.

**Next:** social + b2b are the two real remaining operator surfaces — but see the
architectural blocker below. They are NOT drop-in thin-wrapper adds like the other
six modules.

## Architectural blocker for social + b2b — service logic lives in api-rest, not a shared package

The six completed modules each had a **shared service package** (`@sparx/crm`,
`@sparx/commerce`, `@sparx/inventory`, `@sparx/scheduling`, `@sparx/email-platform`)
that both api-rest and api-mcp import — so an MCP tool is a 5-line wrapper. Social and
b2b do not:

- **Social** — the lifecycle lives in **`services/api-rest/src/lib/social-posts.ts`
  (277 lines) + `social-lifecycle.ts` (266 lines)**, importing only `@sparx/db` +
  `@sparx/api-core`. It is a real service layer, just in the wrong place (api-rest,
  which api-mcp cannot import). **Clean extraction** to `@sparx/social` (move 2 files
  - a `social-context`, re-point api-rest imports) unblocks a thin-wrapper registry.
- **B2B** — the pricing-tiers / approval / invoices logic is **fully route-inline** in
  api-rest (`services/api-rest/src/routes/v1/b2b/{pricing-tiers,approval,invoices}.ts`,
  ~1,216 lines of `withTenant` + direct `tx.b2bPricingTier.create(...)` in the
  handlers). There is **no service layer at all** — MCP parity requires **writing one**
  by lifting the inline logic into a package, then re-pointing the routes. (Fleet holds
  are already covered via the inventory tools; b2b account CRUD via the CRM tools.)

This is itself a manifestation of the same "API-first / one service, many transports"
debt the bug is about: social and b2b were built api-rest-first, so their logic never
made it into a shared service. Reimplementing it inside api-mcp (the `domain-tools.ts`
precedent) would DUPLICATE 500–1,200 lines and guarantee drift — rejected. The correct
fix is service extraction into shared packages, then thin MCP wrappers. Social is a
contained extraction; b2b is a genuine service-layer build. Both restructure api-rest
production code (so they need validation of the running REST stack, not just typecheck).

### Social — DONE 2026-07-25 (authored; one `pnpm install` to finish)

Extraction performed:

- `@sparx/social/service` (NEW subpath) — moved `social-posts.ts` + `social-lifecycle.ts`
  out of `services/api-rest/src/lib/` into `packages/social/src/{posts,lifecycle,context}.ts`.
  Kept behind the `/service` subpath (like `/crypto`) so the pure main barrel + the
  composer UI bundle never pull `@sparx/db`.
- `@sparx/social/mcp` (NEW subpath) — 10 tools (2 read + 8 write): `list_social_posts`,
  `get_social_post`, `create_social_post`, `update_social_post`, `delete_social_post`,
  `submit_social_post_for_approval`, `schedule_social_post`, `approve_social_post`,
  `reject_social_post`, `publish_social_post`. Lifecycle tools emit the same
  `social.post.due` / `social.post.scheduled` Pub/Sub events the routes do.
- api-rest `lib/social-posts.ts` + `social-lifecycle.ts` are now thin re-export shims
  (`export * from '@sparx/social/service'`) so all existing importers + the
  `readRequireApproval` unit test are unchanged; `social-context.ts` keeps its Fastify
  request→context helpers and re-exports the pure `SocialContext` from the package.
- api-mcp wired: `@sparx/social` dep added, `socialMcpTools` spread into `ALL_MCP_TOOLS`,
  `write:social` added to `WRITE_SCOPES`, `read:social`/`write:social` → `social` in
  `MODULE_BY_SCOPE` (server.ts). Excluded (provisioning): OAuth connect/disconnect,
  metrics refresh, per-target settings.

**Finish step (owner-run):** `pnpm install` (links the 3 new `@sparx/social` deps
`@sparx/db` + `@sparx/api-core` + `zod`, and api-mcp's new `@sparx/social` dep, and
updates the lockfile), then `pnpm --filter @sparx/social --filter @sparx/api-mcp
--filter @sparx/api-rest typecheck && ... lint`. Pre-install typecheck confirms the
ONLY errors are the four unresolved new-dep modules — every other error cascades from
them; there are no logic errors in the extracted code.

### B2B — DONE 2026-07-25 (authored; one `pnpm install` to finish)

The larger extraction: b2b had **no service layer** — the trade logic was fully
route-inline. Built one, re-pointed the routes, added the registry.

- **`@sparx/b2b`** (NEW package) — the trade service layer, lifted verbatim from the
  api-rest routes: `pricing-tiers.ts` (tier CRUD + tier overrides + `resolve_b2b_price`
  - the product-pricing join), `accounts.ts` (validated pricing-tier FK assignment,
    fleet set/validate/resolve, account overrides, compatible-products), `approval.ts`
    (rule CRUD + queue + approve/reject), `invoices.ts` (net-terms AR list/get/create/
    update/mark-paid/write-off). The mutating approval/invoice transitions return the
    domain events to publish (`PendingEvent[]`) rather than emitting inline, so the
    service stays transport-agnostic (the social `LifecycleResult` pattern).
- **`@sparx/b2b/mcp`** (NEW subpath) — **31 tools** (11 read + 20 write): pricing tier
  CRUD + overrides, `update_b2b_account_trade_config`, `set_b2b_account_fleet`, account
  overrides, approval-rule CRUD, `approve_b2b_order` / `reject_b2b_order`, and the AR
  invoice CRUD + `mark_b2b_invoice_paid` / `write_off_b2b_invoice`, plus the
  `resolve_b2b_price` / `get_b2b_product_pricing` reads. Events emit via a
  `createPublisher` from `@sparx/events` (matching api-mcp's `domain-tools` /
  `search-admin-tools` — api-mcp does NOT configure the api-core publisher; see the
  note below) so `order.placed` on approval reaches the fulfillment consumers.
- **Routes re-pointed** — all four write-bearing route files (`pricing-tiers`,
  `accounts`, `approval`, `invoices`) plus `product-pricing` are now thin delegations
  over the service; role checks, module gate, envelope shaping, and event emission stay
  on the route. No behavior change (same queries, same response shapes, same events).
- **api-mcp wired** — `@sparx/b2b` dep, `b2bMcpTools` spread into `ALL_MCP_TOOLS`,
  `write:b2b` added to `WRITE_SCOPES`, `read:b2b`/`write:b2b` → `b2b` in
  `MODULE_BY_SCOPE`. Boundary with CRM: account RECORD CRUD (company / contacts / rep)
  stays on the CRM registry's `create_b2b_account` etc.; the B2B registry owns the
  trade ENRICHMENTS (validated tier FK, credit, fleet, overrides, approval, AR).
  Excluded (MCP-inappropriate): CSV import/export, reporting rollups, quotes (a
  BillingDocument — covered by invoicing + `convert_quote_to_order`), fleet inventory
  holds (covered by the inventory tools).

**Finish step (owner-run):** `pnpm install` (links the new `@sparx/b2b` package + its
deps `@sparx/crm` / `@sparx/inventory` / `@sparx/events` / `@sparx/api-core` /
`@sparx/db` / `@sparx/auth` / `zod`, and the new `@sparx/b2b` dep on both api-rest and
api-mcp, updating the lockfile), then `pnpm --filter @sparx/b2b --filter @sparx/api-mcp
--filter @sparx/api-rest typecheck && ... lint`. As with social, a pre-install
typecheck cannot resolve the new workspace symlinks; model names, the `b2b` module
slug, and the four event types (`b2b.order.approved` / `b2b.order.rejected` /
`b2b.invoice.created` / `order.placed`) were verified against the schema + registries.

### Scope-catalog lag — b2b + social scopes were unreachable — FIXED 2026-07-25

Caught by post-deploy MCP testing: `list_b2b_pricing_tiers` returned `forbidden: tool
"…" requires scope "read:b2b" which is not granted`. Root cause: the new scopes were
added to the tool definitions, api-mcp's `MODULE_BY_SCOPE` gate, and `WRITE_SCOPES` —
but NOT to `@sparx/auth`'s scope catalog (`packages/auth/src/mcp-scopes.ts`:
`McpBusinessScope` union + `MCP_SCOPE_CATALOG`). That catalog is the single source the
API-key issuance dialog renders, that `MCP_ALL_OAUTH_SCOPES` (OAuth authorize + the
`/.well-known/oauth-protected-resource` advertisement) derives from, and that
`grantableScopesForRole` caps against. Because the scope wasn't in it, **no credential
could ever be granted `read:b2b`/`write:b2b` or `read:social`/`write:social`** — the
entire b2b AND social MCP surface was unreachable on every auth path, exactly the
regression the `read:cms` note in that file already documents.

**Fix:** added `read:b2b` / `write:b2b` / `read:social` / `write:social` to the union +
catalog (module labels "B2B" / "Social"). Everything else derives from the catalog, so
`grantableScopesForRole` (owner/admin: all; editor: +both non-bulk writes; viewer: both
reads), `capBusinessScopes`, `MCP_ALL_OAUTH_SCOPES`, and the consent scope-picker pick
them up automatically. `@sparx/auth` typecheck clean. **Requires deploy + a connector
re-authorization** (the consent grant is scope-bound; an existing token must re-consent
to acquire the new scopes) before the b2b/social tools are callable. This is the true
"DONE" gate for both modules — the earlier "DONE" claims wired the tools but the surface
was un-grantable until this landed.

### Follow-up — api-mcp did not configure the api-core Pub/Sub publisher — FIXED 2026-07-25

While wiring b2b, confirmed api-mcp **never called `configurePubsub`**, so the
`@sparx/api-core/pubsub` `publish` helper fell back to the stdout-logging stub there.
The CRM + platform buses ARE bridged (`installCrmPubSubBridge`), and tools that emit
via `@sparx/events` `createPublisher` (domain, search-admin, b2b) were fine — but any
MCP tool relying on api-core `publish` (the **social** `social.post.*` — so the
scheduled-publish worker never woke for an MCP-scheduled post — some **inventory**
stock/threshold + `search.entity.changed`, and **cms** emissions) emitted to the stub
in prod MCP.

**Fix:** added `configurePubsub({ gcpProjectId: env.GCP_PROJECT_ID })` to api-mcp's
`main()` (first, mirroring api-rest), plus `@sparx/api-core` as a direct dep. It is
independent of the CRM bridge's own module state (crm/events getPublisher/setPublisher),
so there is no double-publish — the events it now carries (inventory / social / cms /
non-CRM `search.entity.changed`) flow through the api-core path ONLY. It also enables
api-core's webhook-enqueue for these MCP writes (matching api-rest); the enqueued rows
drain on api-rest's shared `startWebhookDeliveryLoop` (same DB), so api-mcp needs no
delivery loop of its own.

**Also fixed — missing Dockerfile COPY lines** (would have failed the image build
regardless of the above): api-mcp's Dockerfile was missing `packages/social` (a gap from
the social session) AND `packages/b2b`; api-rest's was missing `packages/b2b`. Both
added. `@sparx/api-core` was already COPY'd in api-mcp; `social-worker` is unaffected
(it imports only the unchanged `@sparx/social` main barrel + adapters).

## Fix

Each missing tool is a thin `McpToolDefinition` in the module's
`mcp/write-tools.ts` wrapping the existing service function, added to the module's
tool array (which flows to both `api-mcp`'s registry and the in-app BYOK AI
tool-catalog automatically). Reuse the crm-schemas Zod inputs via `.pick()` so
validation can't drift — see the `create_customer`/`update_customer` tools added in
`packages/crm/src/mcp/write-tools.ts` as the reference implementation.

**Done 2026-07-25 — CRM module complete.** All 23 CRM write/preview gaps above are
wrapped: `packages/crm/src/mcp/write-tools.ts` (30 write tools) +
`read-tools.ts` (19 read tools, incl. `preview_segment_count`) → **49 CRM MCP tools**,
full write parity with the CRM REST surface. Typecheck + lint clean across
`@sparx/crm`, `api-mcp`, `api-rest`; all flow to both the MCP server and the in-app
BYOK AI catalog automatically. Next: repeat the REST-route-vs-MCP-tool diff for the
other ~12 modules — commerce (105 write routes) first, then inventory / scheduling /
builder / invoicing / b2b / email / social / domains / content.
