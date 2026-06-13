# Sparx Platform — Automation Feature Build Log

**Version:** 1.21
**Author:** Brandon Korous
**Last Updated:** 2026-06-12

---

## 0. What this doc is

The **living build state** for the Automation feature. The design lives in
[docs/81](81-automation-module.md) (engine) and [docs/82](82-event-bus-unification.md)
(event substrate); this doc tracks **what is actually built**, in what order, and
**where to resume** when context shifts. Update the status markers + the
`▶ RESUME HERE` pointer every working session.

Status legend: ☐ not started · ◐ in progress · ☑ done · ⃠ deferred/blocked

> **▶ RESUME HERE:** **Slice K (docs/90 ADR — automation migration) — IN PROGRESS.** Migrate ALL baked-in
> workflows onto the unified engine + a Builder-email **DataSource** layer, and HARD-DELETE the legacy
> email-platform automation system (zero users → no incremental, no soft-deprecation). Full spec in
> [docs/90](90-ADR-automation-migration.md); live task list in the session todos. Target = **23 system
> automations** (per-module, Managed except the one Locked B2B dunning) + **13 Builder-email default templates**
> (+ 3 raw `send_internal` internal alerts) + full **CAN-SPAM/CASL compliance gate chain** (derived from
> `emailType`, never stored).
>
> - **Step 1a — legacy delete DONE** (this session): removed `@sparx/email-platform` `DEFAULT_AUTOMATIONS` +
>   `automationService` (`evaluateTrigger`/`provisionDefaults`/`list`/`get`/`update`) + `schemas/automations` +
>   the 3 email-automation MCP tools (`get_automation_list`/`pause_automation`/`resume_automation`) + the
>   `/v1/email/automations` REST + `/v1/email/bootstrap` + `/internal/email/trigger` route + the api-rest
>   `email-module-activation` consumer + the dashboard `/email/automations` page & manifest section. Migration
>   `20260814000000_drop_email_automations` dropped the `email_automations` table + the
>   `email_scheduled_sends.automation_id` FK/column (ScheduledSend STAYS — it's the shared dispatch queue the
>   unified `enqueueSend` writes). Applied to docker; table+column confirmed gone; client regenerated. **Verify:**
>   typecheck **8/8** (db/email-platform/email-sends/api-rest/api-mcp/dashboard), api-mcp **12/12**, email-sends ok.
> - **Key schema deltas found during mapping** (vs the ADR): `Deal` owner is `assignedRepId` (not `ownerId`);
>   consent lives in `Customer.gdprConsent` JSON (no `marketingOptIn` col) → the compliance gate reads that;
>   `BillingDocument` has NO `workflow.origin` → partition user-vs-system invoices by `workflow.slug`;
>   `EmailSettings.physicalAddress` ALREADY EXISTS (CAN-SPAM address, no new column); B2B email reached via the
>   primary-contact→Customer relation; `Cart` has no `status` col (infer abandonment via `abandonedAt`/`recoveredAt`
>   null + items + `updatedAt` age + no checkout session). Events NOT yet published (must add): `b2b.account.approved`,
>   `chat.conversation.resolved`, `chat.conversation.unresponded`; seed triggers rename to real names
>   `crm.quote.submitted` + `crm.b2b_account.created`. Rich transactional receipts (order/shipping) stay INLINE
>   (commerce stripe webhook) — NOT engine workflows.
> - **Step 1b — trigger substrate COMPLETE** (this session): (a) **`interval` schedule cadence** added to the
>   engine — sub-daily, fires on UTC minute boundaries, dedupes ONCE PER ENTITY (stable window key) so a
>   transient row (cold cart / unresponded chat) triggers a single run; wired through schema + tick + dashboard
>   editor + summaries. (b) **Built-in resolver additions** (`crm.deal.stage_changed`, `deal.stageType`/
>   `assignedRepId`/`name`, `order.refundTotal`). (c) **Module resolvers + scanners** in a new
>   `automation-actions/src/resolvers.ts` — quote / billing_document / b2b-account-event / product resolvers +
>   a shared `resolveContact` (customer directly OR via B2B primary contact) + **cart**, **conversation**
>   (dual: open-unresponded AND recently-resolved), **billing_document** (computed `daysUntilDue`/`overdueDays`,
>   `workflowSlug` partition) scanners. (d) **NO new event publishers needed** — `b2b-account-approved` →
>   existing `crm.b2b_account.created`; `chat-satisfaction` → resolved-conversation scan; `chat-unresponded` →
>   scan (cart `recoveredAt:null` excludes purchased carts — checkout-service stamps it). **Verify:** typecheck
>   clean across automation/-schemas/-actions/events/dashboard; new `scanners.test.ts` **3/3** on docker (interval
>   once-per-entity dedupe + billing scanner resolves due-in-3 fields + excludes paid). `@sparx/automation` suite
>   45/46 (the 1 = the documented pre-existing durable-wait flake).
> - **Step 2 — Builder email DataSource layer COMPLETE** (this session). The keystone that unblocks the parallel
>   template agent. (a) **Pure token layer** `builder-schemas/email-tokens.ts` — `{{ source.path ?? "fallback" }}`
>   parse/interpolate + `collectEmailPaths`/`collectEmailSourceKeys` (walks bindings AND token strings AND a
>   `conditional_block`'s `props.when`) so the resolver loads exactly the referenced sources. (b) **Renderer**
>   (`renderEmailTree`): the 4 new node types — `line_item_table` (bound collection → 3-col table), `conditional_block`
>   (`props.when` truthy gate over children), `unsubscribe_link` + `physical_address` (read a new `ComplianceContext`)
>   — plus `{{token}}` interpolation in every string prop (heading/text/button label+href/image). (c) **Migration**
>   `20260815000000_scheduled_send_entity_refs` — `ScheduledSend.entity_refs` + `entity_snapshot` (applied to docker).
>   (d) **`resolveEmailData` rewritten to the docs/91 §3 vocabulary** — `customer/tenant/order/cart/quote/invoice/
b2bAccount` (+ enriched order/cart), each resolved from the send's `entityRefs` (the exact entity the automation
>   fired on, else recipient's most-recent for a broadcast), with `items[]` line collections + every `*Url`
>   (storeUrl/recoveryUrl/reviewUrl/payUrl/portalUrl) → real storefront routes. `applyEntitySnapshot` overlays the
>   flat trigger-time fields as a scalar fallback for a since-deleted entity. (e) **Dispatch tick** — builds the ref
>   from `entityRefs`, resolves data (incl. subject/preheader source-collection), interpolates subject + preheader,
>   sets the `ComplianceContext` (physical address + a real one-click unsubscribe URL) and the `List-Unsubscribe` /
>   `List-Unsubscribe-Post` headers when the tree carries an unsubscribe node. (f) **Executor** — `email.send_campaign`
>   stamps `entityRefs` + `entitySnapshot` on a designed send; `email.send_internal` interpolates its `{{token}}`s
>   inline against the trigger fields. (g) **Public one-click unsubscribe** — `email-unsubscribe.ts` (HMAC-signed
>   `(tenant,email)` token) + `GET/POST /v1/public/email/unsubscribe` → `marketing`-scope `EmailSuppression` (what
>   `enqueueSend` checks). (h) **`EMAIL_SOURCES`** (binding.ts) realigned to the §3 vocabulary. **Coordination
>   delivered to the template agent:** their provisional `node()` shapes are FINAL as authored (renderer consumes
>   them verbatim) → they can bundle the per-site `BuilderEmail` migration + `getPublishedByKey` + provisioning now.
>   Open joint step: send-by-KEY (my `defer.builderEmailKey` branch ↔ their `getPublishedByKey`, per-site fallback).
>   **Verify:** typecheck clean (builder-schemas/email/email-sends/automation-actions/api-rest); tests —
>   email-tokens **10/10**, render-email-tree **10/10** (incl. real `invoicing-overdue` e2e), builder-schemas
>   **70/70**, email-sends **4/4**, new api-rest `email-data` integration **4/4** (invoice hydrate w/ computed
>   overdueDays + items + payUrl; customer+tenant; selective load; snapshot fallback). NEW dep: automation-actions →
>   `@sparx/builder-schemas` (zod-only; Dockerfile COPY added).
> - **Step 3 — the 9 no-email seeds COMPLETE** (this session). The per-module seed catalog is now real per-module
>   files (`seeds/{crm,commerce,b2b,invoicing,chat}.ts`) wired into `SYSTEM_AUTOMATIONS`. The 9 that need NO email
>   template (so they ship now, ahead of the template-provision join): **CRM** — `auto-tag-vip` (daily scan, drops
>   out once tagged via `tags not_contains vip`), `new-lead-follow-up-task`, `deal-won-invoice-task`; **Commerce** —
>   `high-value-order-alert` + `low-inventory-alert` (internal sends), `refund-crm-note`; **B2B** — `new-account-task`
>   (+ the already-locked dunning); **Invoicing** — `estimate-approved-task` (user workflows,
>   `workflowSlug != net-terms-ar`); **Chat** — `no-response-alert` (interval scan, 10-min threshold). Three
>   cross-cutting executor extensions this required (docs/90 §3b): (a) **`create_task` dynamic assignee** — an
>   `assigneeField` path → explicit id → **tenant-owner fallback** (`resolveTenantActor`, also the creator since
>   `created_by` is NOT NULL); (b) **`send_internal` made platform-level** (`module: null` — fires without the email
>   module) + **dynamic `to`/`toField`** with the same owner-email fallback + **subject-only body**; (c) **`{{token}}`
>   interpolation in task titles / note bodies / internal subjects** via a shared `interpolateFields`. Thresholds (vip
>   $1000 / high-value $500) are baked literals a tenant edits on the Managed copy; added `conversation.assignedToEmail`
>   to the chat scanner. **Verify:** automation-actions **24/24** (new `seeds-no-email.test.ts` 6/6 — per-module install
>   + idempotency + locked dunning + assignee-from-rep + **owner fallback** + platform-level internal send w/
>   interpolated subject + threshold gating; `reconcile-seeds.test.ts` updated for the 2-seed B2B catalog); typecheck
>   + lint + format clean.
> - **NEXT — the 13 email seeds + compliance gate + provisioning + dashboard (Steps 4–6):** the email-SENDING seeds
>   (welcome / win-back / abandoned-cart / post-purchase-review / b2b-account-approved / b2b-quote-received /
>   b2b-quote-expiring / b2b-invoice-due / the 4 invoicing dunning / chat-satisfaction) wait on the **send-by-`key`
>   join** — the seeded `email.send_campaign` references a provisioned `BuilderEmail` by `key`, resolved at dispatch
>   via the email agent's `getPublishedByKey` (my `defer.builderEmailKey` branch). Then: the `emailType|category` field
>   on `send_campaign` + the DERIVED CAN-SPAM/CASL gate chain (consent via `Customer.gdprConsent`, unsubscribe-node
>   check, `EmailSettings.physicalAddress`); hook `module.activated` to seed automations (template-provision is the
>   parallel agent's); repoint the dashboard email-automations page to a filtered unified list (Step 5); extend the
>   nightly reconcile (Step 6). Steps 1–2 + early Step 3 committed locally by the user.
>
> ---
>
> **(prior)** **Slice G-versioning — DONE** (this session, uncommitted). Builder-style
> **draft → publish + immutable history** for the rule engine, plus the live drag verification of the
> G-UI v2 editor. **Key design (low-risk, additive): the existing automation columns REMAIN the
> currently-PUBLISHED (live) document the engine/ticks/SECURITY-DEFINER-scans already read** — so
> versioning touches NO execution path. Edits STAGE in a new `automations.draft` JSONB blob; "Publish"
> copies it into the live columns, bumps `version`, appends an immutable `automation_versions`
> snapshot, and clears the draft. Create auto-publishes v1 (every existing flow keeps working);
> every later edit is a real draft→publish cycle.
>
> - **Data model (migration `20260808000000_automation_versioning`, applied to docker, 0 drift):**
>   `automations` += `version`(default 1, DDL-default backfill — no RLS loop), `published_at/by`,
>   `draft` JSONB. New `automation_versions` table (immutable snapshots, own `tenant_id` + ENABLE/FORCE
>   RLS + `tenant_isolation`). `automation_runs` += `automation_version` (run-stamp). The
>   `find_active_scheduled_automations()` SECURITY DEFINER fn DROP+CREATE'd to also return `version`.
> - **Service (`@sparx/automation`):** `createAutomation`/`cloneAutomation` auto-publish v1 + snapshot;
>   `updateAutomation` now STAGES document edits in `draft` (status still applies live; a status-only
>   patch never fabricates a phantom draft); new `publishAutomation` / `discardDraft` /
>   `restoreAutomationVersion` (→ stages a snapshot back as the draft; history stays append-only) /
>   `listAutomationVersions` / `getAutomationVersion`; new `NoDraftError` + `AutomationVersionNotFoundError`.
>   `upsertSystemAutomation` sets `version: 1` on create only (locked system rules have no history UI).
> - **Engine run-stamp:** `handleTrigger` + `runScheduleTick` stamp `automationVersion` on run create.
>   The engine still executes the LIVE columns (= published def) — mid-run republish behavior documented
>   below.
> - **REST (`/v1/automations/:id/`):** `GET versions` · `POST publish` · `POST restore` · `POST
discard-draft`; `app.ts` maps `AUTOMATION_NO_DRAFT` (409) + `AutomationVersionNotFoundError` (404).
> - **MCP:** `update_automation` auto-publishes a document edit (AI edits go live, preserving prior
>   behavior); guarded so a status-only call never promotes a pending dashboard draft.
> - **Dashboard:** edit page loads the DRAFT if present; editor toolbar gains a **version pill**
>   (amber dot = unpublished), **Save draft** (stages) / **Publish** (promotes) / **History** (toggles
>   the right pane to the version list — `history-panel.tsx`; Restore + Discard, both confirm-guarded).
>   Detail page gains an "unpublished changes" banner + per-run `vN` stamp.
> - **Verified:** automation 46/46 + automation-actions 15/15 + automation-worker 6/6 (docker);
>   typecheck clean (`@sparx/automation`, `-schemas`, `api-rest`, `dashboard`); lint 0 errors; prettier ✓;
>   migration 0-drift. ⚠ `api-mcp`/`sitebuilder` typecheck fails on PRE-EXISTING errors from ANOTHER
>   agent's uncommitted multi-property `propertyId` schema work (08/47/49-\*.prisma) — unmasked by my
>   `prisma generate`, NOT this slice (my only schema change is 71-automation + the 02-tenant relation).
> - **Live drag verified (G-UI v2):** keyboard sensor (Space-lift → ArrowDown → Space-drop) AND
>   trusted-mouse stepped drag both reorder correctly against the authed dashboard — DragOverlay floats
>   the lifted card, `.ax-step--ghost` make-room placeholder, markers renumber, selection identity
>   follows the card. (Playwright `dragTo` / synthetic PointerEvents do NOT drive dnd-kit — needs
>   `page.mouse` stepped moves; recorded for future runs.)
>
> **⚠ Documented edge (no silent gap):** (1) the engine runs the LIVE published columns; a republish
> WHILE a run is mid-flight (e.g. parked on a wait) means that run continues on the new def from its
> cursor — acceptable (runs are short-lived; cursor past the new action count just completes early; the
> stamped `automation_version` records what was live at creation). (2) NO history backfill for
> pre-versioning automations — they read as `version 1` (DDL default) and start accumulating snapshots
> on their NEXT publish (the History panel shows "No published versions yet" until then).
>
> **NEXT (still user-sequenced, unchanged):** (1) the **Default Builder-emails library + per-tenant
> provisioning** (decision B — unblocks the email-driven CRM-sweep seeds; reconcile/retire the coded
> `@sparx/email-platform` DEFAULT_AUTOMATIONS) and (2) **Slice I — Phase 5 external** (Zapier/Make/inbound
> `webhook.received`). Commerce executors stay deferred (no product/variant resolver). The G-UI v2 +
> versioning editor wants a **live click-through of the publish/restore flow** against a running stack
> (backend is exhaustively unit/integration-tested; the UI is typecheck/lint-clean but not yet
> click-tested live — dev was closed this session).
>
> ---
>
> **(prior)** **Slice G-UI v2 — the builder was REDESIGNED into a map + inspector editor**, a sibling of
> the site/email Builder. `automation-editor.tsx`: a full-bleed two-pane shell — LEFT a **flow canvas**
> ("map") rendering the rule as a vertical WHEN → ONLY IF → THEN spine of node cards, RIGHT an
> **inspector** that edits the selected node, reusing `TriggerEditor` + `ConditionEditor`. **Top-notch
> drag-and-drop** for action steps (dnd-kit `DragOverlay` lift + make-room + auto-scroll; whole-card
> drag, 6px activation; keyboard Space-lift / Enter-select; live renumber), **insert-anywhere**, **canvas
> zoom** (50–150%, ⌘/Ctrl-wheel, persisted; overlay outside the scaled wrapper + sortable transform ÷
> zoom). New files under `.../automations/{_lib/flow.ts, _components/{flow-canvas,inspector,
inspector-primitives,action-config-editor,node-icons,history-panel,automation-editor}.tsx,
automation-editor.css}`. Now extended with the versioning toolbar/history above.
>
> **(prior)** **Slice G-UI — DONE.** The dashboard automations surface
> (`apps/dashboard/.../automations/*`) is built: **list** (status-filter chips + per-row module tags +
> run stats + inline enable/pause), **detail/review** (trigger + conditions + ordered actions, runs
> preview), the full **builder** (event/schedule trigger editor, **nested AND/OR condition editor** —
> mixed precedence like `A AND (B OR C)`, depth-bounded — and a drag-to-reorder ordered action editor
> with typed config fields + a JSON escape hatch), **run history + run detail** (per-step
> status, timing, input/output, and the `gate_log` audit trail), and a **platform-level nav tile**
> (rail + mobile). It is a pure CONSUMER of the G-API REST surface via Server Actions — **no api-rest or
> engine change**. The tier model shows up in the UI exactly as the service enforces it: a LOCKED rule
> offers only "Duplicate to edit" + View runs (no edit/pause/delete), and the edit route bounces a
> locked rule to its detail. **The automation engine is now complete end-to-end: tenant- AND
> AI-authorable across THREE surfaces (REST + MCP + dashboard), schedule/event-driven, sending email,
> seeding every module-active tenant, the sole dunning impl, and now fully observable.** Remaining
> tracked work, both still user-sequenced: (1) the **Default Builder-emails library + per-tenant
> provisioning** (user decision B — unblocks the email-driven CRM-sweep seeds; must reconcile/retire the
> coded `@sparx/email-platform` DEFAULT_AUTOMATIONS, not a third system) and (2) **Slice I — Phase 5
> external** (Zapier/Make/inbound `webhook.received`). **Commerce executors** stay deferred (no
> product/variant resolver, `create_invoice` collides with in-flight `billing_documents`, no consuming
> automation). Slices A–H + G-API + **G-UI** all done.
> **Slice H DONE** this session: `automationMcpTools` (9 tools — `list/get/create/update/clone/delete/
set_status` + `get_runs`/`get_run`) wrapping the SAME service layer, published by `services/api-mcp`;
> `read:automations`/`write:automations` scopes; LOCKED→error-result + "clone to edit" enforced over
> MCP exactly as REST; reachable on an `ai`-only tenant (platform capability, no feature module). ⚠ It
> ALSO unblocked TWO pre-existing latent bugs in `api-mcp` (both masked because the whole suite was
> dormant-red): (1) the vitest config lacked the `@vitejs/plugin-react` JSX transform `@sparx/email`'s
> raw `.tsx` needs (the documented api-rest PR#41 issue, never applied here) and (2) a **duplicate MCP
> tool name** — `get_top_customers` defined in BOTH `@sparx/crm` and `@sparx/commerce` — which made the
> SDK throw at registration so **the MCP server could not boot a single session**. Fixed both;
> renamed the commerce tool → `get_top_customers_by_revenue` (the date-ranged sales-report variant;
> CRM owns the lifetime-spend name). api-mcp suite now **12/12** (4 new automation + the unblocked
> smoke 5 + rate-limit 3). **G-API DONE** (prior session): `/v1/automations` REST surface + run-history
> reads + `automationErrorMapper`. **Slice F3 DONE** (b2b-overdue cron retired) and **F2 backfill DONE**.
> Slices A–D + **E1–E4** + **F1** (CRM 6 + B2B escalate + email send) + **F2-a (dunning)** + **F2
> backfill** + **F3** + **G-API** + **H (MCP)** all done. The engine can SEND email, SEEDS every
> module-active tenant (forward via activation, backward via the daily reconcile), is the SOLE dunning
> implementation, and is now **tenant- AND AI-authorable** (REST + MCP) over one service layer.
>
> **F2 backfill (this session):** SECURITY DEFINER `find_tenants_with_active_module(p_module)`
> (migration `20260805000000`, REVOKE PUBLIC / GRANT sparx_app) → `reconcileSystemSeeds(db)` in
> `@sparx/automation-actions` (distinct owning modules → scan module-active tenants → idempotent
> `seedSystemAutomations` per tenant) → worker `POST /internal/cron/reconcile-seeds` (same
> tick-auth) → a DAILY Cloud Scheduler job (`automation-reconcile-seeds`, 02:07 UTC, automation.tf).
> Self-healing: also covers any dropped `module.activated` event. Tests: automation-actions
> reconcile 2/2 (active-seeded / inactive-skipped + idempotent), worker route 2/2 (403 + authorized
> backfill). The seed/run gate still blocks execution for a tenant inactive at runtime, so seeding a
> later-disabled tenant is harmless. (Migration timestamp is `20260805000000` — bumped from an
> initial `20260804000000` that collided with a concurrent invoicing migration of the same stamp.)
>
> **F3 (this session) — b2b-overdue cron RETIRED.** ⚠ Surprise finding on inspection:
> `services/b2b-overdue-worker` was **dead code — never wired into deployment** (NOT in the
> build-images matrix, NOT in Terraform, NOT a k8s CronJob; the only deployed "overdue" cron is
> `crm-overdue-reminders`, an unrelated CRM-task sweep hitting api-rest). So the unified-engine
> dunning automation is the FIRST actually-deployed b2b dunning — there was no live double-notify to
> worry about, and no TF/CI/k8s to unwind. F3 = delete the dead service + refresh the lockfile +
> retire its now-stale comments. Parity is held by the engine's `b2b-escalation` test (4/4 — the
> same invoice→overdue / credit_hold@14d / suspended@30d / monotonic oracle); the only behavioral
> delta vs the old cron is its defensive `credit_used` resync, which F2-a already established is a
> no-op (escalation doesn't change the unpaid+overdue set credit_used sums). ⚠ If a
> `b2b-overdue-worker` Cloud Run was ever stood up MANUALLY (outside IaC), it would now be orphaned
> drift — worth a `gcloud run services list` check, but the code/IaC shows it was never deployed.
>
> **✅ Email-driven-seed CONTENT FORK — RESOLVED → (B) Builder-authored defaults** (user decision,
> 2026-06-11). System-seeded marketing emails (win-back, etc.) source content from **Builder-authored
> default emails** provisioned per tenant on email-module activation; the seed references them via
> `email.send_campaign` `defer`. NOT coded templates (A — a coded win-back can't render a working CTA;
> `BrandTokens` carry `storeName`/`logoUrl` but NO site URL, confirmed in `brand.tsx`) and NOT
> draft-until-configured (C). The _send mechanism_ is fully built; the content now depends on a NEW
> tracked slice → **Default Builder-emails library + per-tenant provisioning** (the user's "emails are
> vital and take users the most time — ship a solid default set with the email module"). So the
> unified-engine email seeds are **sequenced behind** that library slice (not started — user queued it
> as later work). See memory `project_email_defaults_builder_authored`.
>
> **⚠ Reconciliation finding (don't build a THIRD parallel system):** a coded email-automation system
> ALREADY exists — `@sparx/email-platform` `DEFAULT_AUTOMATIONS` (11 defaults: order-confirmed/shipped/
> delivered, cart-abandoned, **win-back**, welcome-customer, b2b-account-approved, quote-received,
> invoice-due/overdue) seeded by `automationService.provisionDefaults` on email activation, content via
> coded `templateKey`, with its OWN `evaluateTrigger` engine. Its win-back triggers on
> `crm.customer.inactive` — which has NO publisher (dead). The unified engine (docs/81/82) is meant to
> SUBSUME this. The Builder-defaults + unified-seed work must RECONCILE/retire the coded
> `DEFAULT_AUTOMATIONS`, not run a third path. `builderEmailService` already renders a Builder email
> node-tree (`BuilderNode`) with tenant-brand resolution — the render half exists; the default
> node-trees + the provisioning step do not.
>
> **(historical) F2-a (B2B dunning ladder) done** — the riskiest piece (docs/81 §3.1's canonical
> Locked behavior) is built, tested, and live-able on the schedule tick.
>
> **F2-a delivered:** a reusable `b2bEscalationService.escalateAccount` in `@sparx/crm` (the
> escalation logic that previously lived ONLY inline in `b2b-overdue-worker/cron.ts` — the
> "no reusable service" risk this log flagged, now closed); a `b2b_account` scanner + the
> `b2b.escalate_overdue` executor in `@sparx/automation-actions` (calls the service, publishes
> the same `b2b.*` notifications the cron did); a `seedSystemAutomations` catalog with the
> **Locked** dunning automation; and a 4/4 engine-path test mirroring the escalation parity
> oracle (invoice→overdue, account→credit_hold@14d / suspended@30d, monotonic). The worker
> already installs it (`installModuleActions` → `installB2bActions`); closure unchanged.
>
> **⚠ Fixed a pre-existing 8-table RLS bug en route** (migration `20260801000000`) — see the
> Slice F2 notes. b2b_invoices (+ 7 sibling b2b/import tables) had `current_setting(
'app.current_tenant_id')` (wrong GUC name, no missing_ok → THROWS under `sparx_app`). It
> blocked the dunning scan and is a latent prod bug for any `sparx_app` access to those tables.
>
> **Next:** (F2 wiring) call `seedSystemAutomations` per tenant. ARCH FORK: it must run where
> `module.activated` is published in-process → either an api-rest consumer (adds an
> api-rest → `@sparx/automation-actions` dep + Dockerfile closure) OR a worker-native reconcile
> pass (needs a cross-tenant "tenants with b2b active" SECURITY DEFINER scan) OR Slice E's
> Pub/Sub fan-in to the worker. Plus an existing-tenant backfill. (F2 cont.) the CRM-sweep +
> email-driven seeds (inactivity/win-back/quote-expiry/deal-closing) — these need the email
> executors (`email.send_campaign` / `send_internal`) first (F1 cont.). (F3) parity-check then
> DELETE the crons.
>
> **Slice E (event fan-in, docs/82) — DONE.** EVENT-triggered automations now fire live: every
> publish path tees to `automation.trigger`, the worker subscribes, and `module.activated` is
> actually published (the toggle routes). Was the prerequisite for the F2 seed wiring below.
>
> **⚠ Prod-correctness finding (Slice D):** the engine's cross-tenant tick scans
> originally assumed a BYPASSRLS `sparx_owner` connection. **Prod grants no ambient
> RLS bypass** (docs/16 §4, Decision F3 — even `sparx_owner` is non-superuser and
> FORCE-RLS-bound). A plain cross-tenant `findMany` would return **zero rows in
> prod, silently** (no automation ever runs, no error). Fixed in this slice — see
> the Slice D notes.

---

## 1. Build sequencing (and why it inverts docs/81 §12)

docs/81 §12 lists **Phase 0 (event substrate) first** because the engine can't
_receive live triggers_ without the `automation.trigger` fan-in. That ordering is
about going **live**, not about **building**. The engine's machinery (resolver,
condition evaluator, gate layer, action executor, run state machine, idempotency,
loop-guard) is fully buildable and testable by feeding it **synthetic** envelopes —
it does not need the fan-in to exist yet.

So the build order front-loads the self-contained, testable core and **defers the
Phase-0 fan-in surgery** (which touches three shared publish paths + Terraform,
the highest cross-agent-collision risk) until the engine exists to validate it:

1. **Slice A — schemas** (`@sparx/automation-schemas`) — net-new, zero collision.
2. **Slice B — data model** (Prisma + RLS migration) — net-new tables.
3. **Slice C — engine core** (`@sparx/automation`) — registries, evaluator, gates,
   executor, run state machine, service layer. Tested against docker DB with
   synthetic events.
4. **Slice D — worker** (`services/automation-worker`) — Cloud Run push + tick.
5. **Slice E — Phase 0 event substrate** (docs/82) — canonical registry, fan-in
   topic + 3 tees, `[ADD]` events, Terraform, parity test. Wires the engine live.
6. **Slice F — Phase 2** — seed system automations, parity-check, retire the crons.
7. **Slice G — Phase 3 UI** · **Slice H — Phase 4 AI** · **Slice I — Phase 5 external**
   · **Slice J — Phase 6 advanced**.

Trigger-type strings in the catalog reference existing event-type literals; Slice E
reconciles them into the one canonical registry. No build blocker from deferring E.

### Package / service inventory (what this feature introduces)

| Artifact                                                    | Purpose                                                                                                                                                                                     | Status |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `packages/automation-schemas` (`@sparx/automation-schemas`) | Zod schemas + types (trigger/condition/action/automation/gate)                                                                                                                              | ☑      |
| `packages/automation` (`@sparx/automation`)                 | Engine: registries, evaluator, gates, executor, run state machine, service layer                                                                                                            | ☑      |
| `packages/automation-actions` (`@sparx/automation-actions`) | Module executors + scanners + seed catalog (composition root) — calls existing services via `registerAction`. CRM + B2B + email-send done; email sequence + commerce pending                | ◐      |
| `packages/email-sends` (`@sparx/email-sends`)               | Lean email enqueue primitive (`enqueueSend`: suppression + `ScheduledSend` write). `@sparx/db` only — NO render/React deps, so the worker can enqueue without the email-platform UI closure | ☑      |
| `packages/crm` `b2bEscalationService`                       | Reusable per-account dunning ladder (extracted from the cron); publisher-agnostic, tx-aware                                                                                                 | ☑      |
| `packages/db` RLS GUC fix (`20260801000000`)                | Corrects 8 b2b/import tables' `tenant_isolation` policy (`app.current_tenant_id` → `current_tenant_id()` + WITH CHECK)                                                                      | ☑      |
| `packages/modules` (`@sparx/modules`)                       | Module-enablement primitives (extracted from `@sparx/auth` so lean backends probe flags without the auth/email/UI closure)                                                                  | ☑      |
| `services/automation-worker`                                | Cloud Run: Cloud Scheduler tick (schedule + run advance) + push consumer on `automation.trigger`                                                                                            | ☑      |
| `packages/db` scan helpers                                  | `find_due_automation_runs` / `find_active_scheduled_automations` SECURITY DEFINER (cross-tenant discovery)                                                                                  | ☑      |
| `packages/db` backfill scan (`20260805000000`)              | `find_tenants_with_active_module(p_module)` SECURITY DEFINER — discovers module-active tenants for the seed reconcile pass                                                                  | ☑      |
| `reconcileSystemSeeds` + worker reconcile endpoint          | Daily backfill: seed system automations for already-module-active tenants (`POST /internal/cron/reconcile-seeds` + Cloud Scheduler `automation-reconcile-seeds`)                            | ☑      |
| `terraform/envs/prod/automation.tf`                         | Cloud Run service + Cloud Scheduler tick job + runtime/scheduler SAs (push sub deferred to E)                                                                                               | ☑      |
| `packages/db` (3 tables)                                    | `automations` / `automation_runs` / `automation_run_steps` + RLS                                                                                                                            | ☑      |
| `services/api-rest` routes                                  | `/v1/automations` CRUD + clone + status + run-history reads (trigger/tick live in the worker, not api-rest)                                                                                 | ☑      |
| `packages/automation` run reads                             | `listAutomationRuns` / `getAutomationRun` (tenant-scoped run-history read path for REST/MCP/UI)                                                                                             | ☑      |
| `apps/dashboard` surface (`/automations/*`)                 | List / detail / builder / run history (docs/34 standard) — platform-level full-page routes, pure consumer of the G-API REST surface via Server Actions                                      | ☑      |
| `packages/automation/src/mcp` (`automationMcpTools`)        | AI authoring path — 9 MCP tools wrapping the service layer; published by `services/api-mcp` (mirrors crm `mcp/`). `read:automations` / `write:automations` scopes                           | ☑      |

---

## 2. Phase checklist (mirrors docs/81 §12, annotated with build reality)

### Slice A — `@sparx/automation-schemas` ☑

- ☑ Package scaffold (package.json, tsconfig, vitest, eslint inherited)
- ☑ Trigger schema (event vs schedule kinds; `triggerToColumns`/`triggerFromColumns`)
- ☑ Condition / ConditionGroup schema (operators, AND/OR — docs/81 §5.3)
- ☑ Action schema (typed `type` + opaque `config`; per-action config validated at dispatch)
- ☑ Gate-decision + run/step status shapes (allow/deny/transform/defer; `gate_log` — §7.1)
- ☑ Automation CRUD input schemas (create/update/clone; origin/locked system-managed)
- ☑ Barrel + schema-validation unit tests (7/7 green)
- ☐ Wire into Dockerfiles of consumers as they appear (footgun: COPY lines)

> **zod v4 gotcha (learned here):** a bare `z.unknown()` is **non-optional** — a
> missing key errors before any `.refine` runs. Use `z.unknown().optional()` for
> truly-optional unknown values. Also: `.superRefine` + `ctx.addIssue` was a
> silent no-op in this setup; `.refine((v) => boolean, {path})` is reliable.

### Slice B — data model ☑

- ☑ Prisma models `Automation` / `AutomationRun` / `AutomationRunStep` (`71-automation.prisma`)
- ☑ Hand-authored migration `20260730000000_automation_engine` — tables + `ENABLE`+`FORCE`
  RLS + `tenant_isolation` on all three (`tenant_id` on run_steps); `UNIQUE(automation_id,
dedupe_key)`. DDL generated Prisma-exact via `migrate diff` then RLS hand-appended.
- ☑ RLS form: `current_tenant_id()` + `WITH CHECK` (per push_subscriptions), quoted idents.
- ☑ Tenant relations declared on all 3 (3 inverse fields added to `Tenant` in `02-tenant.prisma`).
- ☑ Applied to docker (`migrate deploy`, 89/89), drift-check shows **0 automation drift**,
  client regenerated, `@sparx/db` typecheck clean.
- ☑ Indexes incl. owner-scoped tick scan `(status, resume_at)`.

> **Note — pre-existing repo index-name drift:** `migrate diff` reports ~dozens of cosmetic
> `ALTER INDEX … RENAME` lines for OTHER tables (hand-authored short names vs Prisma's
> auto names). Not ours — the 3 automation tables used Prisma-exact names → 0 added drift.
> A repo-wide cleanup is a separate sweep, out of scope here.

### Slice C — engine core (`@sparx/automation`) — Phase 1 ☑

- ☑ Trigger/entity resolver registry (event resolvers + schedule scanners; `registerResolver`/`registerScanner` seam; built-ins for customer/deal/order + customer scanner)
- ☑ Condition evaluator (all 12 operators, AND/OR, numeric/date coercion, against resolved fields) — pure, unit-tested
- ☑ **Gated dispatcher** — only path to an effect; global chain (tenant-active, kill-switch, module-active) + per-action manifest (empty must carry a justifying note — enforced at registration); `GateResult` allow/deny/transform/defer; coverage test (§7.1)
- ☑ Action registry + built-in executor (`platform.webhook` w/ egress SSRF gate) + `registerAction` seam for module executors; `platform.wait`/`platform.stop` are run-loop control flow
- ☑ `handleTrigger` — match active automations, loop-guard (`__automationDepth` vs `max_depth`), hydrate, eval, idempotent upsert (`dedupeOf`)
- ☑ `runAutomationTick` — advisory-lock (`4242_4250`) cross-tenant scan on owner conn; per-step transaction (durable: step N commits before N+1); cursor advance, durable `wait`, gate `defer` park, fail-stop
- ☑ `runScheduleTick` — `(schedule, predicate)` scan → one run per matched row; window-scoped dedupe; UTC cadence arithmetic (daily/weekly/monthly/once)
- ☑ Service layer — CRUD + `setAutomationStatus` + clone ("Duplicate to edit") + `upsertSystemAutomation` seed; **locked** tier rejects edit/status/delete; origin/locked system-managed
- ☑ Run + per-step history logging (`completed`/`gated`/`failed`/control; `gate_log` audit trail; `completeRun`/`failRun`)
- ☑ Integration tests against docker (35/35: 12 engine end-to-end incl. idempotency/wait/fail-stop/gated/transform/defer/kill-switch/SSRF + schedule, 9 service, 14 unit)

> **Decisions logged in Slice C:**
>
> - **Engine envelope is `TriggerEnvelope` (`type: string`)**, not the strict `SparxEvent`
>   `EventType` union — the engine handles `schedule.*` + the docs/81 §5.2 `[ADD]`
>   trigger types not yet in the canonical registry. `SparxEvent` is assignable to it;
>   Slice E reconciles the registry.
> - **Module action executors (crm/email/commerce/b2b) register via the `registerAction`
>   seam in a later slice**, where the engine is wired with those service packages — keeps
>   `@sparx/automation` deps lean (`@sparx/db` + `@sparx/events` + schemas). Slice C ships
>   the platform-level `platform.webhook` as the one real built-in effect; the integration
>   suite exercises the machinery via stand-in executors registered through the same seam.
> - **`dispatch` throws `UnregisteredActionError` for an unwired action** — a loud failure,
>   never a silent no-op (so a not-yet-registered module action is visible, not skipped).
> - **Skips are log-only in Slice C** (condition-not-met / max-depth don't persist a run row),
>   to avoid row explosion on high-volume events; persisted "evaluated, didn't match" history
>   is a UI-slice (G) concern.
> - **Per-step transactions, not per-run** — the durable property (a redeploy resumes mid-run,
>   never replays a committed step) requires each step to commit independently; wrapping a
>   whole run in one tx would roll back earlier committed steps on a later failure.

### Slice D — `services/automation-worker` ☑

- ☑ Tick endpoint `POST /internal/cron/tick` (Cloud Scheduler) → `runScheduleTick` then `runAutomationTick` — **this alone makes scheduled system automations live; no event fan-in needed**
- ☑ Cloud Run push handler `POST /` → `handleTrigger` (wired + tested; goes live once Slice E provisions the `automation.trigger` subscription)
- ☑ `env.ts` (sparx_app DATABASE_URL — NO owner conn), `runtime.ts` (engine deps + `runTick`/`ingest`), side-effect-free `server.ts` + thin `index.ts`, `Dockerfile` (COPY closure: automation + automation-schemas + db + events), `.env.example`
- ☑ End-to-end integration test (4/4) driving the REAL HTTP server against docker **as `sparx_app`**: push → run enqueued → tick → completed; tick-auth 403; non-trigger ack
- ☑ Terraform `automation.tf`: Cloud Run service + per-minute Cloud Scheduler job (OIDC) + runtime SA + scheduler-invoker SA; `cloudscheduler.googleapis.com` added to bootstrap; `terraform validate` + `fmt` clean
- ☑ CI: `automation-worker` added to `build-images.yml` matrix + the `gcloud run services update` loop in `deploy-prod.yml`
- ⃠ **Module action executors (crm/email/commerce/b2b) deferred to Slice F** — you can't register an executor that doesn't exist yet; wiring lands with the executors + the seeded automations that use them. The worker registers `platform.webhook` + the control-flow built-ins now.
- ⃠ **Pub/Sub push subscription deferred to Slice E** — the `automation.trigger` topic + 3 publish-path tees are Slice E. The IAM `run.invoker` for the pubsub invoker SA + the subscription stub are pre-placed in `automation.tf`.

> **Decisions logged in Slice D:**
>
> - **CROSS-TENANT DISCOVERY VIA `SECURITY DEFINER`, NOT A BYPASSRLS CONNECTION.**
>   Slice C's ticks did a plain cross-tenant `automationRun.findMany` /
>   `automation.findMany`, assuming the worker connects as a BYPASSRLS
>   `sparx_owner` (the run-tick header even said so). **That is wrong for prod:**
>   docs/16 §4 (Decision F3) grants NO ambient RLS bypass — prod `sparx_owner` is
>   a non-superuser, FORCE-RLS-bound, and sees **0 rows** on a tenant table without
>   a GUC (the documented backfill footgun). The tick would have returned zero due
>   runs in prod **silently** — every automation dead, no error. Fixed by mirroring
>   the existing, prod-proven `find_due_scheduled_entries` /
>   `find_pending_webhook_deliveries` pattern: migration `20260731000000` adds
>   `find_due_automation_runs(p_limit)` + `find_active_scheduled_automations()`
>   SECURITY DEFINER (owned by `sparx_owner`, granted `sparx_app`); the ticks call
>   them for DISCOVERY only, then drive each run/automation under `withTenant`
>   (RLS-scoped). The worker connects as **`sparx_app`** via the existing
>   `database-url` secret — no owner secret, no new BYPASSRLS role.
> - **Tests now run the ticks through a real `sparx_app` (NOBYPASSRLS) client**
>   (`appDb` in `test/helpers.ts`), with setup/asserts on `ownerDb`. Local
>   `sparx_owner` is a superuser, so running ticks on it would MASK exactly the
>   bug above; `appDb` exercises the prod RLS boundary honestly. 35/35 still green.
> - **Tick auth = OIDC (prod) OR internal-cron token (local/manual).** Cloud
>   Scheduler authenticates with an OIDC token as a dedicated
>   `sparx-automation-scheduler` SA (run.invoker on the service); the worker also
>   checks the `email` claim against `TICK_INVOKER_SA`. This keeps the shared cron
>   secret OUT of the scheduler-job config/TF state. The token path remains for
>   local `curl` + manual invocation.
> - **Schedule tick THEN run tick, in one tick** — a run the schedule tick just
>   enqueued advances in the same invocation rather than waiting a full interval.
> - **First-deploy ordering:** the new image must exist before `terraform apply`
>   creates the Cloud Run service (it pins `:latest`). Sequence: push to `main`
>   (build-images builds `automation-worker`) → bootstrap-apply (enables
>   `cloudscheduler`) → platform-apply (creates service + scheduler) →
>   deploy-prod (rolls the real tag). Same bootstrapping every Cloud Run worker used.

### Slice E — Phase 0 event substrate (docs/82) ☑

**E1 — canonical registry ☑**

- ☑ `@sparx/events` is now the single superset (`+module.activated/deactivated`,
  `search.reindex.requested`, `chat.message.received`, `push.send` — the api-core-only events
  folded in). `api-core/pubsub.ts` deleted its local `EventType` union and re-exports the
  canonical one (type-only ⇒ no runtime dep; every service that COPYs api-core already COPYs
  `@sparx/events`, so zero Dockerfile-closure risk). Full workspace typecheck 35/35.

**E2 — fan-in topic + subscription ☑**

- ☑ `automation.trigger` topic (main.tf) + a Cloud Run **push** subscription
  (`automation.trigger.automation-worker` in automation.tf) → the worker's `POST /`, OIDC as
  `pubsub_invoker`, DLQ after 5 attempts. The worker is the SOLE subscriber. `terraform
validate` clean. (`module.activated`/`deactivated` topics already existed — empty-subscriber.)

**E3 — fan-in tee ☑**

- ☑ Tee installed in all THREE publish paths: `@sparx/events` `CloudPubSubPublisher`, api-core
  `CloudPubSubPublisher`, and the CRM bridge's BOTH bus wrappers (`CrmPubSubPublisher` for
  `crm.*` + `PubSubTeePlatformBus` for `order.*` — the two-bus footgun, docs/82 §3.3). Shared
  `teeToFanIn` helper (`@sparx/events/fan-in`); inlined in the CRM bridge to keep `@sparx/crm`
  off an `@sparx/events` dep. Carries `__automationDepth` from the envelope (default 0) for the
  loop-guard. Unit test 3/3; best-effort (a tee failure never fails the per-type publish).

**E4 — `module.activated` publish + consumers ☑**

- ☑ **automation-worker** dispatches `module.activated` → `seedSystemAutomations({tenantId},
{module})` (a provisioning signal, not a trigger). `seedSystemAutomations` filters the catalog
  by the activated module. So once `module.activated` is published, the worker seeds the dunning
  automation via the fan-in — no second subscription.
- ☑ **Publish lynchpin** — `routes/v1/tenant.ts` `announceModuleTransition(log, tenantId, actorId,
slug, enabled)` publishes `module.{activated,deactivated}` to BOTH buses: api-core `publish()`
  (→ per-type Pub/Sub topic + webhook enqueue + fan-in tee → worker) and `publishPlatformEvent()`
  (→ in-process bus → CRM/Email consumers, awaited so seeding completes before the route returns).
  Wired into BOTH the per-slug `PATCH` and the bulk `PUT /v1/tenant/modules` (onboarding modules
  step), **transition-gated** (fires only on an actual on/off change). Idempotent consumers make a
  redundant announce harmless.
- ☑ **CRM** in-process consumer was already wired (`registerModuleActivationConsumers`) — now
  actually driven by the publish above (it was dead before: no publisher existed).
- ☑ **Email** in-process consumer — `services/api-rest/src/lib/email-module-activation.ts`
  (`registerEmailModuleActivationConsumer`, wired in `index.ts`): on `module.activated` for
  `email`, calls `automationService.provisionDefaults`. Lives at the api-rest composition root
  (not in `@sparx/email-platform`) because the platform bus is owned by `@sparx/crm` and email
  must not depend on CRM. Unit test 2/2 (mock email service + real in-memory bus; CI-safe, no DB).
- ☑ **Dashboard cleanup** — the redundant `POST /v1/crm/bootstrap` follow-up in
  `settings/modules/actions.ts` is removed (the toggle's publish seeds CRM synchronously now). The
  `/v1/{crm,email}/bootstrap` ENDPOINTS stay as idempotent admin escape hatches (the email one is
  also a deliberate user button on the email-automations page — untouched).

**Verification:** my files typecheck clean (the only `tsc` errors in api-rest are 3 stale-Prisma-
client `BillingDocument*`/`Document*` refs from ANOTHER agent's uncommitted invoicing schema,
ungenerated because of the Windows `query_engine.dll` lock — not from this work; clear on next
`prisma generate`). Lint 0, prettier clean. Tests: email consumer 2/2, CRM `pubsub-bridge` 6/6.

**Parity test ⃠** — a strict `EventType` ↔ topics parity is NOT cleanly achievable yet: the
canonical union carries many aspirational events (b2b._, dropship._, subscription._) with no
topic, and the topics map has bridge names (`order.created`, `crm.customer._`, `domain.verified`)
absent from the union. A meaningful parity test needs the full union↔topic reconciliation
(rename bridge topics, represent `crm.\*` in the union) — a separate sweep, logged here so it
isn't silently skipped.

### Slice F — module executors + seed + retire crons ◐

**F1 — module action executors ◐ (CRM + B2B + email send done; email sequence\_\* + commerce pending)**

- ☑ `@sparx/automation-actions` package (the module-effect composition root) — keeps the
  engine lean; the worker calls `installModuleActions()` at boot.
- ☑ **6 CRM executors** — `crm.add_tag` / `remove_tag` / `add_note` / `update_field` /
  `create_task` / `update_deal_stage`, each CALLING `@sparx/crm/services` (never
  re-implementing). 7/7 e2e green: trigger → match → resolve → gated dispatch → executor →
  real CRM service → DB effect, run on the `sparx_app` client.
- ☑ **B2B `escalate_overdue` executor + `b2b_account` scanner** — calls the new reusable
  `b2bEscalationService.escalateAccount`, then publishes the same `b2b.invoice.overdue` /
  `b2b.account.credit_hold` / `b2b.account.suspended` events the cron emitted (on the
  `@sparx/events` bus via `ctx.deps.publisher`). The scanner resolves per-account
  `hasOverdueInvoices` / `maxDaysPastDue` / `utilization` (one aggregate query), so the dunning
  predicate AND a future credit-utilization predicate both read off it.
- ☑ Worker wiring: `installModuleActions()` (now CRM + B2B) + `installCrmPubSubBridge()` at boot;
  closure UNCHANGED (b2b lives in `@sparx/crm` + `@sparx/automation-actions`, both already
  COPY'd; `@sparx/events` promoted dev→prod dep but already in the closure).
- ☑ **2 email executors — `email.send_campaign` + `email.send_internal`** (`automation-actions/src/email.ts`,
  `installEmailActions`). Both PUBLISH a send (never direct-deliver, docs/81 §5.4): they call
  `enqueueSend`, which writes a `ScheduledSend` (`automationId: null`) that the api-rest `email-dispatch`
  tick turns into an `email.send`. `send_campaign` is a customer-addressed marketing send — recipient
  is the trigger's `customer.email`, skips a do-not-contact contact, body is a published Builder email
  (`defer`, personalized at dispatch) OR a coded template. `send_internal` is a staff notification (raw
  body, transactional scope, configured `to`).
  - **⚠ Closure decision (changed from the original plan):** `@sparx/email-platform` pulls in
    `@sparx/email` + `@sparx/ui` + `lucide-react` + React (peer) — importing it into the worker would
    blow up the deliberately-lean image (its Dockerfile is proud of "no React/UI/auth"). So instead of
    `automationService.enqueueSend`, the enqueue primitive lives in a NEW lean **`@sparx/email-sends`**
    (deps: `@sparx/db` only — no render libs): `enqueueSend(ctx, spec)` = suppression-check +
    `scheduledSend.createMany({skipDuplicates})`. The executor calls it; the worker COPYs only
    `packages/email-sends`. The render half stays in api-rest's dispatch tick (which has the email/builder
    libs). This still honors "executors call a service" while keeping the worker React-free.
  - Recipient/flag reads off the resolved `fields` via `entity.ts` (`requireStringField` for
    `customer.email`, `optionalBoolField` for `customer.doNotContact`). `installEmailActions()` wired into
    `installModuleActions()`; worker closure now 10 packages (added `email-sends`).
  - **Tests (docker DB):** `@sparx/email-sends` enqueue 4/4 (enqueue/payload/dueAt, marketing
    suppression skip, transactional-through-marketing-suppression, dedupe idempotency — on the sparx_app
    FORCE-RLS client); `automation-actions` email engine-path 2/2 (event → handleTrigger →
    runAutomationTick → ScheduledSend for `customer.email`; do-not-contact skip). Suite 13/13.
- ⃠ `email.sequence_add` / `email.sequence_remove` — DEFERRED (aspirational, like the schema notes):
  NO email-sequence/drip subsystem exists in `@sparx/email-platform`, so these aren't an
  executor-over-existing-service — they'd require building the whole sequence-membership system first.
- ⃠ Commerce executors (`commerce.*`) — DEFERRED (not cleanly buildable yet, verified 2026-06-11): the
  resolver catalog has `order` but **no product/variant** resolver, so `commerce.update_inventory` has
  no trigger entity to read; `commerce.create_invoice` collides with the in-flight `billing_documents`
  work (no stable invoice service to call); `commerce.create_order` has no trigger semantic or consumer;
  `commerce.apply_discount` has no crisp spec (discount-code vs store-credit grant). None has a
  consuming automation. Building them now would be partial — revisit once a product/variant resolver +
  a concrete consuming automation exist.

**F2 — seed system automations ◐ (dunning + backfill done)**

- ☑ **B2B dunning ladder → Locked system automation** (`seedSystemAutomations` catalog). 4/4
  engine-path test mirrors the parity oracle: invoice→overdue, account→credit_hold@14d /
  suspended@30d, reminder event on fresh-overdue, monotonic on re-run. Schedule-tick-driven —
  live without Slice E.
- ☑ **Seed wiring — LIVE via Slice E** (the ARCH FORK resolved to "Slice E fan-in"). The toggle
  routes publish `module.activated` → fan-in → worker `ingest()` → `seedSystemAutomations({tenantId},
{module})`. So activating B2B now seeds the dunning automation for that tenant automatically.
- ☑ **Existing-tenant backfill** — `find_tenants_with_active_module(p_module)` SECURITY DEFINER scan
  (migration `20260805000000`) → `reconcileSystemSeeds(db)` (distinct owning modules → scan →
  idempotent `seedSystemAutomations` per tenant) → worker `POST /internal/cron/reconcile-seeds`
  (tick-auth) → daily Cloud Scheduler `automation-reconcile-seeds`. Covers pre-engine tenants AND
  self-heals a dropped `module.activated`. Tests: reconcile 2/2 (active-seeded / inactive-skipped +
  idempotent), worker route 2/2. A null-module (always-on) seed would need an all-tenants scan — none
  exist; the reconcile warns loudly if one is added so the gap isn't silent.
- ☐ Re-express CRM sweep (inactive/win-back/high-value/deal-closing/credit-near-limit/quote-expiry) —
  the _send mechanism_ is built (customer scanner + `email.send_campaign`). CONTENT FORK RESOLVED → (B)
  Builder-authored defaults, so this is **sequenced behind the Default Builder-emails library** (next
  bullet): the seed references a provisioned default Builder email via `defer`. Don't ship a system
  seed that enqueues sends with no working CTA.
- ☐ Seed remaining default Managed automations (abandoned-cart, win-back, fulfilled→review) — same
  dependency on the Builder-emails library.
- ☐ **NEW TASK (user-queued 2026-06-11) — Default Builder-emails library + per-tenant provisioning.**
  Author a solid starter set of default **Builder emails** (node-trees) and provision them per tenant
  on `module.activated(email)` (their theme, fully editable); these become the content source the
  unified-engine email seeds `defer` to. **Must reconcile/retire the existing coded
  `@sparx/email-platform` `DEFAULT_AUTOMATIONS`** (see the RESUME reconciliation finding) — not a third
  parallel system. Render half exists (`builderEmailService` → `renderEmailTree` with brand); the
  default node-trees + provisioning step do not. Its own design+build slice (memory
  `project_email_defaults_builder_authored`).

**F3 — retire crons ☑ (b2b-overdue gone)**

- ☑ **`services/b2b-overdue-worker` DELETED.** ⚠ It turned out to be **dead code — never wired into
  deployment** (absent from the `build-images.yml` matrix, from Terraform, and from `k8s/cronjobs`;
  the only deployed "overdue" cron is `crm-overdue-reminders`, an unrelated CRM-task sweep). So the
  unified-engine dunning automation is the FIRST actually-deployed b2b dunning — F3 needed NO TF/CI/
  k8s changes and there was never a live double-notify. Parity is held by the engine's
  `automation-actions/test/integration/b2b-escalation.test.ts` (4/4 — same invoice→overdue /
  credit_hold@14d / suspended@30d / monotonic oracle the deleted `b2b-overdue-worker/escalation.test.ts`
  asserted). Only behavioral delta: the cron's defensive `credit_used` resync, a no-op per F2-a
  (escalation never changes the unpaid+overdue set credit_used sums). Lockfile refreshed (workspace
  globs `services/*`); stale "the cron does X / until retired" comments in `b2b-escalation-service.ts`
  - `automation-actions/src/b2b.ts` retired to past tense.
- ☐ (residual) No other cron retired yet — `crm-overdue-reminders` (k8s CronJob → api-rest) still
  drives CRM task reminders via the email-automation path; re-expressing it on the unified engine is
  a later F-slice, not part of this dunning retirement.

> **Decisions logged in Slice F1:**
>
> - **Executors CALL services, never re-implement (locked decision).** Each CRM executor
>   builds a `{ tenantId }` ctx and invokes `customerService.bulkTag` / `taskService.create`
>   / `dealService.moveStage` / etc. The service owns its own `withTenant` transaction, audit
>   row, and the published `crm.*` event (incl. the two-bus fan-out) — so events/audit happen
>   exactly once, at the source. The executor only maps `config` + the resolved trigger entity
>   (`fields['customer.id']` / `['deal.id']`) onto the call.
> - **Effect is ATOMIC with the step record (tx-injection — FIXED 2026-06-11).** Originally the
>   executor's service write committed in its OWN transaction, separate from the engine's
>   per-step commit (execute-then-record, at-least-once — so `create_task`/`add_note` could
>   duplicate on an ungraceful crash mid-step). Fixed: `TenantContext` gained an optional `tx`
>   and `withTenant` composes into it instead of opening a nested transaction; the executor
>   passes `ctx.tx` (the engine's per-step tx) to the CRM service, so the effect + the
>   `automation_run_steps` row + the cursor advance all commit as ONE unit. A crash now either
>   rolls back everything (resume re-runs cleanly) or commits everything (resume continues) —
>   no duplicate effect. Only the `crm.*` event publish stays outside the tx (it's a Pub/Sub
>   network call — inherently at-least-once, dedupe-keyed + consumers idempotent; a spurious
>   event on the rare crash-rollback is self-healing). The change to `withTenant` is opt-in
>   (the `tx` branch only triggers when a caller passes one) — default path unchanged; verified
>   by the full CRM suite (82/82) + RLS isolation.
> - **`create_task` needs a user** — `createdByUserId` is NOT NULL and a system automation has
>   no actor, so the action config's `assignedToUserId` doubles as the creator.
> - **Missing required entity field → loud `failed` step** (not a silent no-op): an action wired
>   to an entity its trigger can't resolve (e.g. a customer tag on a customer-less deal event)
>   throws, recording a `failed` step.
> - **`@sparx/crm` slimmed so the worker stays lean (FIXED 2026-06-11).** `@sparx/crm` had only
>   TWO things pulling its heavy deps: `manifest.ts` (a dashboard UI manifest — the only
>   `@sparx/ui`/`lucide-react`/React importer) and the event consumers' use of `@sparx/auth`'s
>   `isModuleEnabled`/`invalidateModuleCache` (which dragged in `auth → email → cms-editor`).
>   Both were misplaced. Fix: (1) `manifest.ts` → `apps/dashboard/.../crm/manifest.ts` (mirrors
>   the email-platform manifest split); (2) the session-free module-gate core → new
>   **`@sparx/modules`** package (deps: just `@sparx/db`); `@sparx/auth` re-exports it for its
>   ~40 importers (zero blast radius), `requireModule(session)` stays in auth. `@sparx/crm` now
>   deps = pubsub + commerce-schemas + crm-schemas + db + modules + zod — **no auth/ui/email/
>   cms-editor/react**. Worker COPY closure: **15 → 9 packages, no React**. Verified: db /
>   modules / auth / crm / dashboard / api-rest typecheck + crm 82/82 green.

> **Decisions logged in Slice F2 (B2B dunning):**
>
> - **Escalation logic extracted to a reusable service, NOT left inline.** The dunning ladder
>   lived only in `b2b-overdue-worker/cron.ts` (the "no reusable service" risk this log flagged).
>   It now lives in `b2bEscalationService.escalateAccount` (`@sparx/crm`), which the executor
>   calls. The cron can delegate to it until F3 retires it — no third copy.
> - **Per-account, not per-tenant batch.** The cron did one tenant-wide bulk UPDATE; the engine
>   runs one resumable run per scanned account, so the service escalates a SINGLE account. Same
>   observable outcome (every account with past-due invoices is processed), smaller commits.
> - **Service is publisher-agnostic; the executor publishes.** `escalateAccount` does pure DB
>   work and RETURNS the transition + freshly-overdue invoices; the executor emits the `b2b.*`
>   events on `@sparx/events` (via `ctx.deps.publisher`). Pushing those topics into a CRM service
>   that only knows the CRM two-bus would cross a bus boundary — and keeping it pure lets the
>   cron reuse the same method. The escalation commits atomically with the run-step (tx-injection:
>   the executor passes `ctx.tx`).
> - **The ladder lives in the action, not in conditions.** 14d→credit_hold / 30d→suspend are a
>   Locked credit INVARIANT (monotonic, two different effects), so they're encapsulated in
>   `escalateAccount` with the thresholds exposed as action config (a cloned Managed copy can
>   retune them). The predicate is just `hasOverdueInvoices = true` (the scan selector).
> - **escalation does NOT touch `credit_used`.** Marking an invoice unpaid→overdue keeps it in
>   the (unpaid,overdue) set credit_used sums, so the total is unchanged — the cron's defensive
>   resync was a no-op for the amount. credit_used stays an invoice-create/pay invariant.
>
> **⚠ Pre-existing RLS bug fixed en route (migration `20260801000000_fix_b2b_import_rls_guc`):**
> Eight tables — `b2b_invoices`, `b2b_account_contacts`, `purchase_approval_rules`,
> `b2b_pricing_tiers`, `b2b_tier_product_overrides`, `b2b_account_product_overrides`,
> `import_jobs`, `import_job_rows` — had `tenant_isolation USING (tenant_id =
current_setting('app.current_tenant_id')::uuid)`. That GUC name is **wrong** (`withTenant` sets
> `app.tenant_id`) AND lacks the `missing_ok` flag, so `current_setting` THROWS
> `unrecognized configuration parameter` rather than yielding "no rows" when the GUC is unset.
> Every prod path is affected: `sparx_app` always (FORCE RLS), and prod `sparx_owner` too
> (non-superuser, FORCE-bound — Decision F3). It went unnoticed because the only consumers so far
> ran as LOCAL `sparx_owner` (a superuser that bypasses RLS) — exactly the masking trap Slice D
> called out. The b2b dunning scan (reads `b2b_invoices` as `sparx_app` under `withTenant`) was
> the first path to hit it. Fix recreates all 8 policies in the canonical `current_tenant_id()`
> form + adds `WITH CHECK`. Applied to docker (91 migrations, 0 drift); ships via the DB Migrate
> pipeline. **Not bundled into another agent's feature — it's a DB-layer correctness fix and a
> new migration file, touching no other source.**

### Slice G — Phase 3 dashboard UI ☑ (see docs/81 §8) — **REST API + UI v2 + versioning DONE**

> **G-versioning ☑** (this session) — Builder-style draft → publish + immutable history across data
> model (migration `20260808000000`), service, engine run-stamp, REST (`versions`/`publish`/`restore`/
> `discard-draft`), MCP (update auto-publishes), and the editor (version pill + Save/Publish/History +
> detail banner). Full detail + the documented edges in the RESUME pointer at the top. Tests: automation
> 46/46 · automation-actions 15/15 · automation-worker 6/6.

**G-API — `/v1/automations` REST surface ☑** (the API-first spine; the dashboard UI + MCP are
consumers of these). New `services/api-rest/src/routes/v1/automations/index.ts`:

- ☑ `GET /v1/automations` (filter status/triggerType/origin) · `POST` (create, always user-origin
  draft) · `GET/PATCH/DELETE /:id` · `POST /:id/clone` ("Duplicate to edit") · `POST /:id/status`
  (draft|active|paused) · `GET /:id/runs` + `GET /:id/runs/:runId` (run + ordered steps w/ gate_log).
- ☑ **RBAC, no module gate** — automations are a PLATFORM capability (docs/81 §3, no `automations`
  slug), so the routes do role checks only (`requireRole` viewer-read / editor-write), NOT
  `requireModule`. The dangerous bits are gated at runtime by the engine's gate layer, not the route.
- ☑ **LOCKED-tier guard surfaced as HTTP** — the service throws `LockedAutomationError` /
  `AutomationNotFoundError`; added `automationErrorMapper` to `app.ts` (→ `409 AUTOMATION_LOCKED` with a
  distinct code so the dashboard can offer "Duplicate to edit", and `404 NOT_FOUND`). A tenant can
  never create a `system`/`locked` rule — origin/locked are service-set, never accepted from the body.
- ☑ **Run-history reads** added to `@sparx/automation` (`listAutomationRuns` / `getAutomationRun`,
  tenant-scoped via `withTenant`, run scoped to its automation so a cross-automation run id 404s). The
  engine already WROTE runs/steps (`history/log.ts`); this is the read side for REST/MCP/UI.
- ☑ **Wiring:** `@sparx/automation` + `@sparx/automation-schemas` added to api-rest deps + Dockerfile
  COPY closure (the route needs only the service layer → closure is just those two; db/events already
  present, NO executor/CRM/commerce closure pulled in). `pnpm install` lockfile change scoped to the
  two new links.
- ☑ **Tests (docker DB, real Fastify via `app.inject`):** `automations-routes.test.ts` 7/7 — 401
  no-token, full lifecycle (create→list→get→update→status), RBAC (viewer 403 on create), 404 + 422,
  LOCKED guard (edit/status/delete 409 + clone 201), delete, run-history (empty list, seeded
  run-with-steps, cross-automation 404). typecheck + lint + prettier clean; `@sparx/automation` 35/35.

**G-UI — dashboard surface ☑** (this session) — the platform-level authoring + observability surface
at `apps/dashboard/.../automations/*`, a pure CONSUMER of the G-API REST surface (no api-rest/engine
change). New `@sparx/automation-schemas` dashboard dep (canonical types + `triggerToColumns`/
`triggerFromColumns` + the zod parsers → no vocab drift vs REST/MCP) + Dockerfile COPY.

> **NOTE — the BUILDER below was redesigned in G-UI v2** (see RESUME). The "Builder" +
> "Action-editor fidelity" bullets describe the original stacked-form builder (`automation-builder.tsx`
>
> - `action-editor.tsx`, now DELETED). It's now a **map + inspector** editor (`automation-editor.tsx` +
>   `flow-canvas.tsx` + `inspector*.tsx` + `action-config-editor.tsx`): same authoring vocabulary, fidelity
>   decisions, and validation — `TriggerEditor`/`ConditionEditor` reused verbatim, the action config logic
>   moved into `action-config-editor.tsx` — but presented as a clickable WHEN→IF→THEN flow canvas with
>   drag-to-reorder + insert-anywhere + zoom, edited via a right-hand inspector. The List / detail / runs /
>   nav bullets are unchanged.

- ☑ **Platform-level, full-page routes** — `/automations` (list), `/new`, `/[id]` (detail), `/[id]/edit`,
  `/[id]/runs`, `/[id]/runs/[runId]`. NOT a module manifest (`ModuleManifest.id` excludes `'platform'`)
  and NOT the `@detail` drawer system (that's keyed off module manifests) — it mirrors **SEO** (the
  platform-tool precedent): a neutral rail tile + mobile-nav entry shown when **≥1 module is active**,
  and a `layout.tsx` wrapping the surface in `<ModuleProvider module="platform">` so `color="module"` /
  `variant="module"` resolve to the platform brand (Sparx Indigo). The page itself renders an "activate
  a module" state if a tenant somehow has 0 active.
- ☑ **List** — status-filter chips (All/Active/Paused/Draft/Error + counts), a card per rule with the
  derived module tags ("CRM + Email"), trigger summary, run/error counts + last-run, `OriginBadge`
  (System/Locked), and an inline enable/pause `Switch` (editor+, non-locked) that runs the status
  Server Action (revalidates → row reflects new status).
- ☑ **Builder** (create + edit, one component) — `TriggerEditor` (event with curated per-active-module
  suggestions + free text, OR schedule = cadence daily/weekly/monthly/once + a predicate scan over
  `customer`/`b2b_account` reusing the condition editor for the `where` selector), `ConditionEditor`
  (the FLAT AND/OR group, 12 operators, valueless ops hide the value, list ops comma-split, light
  value coercion), and `ActionEditor`. Client-side validation (name/trigger/≥1 action/required config
  fields) before the Server Action; the server stays source of truth.
- ☑ **Action-editor fidelity (decision)** — the type picker offers ONLY actions with a registered
  executor whose owning module is active (deferred `commerce.*` / `b2b` quote-terms / `email.sequence_*`
  are defined so an existing rule still renders + round-trips, but never offered for a NEW action,
  mirroring docs/81 §6/§8). **Typed config fields** for picker-free configs (wait/stop/webhook/add_tag/
  remove_tag/add_note/update_field/create_task/update_deal_stage/send_internal/escalate_overdue) +
  **raw-JSON config mode** for ID-bearing/union configs (`email.send_campaign`) AND a universal escape
  hatch toggle on every action. Honest (per-action config is validated at DISPATCH, not at create — the
  client can't type-check it) and lossless. The list is **drag-to-reorder** (dnd-kit): the WHOLE CARD is
  the drag surface (user preference — more direct than a handle) via a guarded `CardPointerSensor` that
  ignores pointer-downs on a form control, so dragging the chrome reorders while inputs/selects stay
  usable; a `KeyboardSensor` keeps it reorderable without a mouse, and stable per-action ids keep each
  card's JSON-mode/buffer state with the ITEM across a drag.
- ☑ **Tier model surfaced exactly as the service enforces it** — a LOCKED (platform-managed) rule shows
  only **"Duplicate to edit"** (clone → user-origin editable copy) + View runs; no edit/pause/delete.
  The `/[id]/edit` route bounces a locked rule to its detail; the `AUTOMATION_LOCKED` (409) maps to the
  friendly message. `origin`/`locked` are never tenant-set (service invariant, unchanged).
- ☑ **Run history** — list (newest-first) + run detail with each step's status badge, timing,
  input/output (collapsible JSON), error, and the **`gate_log`** audit trail (allow/deny/transform/defer
  color-coded — docs/81 §7.1). Deterministic UTC timestamp formatting (no locale/tz → hydration-safe).
- ☑ **RBAC, no module gate** — viewer reads; editor+ writes (New/Edit/Delete/toggle gated on role; the
  new/edit pages redirect a viewer; the REST also 403s). Automations are a platform capability.
- ☑ **Verify** — `@sparx/dashboard` typecheck clean, lint **0 errors / 0 warnings**, prettier clean,
  and the **`next build` production build passes (exit 0)** with all six `/automations/*` routes
  compiled. No change to api-rest, `@sparx/automation`, or the engine; the other agent's in-flight
  invoicing files were left untouched.

### Slice H — Phase 4 AI assistant ☑ (MCP authoring tools)

The AI path onto the SAME service layer the REST routes use (one service, three transports). New
`packages/automation/src/mcp/` exports `automationMcpTools`, published by `services/api-mcp` exactly
like `crmMcpTools` (registry barrel pattern). The AI **authors rules**, it never fires an effect —
the gated dispatcher stays the sole path to an effect; the engine's `dispatch` is not exported here.

- ☑ **9 tools** — reads (`list_automations`, `get_automation`, `get_automation_runs`,
  `get_automation_run`) + writes (`create_automation`, `update_automation`, `set_automation_status`,
  `clone_automation`, `delete_automation`). Writes carry `confirmation: true` → the MCP server emits
  the `destructiveHint` so clients prompt. Reads open.
- ☑ **Same schemas as REST, no drift** — the write tools reuse `CreateAutomationInput` /
  `UpdateAutomationInput` / `CloneAutomationInput` from `@sparx/automation-schemas`, so the authoring
  vocabulary the AI sees (trigger kinds, the 12 condition operators, the typed action catalog) is
  exactly what the dashboard + SDKs see. (Verified all 9 inputs convert to JSON-schema cleanly — the
  recursive `ConditionGroup` + discriminated-union `Trigger`/`Action` derive fine under zod v4.)
- ☑ **Tier model enforced over MCP exactly as REST** — origin/locked are service-set (a tenant/AI can
  never create a `system`/`locked` rule); a LOCKED rule's `update`/`status`/`delete` returns an error
  result naming the platform-managed lock, and `clone_automation` is the "Duplicate to edit" path.
  Proven by the integration test (locked update → error, clone → user-origin copy with `clonedFrom`).
- ☑ **Scopes** — `read:automations` / `write:automations` added to `api-mcp` `auth.ts` (owner/admin/
  editor write, viewer reads) + `WRITE_SCOPES` (rate-limiter write-classification). Automations are a
  PLATFORM capability, so the tools are reachable whenever MCP itself is — the `ai`-module gate in
  `auth.ts`, not any feature module. The test proves this on an **`ai`-only tenant** (no crm/commerce).
- ☑ **Closure** — `@sparx/automation` + `@sparx/automation-schemas` added to api-mcp deps + Dockerfile
  COPY (db/events already present). The MCP tools call only the SERVICE layer, so the executor closure
  (`@sparx/automation-actions` + crm/commerce/b2b) is NOT pulled into the image.
- ☑ **Tests** — `services/api-mcp/test/automation-tools.test.ts` 4/4 driving the real Fastify MCP app
  over JSON-RPC: tools published + reachable on an ai-only tenant; authoring lifecycle (create → list →
  get → set status → empty run history); LOCKED clone-not-edit; scope enforcement (a read-only key
  reads but a write is denied naming `write:automations`). Full api-mcp suite **12/12**.

> **⚠ Two pre-existing `api-mcp` bugs fixed en route (both masked by a dormant-red suite).** Adding
> the automation tools made the api-mcp suite actually run for the first time in a while, which
> surfaced two latent failures that had nothing to do with this slice:
>
> 1. **Missing JSX transform.** The api-mcp `vitest.config.ts` lacked `@vitejs/plugin-react`, but its
>    tool-registry graph pulls in `@sparx/email-platform` → `@sparx/email` (raw React-Email `.tsx`).
>    Without the transform, vite's import-analysis can't parse the JSX and **every** suite fails at
>    import time. This is the exact issue PR#41 fixed for api-rest; the fix was never mirrored here.
>    Applied the same one-line config (`plugins: [react()]`) + the devDep. Test-only — prod runs tsx.
> 2. **Duplicate MCP tool name `get_top_customers`** — defined in BOTH `@sparx/crm`
>    (lifetime-spend list) AND `@sparx/commerce` (date-ranged revenue report). MCP tool names are
>    GLOBAL across modules, so the SDK throws `Tool ... is already registered` during
>    `buildServerForRequest` → **the server could not boot a single MCP session** (every request 500'd,
>    including `initialize`). It went unseen because the JSX issue kept the suite from ever running.
>    Fix: renamed the commerce tool → `get_top_customers_by_revenue` (CRM owns the customer-spine
>    name; the commerce one is the sales-report variant). A tool-name change is a contract change in
>    principle, but this tool literally could not be registered/served, so there is no live consumer.
>    Found via a throwaway diagnostic that counts duplicate names across the merged registry (109
>    tools, now 0 dupes) — worth re-running if a new module's tools ever collide.

### Slice I — Phase 5 external (Zapier / Make / inbound webhooks) ☐

### Slice J — Phase 6 advanced (branches, loops, retention, metering) ⃠ (deferred)

---

## 3. Cross-cutting decisions already locked (from docs/81, don't relitigate)

- **Platform capability, NOT a gated module** — no `automations` slug, worker always runs.
- **One engine, three tiers** (Locked / Managed / Custom via `origin` + `locked`).
- **One fan-in topic** `automation.trigger` (NO wildcard subscribe); teed from 3 paths.
- **Durable resumable runs** (`resume_at`, `cursor_index`) + advisory-lock tick — NO BullMQ.
- **Idempotency** `UNIQUE(automation_id, dedupe_key)`; **loop-guard** `cause_depth`/`max_depth`.
- **Conditions over RESOLVED fields** (entity resolver hydrates; payloads are thin IDs).
- **Gated dispatcher is the only path to an effect**; gates ≠ conditions; `deny` ≠ `failed`
  (records `gated` + `gate_log`); gates are typed fns, not a policy DSL.
- **Actions call existing services** (never re-implement); bulk via `bulk_op_reverts` + confirm.
- **Inline invariants stay inline** (suppression, tax, RLS — not automations _by shape_).
- **Metering deferred** — ship flat-rate-included.

## 4. Test status

- Outcome-level tests already guard the behaviors Slice F will replace (cron→engine swap):
  `packages/crm/test/integration/automation-triggers.test.ts` (7),
  `overdue-task-reminders.test.ts` (3),
  `services/b2b-overdue-worker/test/integration/escalation.test.ts` (4). These are the
  **parity oracle** for Slice F — they must stay green through the swap.

## 5. Session log

- **2026-06-10** — Build log created. Sequencing decided (engine-core before Phase-0
  fan-in). **Slice A `@sparx/automation-schemas` DONE + committed** (`25164b9`) —
  trigger/condition/action/automation/run schemas + column-mapping helpers, 7/7
  tests, typecheck + lint clean. Grounded the Slice B RLS form (`current_tenant_id()`
  per push_subscriptions). **Slice B data model DONE** — 3 Prisma models + 3 Tenant
  inverses + migration `20260730000000_automation_engine` (Prisma-exact DDL + hand-added
  RLS), applied to docker (89/89), 0 drift, client regenerated, db typecheck clean.
  **Slice C engine core DONE** — `@sparx/automation` (`packages/automation`): condition
  evaluator (12 ops), entity-resolver + schedule-scanner registries (built-ins for
  customer/deal/order), gated dispatcher (global chain + per-action manifest +
  allow/deny/transform/defer), `platform.webhook` built-in + SSRF egress gate +
  `registerAction` seam, `handleTrigger` (loop-guard + idempotent upsert), `runAutomationTick`
  (advisory-lock, per-step-transaction durable run machine, wait/defer park, fail-stop),
  `runScheduleTick` (predicate scan + window dedupe), service layer (CRUD + clone + locked
  guard + system seed). **35/35 tests green** (12 engine e2e + 9 service + 14 unit) against
  docker; typecheck + lint + prettier clean. Decisions captured in Slice C checklist notes.
  Next session resumes at Slice D (`services/automation-worker`) — schedule-first path retires
  the crons without the Slice E fan-in.
- **2026-06-10 (cont.)** — **Slice D `services/automation-worker` DONE.** Built the
  Cloud Run worker: `POST /internal/cron/tick` (Cloud Scheduler) → schedule tick +
  run tick; `POST /` (Pub/Sub push, Slice-E-ready) → `handleTrigger`; `GET /healthz`.
  Side-effect-free `server.ts` + thin `index.ts`; `runtime.ts` builds the engine
  deps on the shared `@sparx/db` `prisma` (sparx_app) for one pool across ticks +
  ingest. **Caught + fixed a prod-correctness bug:** the Slice C ticks assumed a
  BYPASSRLS owner connection that prod does NOT grant (Decision F3) — they'd return
  0 due runs silently in prod. Replaced the cross-tenant `findMany`s with two new
  SECURITY DEFINER helpers (migration `20260731000000_automation_scan_helpers`,
  applied to docker), mirroring `find_due_scheduled_entries`. Upgraded the engine
  tests to drive ticks through a real `sparx_app` (`appDb`) client so the prod RLS
  boundary is actually exercised — 35/35 still green. Worker e2e suite 4/4 against
  docker. Terraform `automation.tf` (Cloud Run service + per-minute OIDC Cloud
  Scheduler job + runtime/scheduler SAs; push sub deferred to E); added
  `cloudscheduler.googleapis.com` to bootstrap; `terraform validate`/`fmt` clean.
  CI: `automation-worker` registered in build-images + deploy-prod Cloud Run loop.
  typecheck + lint + prettier clean across automation/automation-worker/db. Next:
  Slice F (module executors + seed system automations + retire crons) — the
  schedule tick is now live so this needs no Slice E fan-in.
- **2026-06-11** — **Slice F1 (CRM action executors) DONE.** New package
  `@sparx/automation-actions` (the module-effect composition root) with 6 CRM executors
  (`add_tag` / `remove_tag` / `add_note` / `update_field` / `create_task` /
  `update_deal_stage`), each CALLING `@sparx/crm/services` — never re-implementing, so the
  service's audit row + `crm.*` event (two-bus) happen once at the source. 7/7 e2e green
  driving the full engine path (handleTrigger → runAutomationTick) against docker on the
  `sparx_app` client, incl. the loud `failed`-step path when a required entity field is absent.
  Wired into the worker: `installModuleActions()` + `installCrmPubSubBridge()` at boot (real
  Pub/Sub for executor-emitted events; no-op without `GCP_PROJECT_ID`), package dep, Dockerfile
  COPY closure (+11 workspace dirs — runtime stays React-free via server-safe subpaths; the
  closure bloat is logged debt, fix = a `@sparx/crm-core` split). typecheck + lint + prettier
  clean across automation-actions + worker; worker e2e still 4/4. Next: F2 (seed system
  automations — schedule-tick-only, no Slice E) → F3 (parity-check + retire crons).
- **2026-06-11 (cont.)** — **Hardening pass on the two F1 judgment calls** (user-requested fix
  before live users). (1) **Idempotency → tx-injection:** `TenantContext` gained an optional
  `tx`; `withTenant` composes into it (no nested `$transaction`, no re-SET of the GUC); the CRM
  executors pass `ctx.tx`, so an effect commits ATOMICALLY with its `automation_run_steps` row +
  cursor advance — no duplicate `create_task`/`add_note` on an ungraceful crash mid-step. Opt-in
  (default `withTenant` path unchanged); verified CRM 82/82 (+ RLS isolation), automation 35/35,
  automation-actions 7/7. (2) **`@sparx/crm` slim-down:** found the only two heavy-dep culprits
  were misplaced — `manifest.ts` (dashboard UI) → moved to `apps/dashboard/.../crm/manifest.ts`;
  the session-free module-gate core → new **`@sparx/modules`** pkg (deps: just `@sparx/db`), with
  `@sparx/auth` re-exporting for its ~40 importers (zero blast radius). `@sparx/crm` dropped
  `auth`/`ui`/`lucide-react`/`react`; the worker COPY closure went **15 → 9 packages, no React**.
  Verified db/modules/auth/crm/**dashboard**/**api-rest** typecheck + crm 82/82; worker 4/4 +
  lean Dockerfile. typecheck + lint + prettier clean across all touched packages.
- **2026-06-11 (cont.)** — **Slice F2-a (B2B dunning ladder) DONE.** The riskiest seed (docs/81
  §3.1's canonical Locked behavior) end-to-end on the unified engine: (1) extracted the
  escalation logic from `b2b-overdue-worker/cron.ts` into reusable
  `b2bEscalationService.escalateAccount` (`@sparx/crm`) — per-account, publisher-agnostic,
  tx-aware (closes the "no reusable service" risk); (2) `b2b_account` scanner +
  `b2b.escalate_overdue` executor in `@sparx/automation-actions` (calls the service, publishes
  the cron's `b2b.*` events on `@sparx/events`); (3) `seedSystemAutomations` catalog with the
  **Locked** dunning automation; (4) `b2b.escalate_overdue` added to the `ActionType` enum.
  4/4 engine-path test mirrors the parity oracle (invoice→overdue, credit_hold@14d /
  suspended@30d, fresh-overdue reminder event, monotonic re-run) on the `sparx_app` client.
  Worker auto-installs it (`installModuleActions` → `installB2bActions`); closure unchanged.
  **Caught + fixed a pre-existing 8-table RLS GUC bug** (migration `20260801000000`) — the
  dunning scan reading `b2b_invoices` as `sparx_app` was the first path to hit the wrong
  `current_setting('app.current_tenant_id')` form (throws under FORCE RLS); recreated all 8
  policies in the canonical `current_tenant_id()` form + `WITH CHECK`, applied to docker (0
  drift). Verified: automation-schemas/crm/automation-actions typecheck + lint clean;
  automation-actions 11/11, automation 35/35, b2b-overdue-worker 4/4 (oracle still green),
  worker 4/4. Next: F2 seed WIRING (arch fork — see RESUME) + the email-driven CRM-sweep seeds.
- **2026-06-11 (cont.)** — **Slice E (event-bus unification, docs/82) E1–E3 + E4-worker DONE.**
  The seed-wiring arch-fork resolved to "do it right via Pub/Sub" (user call), which is exactly
  Slice E — so built it. **E1:** consolidated the two drifted `EventType` unions into one
  `@sparx/events` superset (folded in the 3 api-core-only events + `module.activated/deactivated`);
  `api-core` deletes its local union and re-exports the canonical one (type-only, zero
  Dockerfile-closure risk — verified every api-core-COPYing service already COPYs events). Full
  typecheck 35/35. **E2:** `automation.trigger` topic + Cloud Run push subscription to the worker
  (DLQ + OIDC); `terraform validate` clean. **E3:** the fan-in tee in all three publish paths
  (`@sparx/events` + api-core `CloudPubSubPublisher`, CRM bridge's BOTH bus wrappers — the
  two-bus footgun), shared `teeToFanIn` helper carrying `__automationDepth`; unit test 3/3,
  best-effort so a tee failure never fails the per-type publish. Updated the CRM bridge unit test
  for the new tee (82/82). **E4 (worker):** the worker dispatches `module.activated` →
  `seedSystemAutomations` (now module-filtered), so activation seeds the dunning automation via
  the fan-in. typecheck + lint + prettier clean across events/api-core/crm/automation-actions/
  worker; crm 82/82, automation-actions 11/11, worker 4/4, events 3/3. **Remaining E4 lynchpin:**
  publish `module.activated` from the `tenant.ts` toggle routes (DEFERRED — another agent's file)
  - the Email in-process consumer + retiring the dashboard bootstrap calls. Parity test deferred
    (needs the union↔topic reconciliation — logged, not silently skipped).
- **2026-06-11 (cont.)** — **Slice E COMPLETE — E4 publish lynchpin landed.** `tenant.ts` had
  settled (onboarding modules-first work committed-adjacent; my edits are purely additive), so I
  wired the publish. Added `announceModuleTransition(log, tenantId, actorId, slug, enabled)` to
  `routes/v1/tenant.ts`: publishes `module.{activated,deactivated}` to BOTH buses — api-core
  `publish()` (per-type topic + webhook enqueue + fan-in tee → worker) and `publishPlatformEvent()`
  (in-process → CRM/Email, awaited). Called from the per-slug `PATCH` AND the bulk `PUT
/v1/tenant/modules` (onboarding), transition-gated (only on a real on/off change). Added the
  **Email** in-process consumer `services/api-rest/src/lib/email-module-activation.ts`
  (`registerEmailModuleActivationConsumer`, wired in `index.ts`) → `automationService.
provisionDefaults` on `module.activated` for `email`; placed at the api-rest composition root so
  email doesn't depend on CRM (which owns the bus). Retired the dashboard's redundant `POST
/v1/crm/bootstrap` follow-up in `settings/modules/actions.ts` (the toggle seeds CRM synchronously
  now); the bootstrap endpoints stay as idempotent escape hatches. **Verify:** my files typecheck
  clean — the only api-rest `tsc` errors are 3 stale-Prisma-client `BillingDocument*`/`Document*`
  refs from another agent's ungenerated invoicing schema (Windows DLL lock blocks `prisma generate`;
  not this work). Lint 0, prettier clean. New email-consumer unit test 2/2 (mocked email service +
  real in-memory bus, CI-safe, no DB); CRM `pubsub-bridge` 6/6. Slice E is now fully live: activate
  a module → CRM/Email seed in-process within the request + system automations seed via the worker
  fan-in. **Next:** F2 cont. (email-driven seeds — need email executors) + existing-tenant backfill
  - F3 (retire the b2b cron). Parity test still deferred.
- **2026-06-11 (cont.)** — **F1 email send executors DONE.** With dev killed I regenerated the
  Prisma client (clearing the stale-invoicing-client noise; api-rest tsc 0) and built the email
  effects. Traced the send pipeline end-to-end and hit the key fork: `@sparx/email-platform` drags
  `@sparx/email` + `@sparx/ui` + React into anything that imports it — fatal for the deliberately
  React-free automation-worker. So instead of `automationService.enqueueSend`, I created a NEW lean
  **`@sparx/email-sends`** (deps: `@sparx/db` only): `enqueueSend(ctx, spec)` = suppression-check +
  `scheduledSend.createMany({skipDuplicates})` with `automationId: null`, riding the existing
  email-dispatch tick. Built `email.send_campaign` (customer `customer.email`, do-not-contact skip,
  Builder-email `defer` or coded template, marketing scope) + `email.send_internal` (raw staff note,
  transactional) in `automation-actions/src/email.ts`; added `requireStringField`/`optionalBoolField`
  to `entity.ts`; wired `installEmailActions()`; worker Dockerfile COPYs the lean `email-sends` (now
  10 pkgs, still no React). **Verify (docker DB up):** email-sends 4/4 (enqueue/suppression/dedupe on
  the sparx_app FORCE-RLS client), automation-actions 13/13 (incl. the new 2 engine-path email tests
  — caught + fixed a `ConditionGroup.logic` casing bug, it's `'AND'` not `'and'`), worker 4/4;
  typecheck (email-sends/automation-actions/worker) 0, lint 0, prettier clean. Full `pnpm typecheck`:
  all 35 typecheck tasks pass (only `@sparx/db#build` prisma-generate EPERMs — the user restarted
  `pnpm dev`, re-locking the Windows query_engine DLL; the client is already current, so it's a
  no-op env flake, not a code issue). **Next:** F2 cont. email-driven seeds (win-back / inactivity /
  quote-expiry / deal-closing) on top of these executors; backfill; F3.
- **2026-06-11 (cont.)** — **Slice F2 backfill DONE + email-seed content fork surfaced.** Started F2
  cont. (email-driven seeds) but tracing the path surfaced a genuine PRODUCT-CONTENT fork: a _system_
  seed can't produce a turnkey marketing email (coded `win-back` template can't render a working CTA
  — BrandTokens carry storeName/logoUrl but no site URL; the Builder `defer` path needs a
  tenant-authored email absent at seed time). The send MECHANISM is fully built; the content source
  is a real decision (coded+siteUrl / Builder-authored / draft-until-configured), so I did NOT guess
  — surfaced it to the user and pivoted to the UNBLOCKED, fully-complete prerequisite: the **F2
  backfill** (also the safe precondition for F3 — retiring the cron before back-filling existing b2b
  tenants would stop their dunning). Built: SECURITY DEFINER `find_tenants_with_active_module(p_module)`
  (migration `20260805000000`, REVOKE PUBLIC / GRANT sparx_app; applied to docker, 94 migrations, only
  mine pending) → `reconcileSystemSeeds(db)` in `@sparx/automation-actions` (distinct owning modules
  → cross-tenant scan → idempotent `seedSystemAutomations` per tenant; warns on an unsupported
  null-module seed) → worker `reconcileSeeds(logger)` + `POST /internal/cron/reconcile-seeds`
  (reuses `tickAuthorized`) → a DAILY Cloud Scheduler job `automation-reconcile-seeds` (02:07 UTC,
  automation.tf, same scheduler SA + existing run.invoker grant). Self-healing for dropped activation
  events too. **Verify:** automation-actions typecheck/lint clean + 15/15 (+2 reconcile:
  active-seeded/inactive-skipped + idempotent); automation-worker typecheck/lint clean + 6/6 (+2
  route: 403 + authorized backfill of a b2b tenant); `terraform fmt -check` + `validate` clean;
  prettier clean on all touched TS. Purely additive (new migration + new package export + new worker
  route + new TF job) — no existing export/behavior changed. (Migration timestamp bumped
  `20260804000000` → `20260805000000` to dodge a same-stamp collision with a concurrent agent's
  `20260804000000_invoicing_snapshots`; the rename was re-recorded on docker — orphaned record
  pruned — so local `migrate status` is clean.)
- **2026-06-11 (cont.)** — **Slice F3 (retire the b2b-overdue cron) DONE — user-chosen next slice.**
  ⚠ On inspection, `services/b2b-overdue-worker` was **dead code: never wired into deployment** (not
  in the `build-images.yml` matrix, not in Terraform, not a `k8s/cronjobs` entry — the only deployed
  "overdue" cron is `crm-overdue-reminders`, an unrelated CRM-task sweep hitting api-rest). So the
  unified-engine dunning automation was already the FIRST actually-deployed b2b dunning: no live
  double-notify, no TF/CI/k8s to unwind. **Parity confirmed** by reading both — `escalateAccount`
  (the reusable service the engine calls) faithfully reproduces the cron's per-tenant SQL ladder
  (mark unpaid-past-due → overdue + `overdue_days`; ≥14d & active → `credit_hold`; ≥30d → `suspended`,
  monotonic; fresh-overdue → `b2b.invoice.overdue` reminder), the engine's `b2b-escalation` test
  (4/4) being the standing oracle; the only delta is the cron's `credit_used` resync, a no-op per
  F2-a. **Did:** deleted the service dir, refreshed the lockfile (`pnpm install`, −34 lines, scoped to
  the removed importer), retired the now-stale cron-reference comments in `b2b-escalation-service.ts`
  - `automation-actions/src/b2b.ts` to past tense. **Heads-up:** if a `b2b-overdue-worker` Cloud Run
    was ever stood up manually (outside IaC), it is now orphaned — `gcloud run services list` to confirm
    none exists; the code/IaC shows it never was. **Note:** the user committed this session's work
    concurrently (commits `3d82f94c` migration + `8322a7f9` everything incl. the deletion, unpushed);
    this doc-sync (F3 section + the `20260805000000` number fix the commit captured stale) lands on top.
    **Next:** email-driven seeds once the user picks a CONTENT-FORK approach (RESUME) + commerce
    executors.
- **2026-06-11 (cont.)** — **Content-fork RESOLVED + next-slice repointed; no new code.** User picked
  **(B) Builder-authored defaults** for system-seeded marketing emails and surfaced a broader product
  task: ship a **library of default Builder emails** with the email module ("emails are vital and take
  users the most time"). Recorded as a new tracked F2 task + memory `project_email_defaults_builder_authored`.
  **Investigated the next build and ruled out two candidates with evidence:** (1) **commerce executors**
  — read the resolver catalog (`resolvers/builtins.ts`: customer/deal/order only, NO product/variant)
  and the commerce services; `update_inventory` has no trigger entity, `create_invoice` collides with
  the in-flight `billing_documents`, `create_order`/`apply_discount` lack a trigger semantic/spec, none
  has a consuming automation → not cleanly buildable, deferred with reasons (NOT half-built). (2)
  **`email.sequence_*`** — no sequence subsystem exists, deferred. **⚠ Reconciliation finding:** a
  PARALLEL coded email-automation system already exists (`@sparx/email-platform` `DEFAULT_AUTOMATIONS` +
  its own `evaluateTrigger`, 11 coded-`templateKey` defaults incl. a dead `crm.customer.inactive`
  win-back) that the unified engine must subsume, not run beside. **Repointed RESUME → `/v1/automations`
  REST API (Slice G backend)** as the next slice: clean, additive, API-first (CLAUDE.md), unblocks the
  Custom tier + dashboard UI + MCP, no product gaps, no cross-agent collision (new route file; only the
  shared route-registration line is touched).
- **2026-06-11 (cont.)** — **Slice G-API (`/v1/automations` REST surface) DONE.** New
  `services/api-rest/src/routes/v1/automations/index.ts`: list (filter status/triggerType/origin),
  create (user-origin draft), get/patch/delete, `:id/clone` ("Duplicate to edit"), `:id/status`
  (draft|active|paused), `:id/runs` + `:id/runs/:runId` (run + ordered steps w/ gate_log). RBAC only
  (`requireRole` viewer-read / editor-write) — automations are a PLATFORM capability, NOT a module, so
  no `requireModule`. Added run-history reads to `@sparx/automation` (`listAutomationRuns` /
  `getAutomationRun`, tenant-scoped, run scoped to its automation). Added `automationErrorMapper` to
  `app.ts` mapping `LockedAutomationError`→`409 AUTOMATION_LOCKED` (distinct code → dashboard offers
  "Duplicate to edit") + `AutomationNotFoundError`→`404`. Wiring: `@sparx/automation` +
  `@sparx/automation-schemas` added to api-rest deps + Dockerfile COPY closure (route needs only the
  service layer → no executor/CRM/commerce closure pulled in); `pnpm install` lockfile change scoped to
  the two new links. **Verify:** automation + api-rest typecheck clean, lint 0, prettier clean;
  `automations-routes.test.ts` 7/7 (401, lifecycle, RBAC 403, 404+422, LOCKED 409 + clone 201, delete,
  run-history) + `@sparx/automation` 35/35. Purely additive — no existing route/behavior changed; the
  other agent's in-flight invoicing files in the working tree were left untouched. **Next:** Slice G-UI
  (dashboard surface) or Slice H (MCP write-tool) — both consume this API.
- **2026-06-11 (cont.)** — **Slice H (MCP authoring tools) DONE.** New `packages/automation/src/mcp/`
  (registry + read-tools + write-tools + barrel) exporting `automationMcpTools` — 9 tools wrapping the
  SAME service layer as the REST routes (one service, three transports), published by `services/api-mcp`
  via the established `crmMcpTools` registry pattern. Reads (`list_automations` / `get_automation` /
  `get_automation_runs` / `get_automation_run`, `read:automations`, open) + writes (`create` / `update`
  / `set_status` / `clone` / `delete`, `write:automations`, `confirmation:true` → destructiveHint). The
  AI authors rules only — `dispatch` is not exported, the gated dispatcher stays the sole effect path.
  Write tools reuse `Create/Update/CloneAutomationInput` from `@sparx/automation-schemas` (no vocab
  drift vs REST/dashboard). Tier model enforced over MCP exactly as REST (origin/locked service-set;
  LOCKED update/status/delete → error result; clone = "Duplicate to edit"). Scopes added to api-mcp
  `auth.ts` (owner/admin/editor write, viewer read) + `WRITE_SCOPES`. Closure: `@sparx/automation` +
  `@sparx/automation-schemas` → api-mcp deps + Dockerfile COPY (service layer only, no executor
  closure). **⚠ Fixed two pre-existing api-mcp bugs the dormant suite had hidden:** (1) added the
  missing `@vitejs/plugin-react` JSX transform to api-mcp's vitest config (the api-rest PR#41 issue,
  never mirrored — `@sparx/email`'s raw `.tsx` in the graph made EVERY suite fail at import); (2)
  **duplicate MCP tool name** `get_top_customers` (CRM lifetime-spend AND commerce date-ranged report)
  → the SDK threw at registration so the server couldn't boot a session (every request 500'd, incl.
  `initialize`). Renamed the commerce tool → `get_top_customers_by_revenue` (CRM owns the customer-spine
  name); found via a throwaway dup-name diagnostic (109 tools → 0 dupes). **Verify:** automation +
  api-mcp + commerce typecheck clean, lint 0, prettier clean; `automation-tools.test.ts` 4/4 (published
  - reachable on an ai-only tenant; lifecycle; LOCKED clone-not-edit; scope denial) — full api-mcp
    suite now **12/12** (was unrunnable), `@sparx/automation` 35/35. Lockfile scoped to the two links +
    the `@vitejs/plugin-react` devDep; the other agent's invoicing files (dashboard `invoicing/` +
    `_shell/registry.ts`) left untouched. **Next:** Slice G-UI (dashboard surface) — the last consumer of
    the now-two-transport (REST + MCP) service layer; or Slice I (external/inbound webhooks). Email-driven
    seeds remain queued behind the user's Default Builder-emails library.
- **2026-06-11 (cont.)** — **Slice G-UI (dashboard automations surface) DONE.** The third authoring
  surface (after REST + MCP), a pure CONSUMER of the G-API REST endpoints — **no api-rest or engine
  change**. New routes under `apps/dashboard/.../automations/`: list, `/new`, `/[id]` detail/review,
  `/[id]/edit`, `/[id]/runs`, `/[id]/runs/[runId]`. **Platform-level, not a module** — `ModuleManifest.id`
  excludes `'platform'` and the `@detail` drawer system is keyed off module manifests, so (like SEO) it
  uses full-page routes, a neutral rail + mobile-nav tile shown when ≥1 module is active, and a
  `layout.tsx` `<ModuleProvider module="platform">` (Sparx Indigo) for `color/variant="module"`. Built:
  status-filtered list (module tags + run stats + inline enable/pause), the full builder (event/schedule
  `TriggerEditor` with a predicate scan reusing the `ConditionEditor`; the flat AND/OR condition editor;
  the ordered `ActionEditor` — typed config fields for picker-free actions + a JSON escape hatch, picker
  limited to executor-backed + active-module actions), and run history + per-step `gate_log` run detail.
  Tier model surfaced as the service enforces it (LOCKED → "Duplicate to edit" + View runs only; edit
  route bounces locked → detail; 409 AUTOMATION_LOCKED → friendly copy). RBAC viewer-read / editor-write.
  **No-drift:** added `@sparx/automation-schemas` as a dashboard dep (canonical types +
  `triggerToColumns`/`triggerFromColumns` + zod parsers) + Dockerfile COPY (closure = just zod, already
  present); `pnpm install` lockfile scoped to the one link. **Verify:** `@sparx/dashboard` typecheck
  clean, lint **0/0**, prettier clean, and the **`next build` production build passes (exit 0)** with all
  six `/automations/*` routes compiled. Fixed 3 `noUncheckedIndexedAccess`/lint nits + centralised a
  `primitiveText` helper en route. Other agent's invoicing files untouched; nothing committed. **The
  automation engine is now complete end-to-end** — tenant- AND AI-authorable across REST + MCP +
  dashboard, schedule/event-driven, email-sending, self-seeding, sole dunning impl, and observable.
  **Next:** Default Builder-emails library (unblocks email-driven seeds) or Slice I (external) — both
  user-sequenced.
- **2026-06-11 (cont.)** — **G-UI polish (user-driven): action drag-and-drop + NESTED condition groups.**
  (1) **Action reordering → drag-and-drop** (dnd-kit). User preference: drag the WHOLE CARD, not a handle
  — implemented via a guarded `CardPointerSensor` that ignores pointer-downs on form controls (so inputs/
  selects stay usable) + a `KeyboardSensor` for a11y; stable per-action ids keep each card's state with
  the item across a drag. Memory `feedback_drag_whole_element_not_handle`.
  (2) **Nested AND/OR condition groups** (the real expressiveness upgrade — flat AND/OR can't express
  `A AND (B OR C)`). Cross-package: **schema** (`@sparx/automation-schemas` `condition.ts`) — `ConditionGroup`
  now accepts leaf conditions OR nested sub-groups, built as **explicit finite levels (depth 3), NOT
  `z.lazy`** so it stays a finite `$ref`-free JSON-Schema (verified the MCP tool registration still boots —
  the prior 500-risk area) and over-deep trees are REJECTED, not silently accepted; backward compatible (a
  flat all-leaf group is unchanged) → existing stored automations parse as-is. Added `isConditionGroup`
  guard + `ConditionNode`/`MAX_CONDITION_DEPTH` exports. **Evaluator** (`@sparx/automation` `evaluate.ts`)
  recurses into sub-groups. **Dashboard** `ConditionEditor` is now recursive (per-group All/Any + Add
  condition / Add group, "Add group" hidden at max depth) and `ConditionGroupView` renders the tree indented.
  **Verify:** automation-schemas typecheck + **10/10** (+3 nested: parse / backward-compat / depth-reject);
  automation evaluator typecheck + **13/13** (+4 nested: mixed precedence / failing sub-group / 3-level /
  empty sub-group); **api-mcp 4/4** (JSON-schema conversion still clean — finite-level design paid off);
  **api-rest 7/7** (backward compat); dashboard typecheck + lint **0/0** + prettier + **`next build` exit 0**.
  Bumped docs/81 §5.3 (v1.5→1.6). ⚠ **Pre-existing, UNRELATED failure surfaced:** `@sparx/automation` full
  suite is 38/39 — `engine.test.ts > parks a durable wait and resumes it on a later tick` fails (`waiting` vs
  `completed`). It's in the run-tick RESUME path (untouched by this work) and **fails identically on the
  pre-change HEAD files** (verified by reverting condition.ts/evaluate.ts and re-running) — a flaky
  `delaySeconds: 0` resume timing issue someone introduced when the suite grew 35→39, not this slice. Worth a
  separate look. Nothing committed.
- **2026-06-11 (cont.)** — **G-UI v2: the builder is now a MAP + INSPECTOR editor (user-driven redesign).**
  The user called the stacked-form builder dated ("looks like 2001 … a bunch of cards") and asked for a
  proper pipeline editor that **matches the site/email Builder**. Explored the Builder shell (three-pane:
  Layers + Canvas + Inspector, selection lifted into one object, no Context), then — because automations are
  SHALLOW (trigger + conditions + a few actions, not a deep tree) — collapsed it to the **two panes the user
  picked**: a flow canvas that IS the map + an inspector. Sequence of decisions (all the user's): considered a
  Make-style 2D node canvas and TRUE fan-out (parallel branches) → user reasoned to **stay linear** (Zapier is
  linear; the engine model is linear) but demand **top-notch drag-and-drop**; insert-anywhere + canvas zoom +
  **versioning** added as requirements. Built: `automation-editor.css` (`.ax-*` chrome mirroring `.bx-*`),
  `_lib/flow.ts` (node-id model + trigger/condition/action summaries + icon keys) + `node-icons.tsx`,
  `flow-canvas.tsx` (the spine; **dnd-kit `DragOverlay`** whole-card reorder — 6px activation so click still
  selects, Space-lift/Enter-select keyboard, auto-scroll, live renumber — + insert-above affordance on each
  step + end add, new step lands SELECTED), `inspector-primitives.tsx` (Card/Field/PanelHead/Segmented =
  `.bx-*` siblings), `action-config-editor.tsx` (the per-action type+config, extracted from the deleted
  `action-editor.tsx`), `inspector.tsx` (selection-driven; reuses `TriggerEditor`/`ConditionEditor` verbatim),
  `automation-editor.tsx` (shell: toolbar + 2-pane + all state + create/update submit + **zoom** 50–150% /
  ⌘-wheel / persisted, overlay outside the scaled wrapper + sortable transform ÷ zoom). Pages `new` + `[id]/edit`
  now render it full-bleed; **deleted** `automation-builder.tsx` + `action-editor.tsx`. A pixel-faithful
  `mockups/automation-editor.html` was built FIRST and browser-verified (light+dark, real tokens) before the
  React build, at the user's suggestion. **Verify:** dashboard typecheck ✓ + lint ✓ (0 errors; 10 pre-existing
  warnings elsewhere) + prettier ✓ + **production build ✓** (all 6 `/automations/*` routes). Still on the same
  G-API (create/update) — no api-rest/engine change. **Live drag/zoom _feel_ not yet run against the authed
  app** (static gates + mockup only). Saved memory `feedback_no_self_imposed_limits` (user: "don't scope me
  down — I make the rules"). Nothing committed. **NEXT (committed): versioning** (draft/publish + history).
