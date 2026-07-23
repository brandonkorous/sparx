---
title: Open punch-list
node: tasks
type: entry
status: active
---

Cross-cutting open items seeded while building the brain (each links to its context). Move anything actionable-now into kanNINJA per [[kanninja-is-the-record]].

- ✅ **16px body floor in docs — done 2026-07-03.** `DESIGN.md` + `docs/23 §4` corrected to 16px. **Remaining:** align `DESIGN.md`'s 11px label / 13px mono to `tokens.css` (xs 12 / sm 14) — a design call. → [[typography]], [[spec-drifted-from-token]].
- **Graduated docs migration.** As each node is verified, slim its source docs (23 / 35 / 86 / 34 / …) to linked references or retire them, fixing cross-references. → [[doc-style]], [[CONTRACT]].
- **Formalize [[in-console-document]].** It is `status: draft` — turn it into a shared primitive when the next presentational console surface appears.
- **Audit 11px labels** against the 14px caption floor when touching a surface. → [[typography]].
- **Correct the stale root `CLAUDE.md`** — repo-status ("early scaffold / empty apps"), email provider (Postal → Mailgun), event names (`order.created`/`customer.updated` don't exist), Better-Auth API-key/MFA framing. Binding file — operator's call. → [[claude-md-drifted]].
- **Reconcile Phase-1 infra docs** — docs/03 + CLAUDE.md frame Typesense as Phase-2 and email as Postal; live reality is Typesense-now + Mailgun. → [[phased-infra]].
- **Postal decommission cleanup** — remove `packages/email/src/providers/postal.ts` + `k8s/postal/*` once Mailgun is confirmed stable; stub the `sparx.email` DNS records in Cloudflare. → [[mailgun]].
- ✅ **Migrated the drifted settings lists to `SelectionList` — done 2026-07-03.** `settings/sites` (+ per-site General/Domains/Modules detail via `defaultDetailView`, `site` on the builder manifest), `settings/domains` (inventory table + per-row actions menu), and `settings/ai-integrations` (keys/connections tables) are on the list substrate; the New-site wizard now renders through the surface system (`embedded` `/settings/sites/new` + `inline` overlay via `EntityCreateButton`), and the bespoke managers are deleted. → [[list-substrate]], [[surface-frame]].

## P0 blockers — from the 2026-07-22 docs-vs-built gap analysis

Surfaced by a whole-platform gap audit (docs instructed vs. shipping code). These gate revenue, a security surface, or forward-only data — move each into kanNINJA when it becomes actionable. Full context + the module scorecard + P1 list are in the gap-analysis artifact.

**Status as of 2026-07-23** — four of the six are closed; one is a deliberate no.

- **Platform billing can't charge yet (ops-only).** STILL OPEN. `@sparx/billing` engine + trial/suspension enforcement are done; go-live is manual: register live Stripe products/prices, register the billing webhook + `STRIPE_WEBHOOK_SECRET_BILLING`, load price IDs into Secret Manager, apply `20260813000000_platform_billing`. → docs/92 §7, [[stripe]], [[billing-model]].
- ~~**No authenticator-app (TOTP) MFA; operator MFA not enforced.**~~ BUILT 2026-07-23, **hand-off pending** (`pnpm install` for the `qrcode` dep + both migrations through the pipeline + `prisma generate`). `twoFactor()` on BOTH auth instances; tenant staff opt in from the workbench Security pane, operators are forced through `/two-factor-setup` by `requireOperator()`. Backup codes encrypted (plugin default is plain). → docs/16 §2.4, [[better-auth]].
- ~~**Marketing attribution isn't capturing.**~~ DONE 2026-07-22 (`98788784`) — `attribution_*` columns on `Order`, the same-day visitor-hash resolver in `api-rest/src/lib/attribution.ts`, `attributionBreakdown` reporting, the "What brings in sales" dashboard tile, and the `get_sales_by_traffic_source` MCP tool.
- ~~**Email operator UI regressed to stubs.**~~ DONE 2026-07-22 (`4a80cb19`) — the four surfaces are real under `apps/workbench/surfaces/email/`.
- ~~**Tenant-facing billing-settings page absent.**~~ WAS ALREADY BUILT — `apps/workbench/surfaces/finance/subscription.tsx` ("Your sparx bill"), registered as `finance.subscription`. The audit missed it because it looked for a `billing` surface; the bill lives under Finance.
- ~~**Domain purchase gated off.**~~ **WON'T DO — product decision, 2026-07-23: sparx does not sell domains at this time.** `DOMAIN_PURCHASE_ENABLED` stays off and the `chargeForDomain`/`refundDomainCharge` seams in `api-rest/src/lib/domain-billing.ts` stay throwing on purpose. Do NOT implement them as "finishing a TODO" — connecting a domain the tenant already owns, and the free `*.sparx.zone` subdomain, are the supported paths. → [[project_no_domain_sales]].

Add to this list when a decision here creates cross-cutting follow-up.

Related: [[kanninja-is-the-record]], [[lessons-learned]]
