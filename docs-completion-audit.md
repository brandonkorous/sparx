# Docs completion audit — which docs' work is fully done

**Date:** 2026-06-14
**Method:** 9 parallel read-only audit agents (one per doc-range) cross-checked each doc's
deliverables against the actual codebase (`apps/`, `packages/`, `services/`), then I corrected the
result against git history + build-status memory. **The cold read-only pass under-counted
recently-shipped work** — it wrongly flagged Live Chat (56/70), Markup (48), and Wizards/Import/Bulk
(68/69) as "not built" when they are in fact shipped. Those are corrected below. A doc's own status
header is **not** trusted (several are stale, e.g. 48 says "nothing built" but markup shipped; 15 says
"not yet built" but onboarding shipped).

## Disposition legend

- **ARCHIVE — done** — every concrete deliverable the doc specifies is shipped; no meaningful tail.
- **ARCHIVE — spent** — retired/superseded/point-in-time artifact whose moment has passed.
- **ARCHIVE? — core done, deferred tail** — primary feature is live; only explicit "Phase-N-later /
  scale / future" items remain. **Disposition depends on the threshold decision** (strict vs pragmatic).
- **KEEP — reference** — a living reference/convention/architecture/glossary/catalog/ADR consulted
  continuously and updated in place. Its system may be fully built, but it is not a "finished" artifact.
- **KEEP — incomplete** — genuine open build work remains.

---

## KEEP — reference (living; do not archive even though the system is built) — 26

| File                                  | Why it stays                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| 00-README.md                          | Doc index / table of contents.                                                              |
| 01-platform-vision.md                 | Strategic vision; no build punch-list.                                                      |
| 02-architecture-overview.md           | System architecture reference.                                                              |
| 03-infrastructure-deployment.md       | Phased infra strategy; updated as phases shift.                                             |
| 04-domain-ssl-automation.md           | Domain/TLS reference. ⚠️ doc uses stale hostnames (`wizeworks.com`) — worth a fixup.        |
| 05-data-model.md                      | Canonical entity map; updated as schema grows.                                              |
| 06-api-specification.md               | API reference. ⚠️ stale `wizeworks.com` base URL.                                           |
| 07-mcp-server-spec.md                 | MCP tool reference. ⚠️ one stale hostname.                                                  |
| 16-auth-security.md                   | Auth/security model (Layer 4 operator tier deferred by design).                             |
| 18-frontend-architecture.md           | Frontend stack reference.                                                                   |
| 19-testing-strategy.md                | Testing strategy (k6 load scenarios aspirational).                                          |
| 20-operational-runbook.md             | Living ops runbook.                                                                         |
| 21-cost-scaling-guide.md              | Living cost/scaling guide.                                                                  |
| 23-frontend-component-architecture.md | `@sparx/ui` architecture reference.                                                         |
| 25-monorepo-structure.md              | Monorepo layout reference.                                                                  |
| 34-dashboard-working-area-standard.md | Working-area standard (compliance sweep ongoing).                                           |
| 34-platform-glossary.md               | Canonical terminology.                                                                      |
| 35-ui-variant-system.md               | Variant-system spec — **build is incomplete** (only tokens/presets done); kept as the spec. |
| 71-social-commerce-channels.md        | Channel-adapter reference architecture for future integrations.                             |
| 73-pricing-model.md                   | Living pricing reference.                                                                   |
| 77-domain-network-seo.md              | Domain-network/SEO strategy reference.                                                      |
| 88-integrations-catalog.md            | Integrations catalog / taxonomy (living index).                                             |
| 89-feature-catalog.md                 | Canonical feature inventory (kept in sync with `capabilities.ts`).                          |
| 95-client-data-fetching.md            | TanStack Query usage convention.                                                            |
| crm-audit-prompt.md                   | Reusable CRM-audit task spec.                                                               |
| sparx-brand-guide.md                  | Living brand guide.                                                                         |
| domains.md                            | Current-state domain registration inventory.                                                |

> ADRs **90-ADR-automation-migration** and **94-ADR-payment-gateway** are decision records — by
> convention kept as historical reference (their decisions are executed). Listed under "core done" below
> in case you'd rather archive executed ADRs.

---

## ARCHIVE — spent / superseded — 3

| File                         | Why                                                                         |
| ---------------------------- | --------------------------------------------------------------------------- |
| 31-email-section-composer.md | **RETIRED 2026-06-04**; superseded by the Email Builder node-tree (doc 52). |
| cms-audit-2026-05-29.md      | Point-in-time CMS audit; all 37 findings closed.                            |
| crm-audit-2026-05-29.md      | Point-in-time CRM audit; rounds 1–3 closed.                                 |

---

## ARCHIVE — done (work fully shipped, negligible tail) — 12

| File                              | Evidence                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| 24-domain-purchase-management.md  | GoDaddy purchase/renewal/transfer flow + MCP tools + onboarding step all live.      |
| 27-customer-accounts-site-auth.md | `@sparx/customer-auth` shipped (hash/session/service + RLS); only browser E2E left. |
| 41-builder-page-model.md          | `BuilderPage` table + `/v1/builder/pages/*` + service + schema validation shipped.  |
| 43-builder-binding-schema.md      | Binding contract + `bindingService.getSchema()` + CMS introspection shipped.        |
| 44-builder-site-render.md         | Public render path (`/v1/public/builder/page` + `BuilderRenderer`) shipped.         |
| 49-multi-site-per-tenant.md       | All phases 1–8 shipped incl. per-site theme/email/blueprint/legal (2026-06-12).     |
| 52-email-builder.md               | Phases 1–6 all built/deployed.                                                      |
| 59-responsive-rendering.md        | Three-tier collapse renderer + canvas parity shipped.                               |
| 62-responsive-site-chrome.md      | v2.0 `CollapsibleNav` live on both site + canvas.                                   |
| 70-live-chat-module.md            | **CORRECTED** — Live Chat shipped (widget, websocket, inbox, push).                 |
| 72-sparx-market-architecture.md   | Marketplace Phase 1 shipped; opt-in UI + category pages live.                       |
| 93-one-tenant-email-system.md     | S1–S6 landed 2026-06-12.                                                            |

---

## ARCHIVE? — core done, deferred tail (threshold decision) — 22

Primary feature is **live**; only explicit future/scale/Phase-N items remain. Under the **pragmatic**
threshold these archive and their tails become kanNINJA cards; under **strict** they stay.

| File                                  | Core shipped                                            | Deferred tail                                                   |
| ------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------- |
| 08-site-builder-spec.md               | Theme system + visual builder                           | superseded by 29/30/36/37 refinements                           |
| 09-ecommerce-engine-prd.md            | Full commerce engine                                    | ongoing commerce enhancements                                   |
| 11-crm-prd.md                         | CRM spine + pipelines/tasks/segments                    | —                                                               |
| 22-typesense-search-spec.md           | Collections + sync + ⌘K                                 | per-tenant reindex not run; scoped-key 501; per-tenant synonyms |
| 29-sitebuilder-architecture.md        | Backend + renderer + registry                           | §9 follow-ons (Stripe Connect, custom-domain self-serve)        |
| 30-sitebuilder-redesign.md            | Phases 1–3                                              | Phase 4 (layout picker in Commerce/CMS editors)                 |
| 33-token-model-v2.md                  | v2 read-path + presets                                  | destructive storage cutover (lands w/ Phase 2 editor)           |
| 36-sitebuilder-layering-model.md      | PageLayout tier                                         | SiteLayout tier; home-as-CMS-entry                              |
| 37-sitebuilder-section-system.md      | 7 sections + Phases A–D                                 | Phase E (carousel) / F (overlay header)                         |
| 38-sitebuilder-extensible-sections.md | Declarative custom sections (Phase C)                   | Phase D (marketplace sections); section-studio UX               |
| 42-legal-and-consent.md               | L1/L2/L3 through Phase 7                                | Phase 8 backfill (scheduled migration)                          |
| 45-builder-site-layout.md             | Site-layout editor S0–S2                                | per-page layout assignment                                      |
| 46-site-ui-component-library.md       | Full `@sparx/site-ui` catalog                           | canvas↔site unification on HOLD                                 |
| 48-product-markup-pricing.md          | **CORRECTED** — markup Ph1–4 + recompute worker shipped | confirm invoice-line markup closed                              |
| 50-seo-aio-discoverability.md         | Phases A–D + Phase 2 hardening                          | tracked deferrals (CSP, hreflang, perf budgets…)                |
| 53-builder-tenant-components.md       | P-A…P-E + gap work                                      | binding-slot labeling; nested-pin edge case                     |
| 54-tenant-blueprints.md               | Installer + REST + dashboard + flagship                 | async worker; version upgrades; public marketplace              |
| 56-live-chat-module.md                | **CORRECTED** — Live Chat shipped                       | sparx.market CTA; Web Push needs VAPID/TF                       |
| 57-builder-navigation.md              | P1 + migration + fallback removal                       | CMS-surface teardown (rollback window)                          |
| 60-marketplace.md                     | Phases 1–5 live                                         | Phase 6 (Typesense), 7 (publishing), 8 (payouts)                |
| 61-utility-authoring-system.md        | Phases 0–5                                              | Phase 6 (governance docs), 7 (raw CSS tier)                     |
| 64-tier2-build-plan.md                | Domain/B2B/Dropship/Inventory Ph1                       | — (plan effectively complete)                                   |

Also in this band (executed ADRs / build-logs you may prefer to keep):
**75-invoicing-spec.md** (module P1–8 built), **81-automation-module.md** (built through Slice K; Phase 6
deferred), **84-automation-build-log.md** (build log — spent once committed), **86-surface-frame-pattern.md**
(**CORRECTED** — WizardFrame + wizards shipped), **87-invoicing-and-billing-documents.md** (P1–8 shipped;
dashboard authoring tail), **90-ADR-automation-migration.md** + **94-ADR-payment-gateway.md** (decisions executed).

---

## KEEP — incomplete (genuine open build work) — 34

| File                                  | Open work                                                                        |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| 10-b2b-wholesale-prd.md               | service scheduling integration; fitment scoping breadth                          |
| 12-cms-prd.md                         | Phase 5+ (localization, MCP tools, approvals, AI alt-text, A/B)                  |
| 13-email-platform-prd.md              | webhook-event ingestion wiring verification                                      |
| 14-dropship-integration-prd.md        | POD authoring; CSV column-mapping UI                                             |
| 15-merchant-onboarding-prd.md         | redesign slices 2–3 (verify-email; Google OAuth)                                 |
| 17-billing-subscriptions.md           | trial→grace→suspend lifecycle; Stripe subscription items (greenfield)            |
| 24-dashboard-shell.md                 | Phase 2 (drag-resize, ⌘K deep mode, side-peek, presence, share)                  |
| 26-domain-transfer-runbook.md         | runbook not yet executed (8 domains → Cloudflare)                                |
| 27-tiktok-shop-integration.md         | entire integration (OAuth, sync pipelines) unbuilt                               |
| 28-inventory-sync-integration.md      | backlog/thinking doc — nothing built                                             |
| 32-workspace-switching-breadcrumb.md  | Phases 3–5 (org plugin, switching API, create workspace)                         |
| 39-universal-search.md                | Phase 2 breadth; Phase 3 CMS projectors (need CMS events)                        |
| 47-class-first-authoring-model.md     | Phase D not wired into publish; Phases B–F unbuilt                               |
| 51-content-architecture.md            | Ph1 link/resolver done partially; Ph3–5 deferred                                 |
| 58-per-site-context.md                | P1 (orders.property_id), P2 (customer identity split)                            |
| 63-external-data-connections.md       | capstone — entirely unbuilt                                                      |
| 65-tier1-build-plan.md                | MCP Phase 5–6; checkout/onboarding domain integration                            |
| 66-tier3-build-plan.md                | legal slice 7–8; (markup Ph3–4 now shipped — re-verify)                          |
| 67-billing-build-plan.md              | Stripe ops (Products/Prices, webhook, secrets, migration)                        |
| 68-wizards-import-export-bulk.md      | **CORRECTED** — wizards/import/bulk shipped; confirm B6 Excel/remaining entities |
| 69-tier4-build-plan.md                | **CORRECTED** — Track A done, Track B mostly done; verify residue                |
| 74-business-formation-integration.md  | entirely unbuilt (FileForms diligence gate)                                      |
| 76-admin-portal-spec.md               | no `apps/admin` — unbuilt                                                        |
| 78-consultant-partner-program.md      | only schema scaffolded; shell/free-tier unbuilt                                  |
| 79-scheduling.md                      | draft notes only — no spec/code                                                  |
| 80-marketing-attribution-analytics.md | L-PLAT shipped; Phases 2–6 + L-TEN deferred                                      |
| 82-event-bus-unification.md           | several `[ADD]` events not yet published on the bus                              |
| 83-tenant-attribution-l-ten.md        | not built (deferred)                                                             |
| 85-creator-marketplace.md             | Phase 1 ingest done; Phases 2–4 (submission UI, monetization, sandbox)           |
| 91-default-email-templates.md         | per-site email model (property_id) not migrated                                  |
| 92-billing-stripe-go-live.md          | go-live ops pending                                                              |
| emails.md                             | stub — TODO skeleton                                                             |
| issues.md                             | 4 open design questions                                                          |
| multi-site-context-shift-handoff.md   | 5 context-shift gaps + 2 open decisions                                          |
| template-screenshots-handoff.md       | 4 templates need preview screenshots + manifest `preview` field                  |

---

## Decision needed (drives ~30 files)

1. **Threshold for "done":** strict (only the 12 zero-tail + 3 spent archive) vs pragmatic (also archive
   the 22 "core done, deferred tail", migrating each tail to a kanNINJA card so nothing is lost).
2. **Living references (26):** keep active (recommended) vs archive any whose system is fully built.
3. **Link breakage:** archiving changes paths referenced in CLAUDE.md / MEMORY.md / cross-docs. Plan: move
   files, then fix inbound references in the same pass.
