# BUG-011 — MCP is missing large parts of the app's write surface

Status: **PARTIALLY FIXED — customer CRUD added 2026-07-25; rest OPEN**
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
tools: commerce 105, inventory 48, scheduling 34, crm 34, builder 33, sitebuilder
27, invoicing 23, b2b 21, email 14, social 13, domains 12, content 12, ai 12.
Each needs a REST-route-vs-MCP-tool diff; the confirmed CRM gaps below are the
template for what that diff turns up.

## CRM gap (fully diffed) — REST route exists, service method exists, NO MCP tool

Every item below has a working service function and REST route; only the thin MCP
wrapper is missing.

- [x] **create_customer** — `customerService.create` — ✅ ADDED 2026-07-25
- [x] **update_customer** — `customerService.update` — ✅ ADDED 2026-07-25
- [x] **delete_customer** — `customerService.softDelete` — ✅ ADDED 2026-07-25
- [ ] **merge_customers** — `mergeService.merge` (`POST /crm/customers/merge`)
- [ ] **update_deal** — `dealService.update` (`PATCH /crm/deals/:id`) — only
      `move_deal_stage` exists today
- [ ] **delete_deal** — `dealService.softDelete` (`DELETE /crm/deals/:id`)
- [ ] **update_task** — `taskService.update` (`PATCH /crm/tasks/:id`) — only
      create/complete exist
- [ ] **create_b2b_account** — `b2bAccountService.create`
- [ ] **update_b2b_account** — `b2bAccountService.update`
- [ ] **delete_b2b_account** — `b2bAccountService.softDelete`
- [ ] **add_b2b_account_contact** — `b2bAccountContactService.create`
- [ ] **create_pipeline** — `pipelineService.create`
- [ ] **update_pipeline** — `pipelineService.update`
- [ ] **archive_pipeline** — `pipelineService.archive`
- [ ] **add_pipeline_stage** — `pipelineService.createStage`
- [ ] **update_pipeline_stage** — `pipelineService.updateStage`
- [ ] **delete_pipeline_stage** — `pipelineService.deleteStage`
- [ ] **reorder_pipeline_stages** — `pipelineService.reorderStages`
- [ ] **create_segment** — `segmentService.create`
- [ ] **update_segment** — `segmentService.update`
- [ ] **archive_segment** — `segmentService.archive`
- [ ] **recompute_segment** — segment recompute (`POST /crm/segments/:id/recompute`)
- [ ] **preview_segment_count** — `POST /crm/segments/preview-count` (a "what would
      this rule match" dry-run — high value for an AI building a segment)

Deliberately **not** MCP-appropriate (file upload / provisioning, keep out): CSV
`customers/import`, `customers/:id/documents` (media pipeline), `crm/bootstrap`.
Customer addresses (`customers/:id/addresses`) are a sub-resource — worth a tool if
address management via MCP is wanted, lower priority.

## Fix

Each missing tool is a thin `McpToolDefinition` in the module's
`mcp/write-tools.ts` wrapping the existing service function, added to the module's
tool array (which flows to both `api-mcp`'s registry and the in-app BYOK AI
tool-catalog automatically). Reuse the crm-schemas Zod inputs via `.pick()` so
validation can't drift — see the `create_customer`/`update_customer` tools added in
`packages/crm/src/mcp/write-tools.ts` as the reference implementation.

**Done 2026-07-25:** customer create/update/delete (`packages/crm/src/mcp/write-tools.ts`).
Verify each remaining module by diffing its REST write routes against its MCP tools,
then wrap the gaps. CRM is the first module; the other ~12 modules follow the same
pattern.
