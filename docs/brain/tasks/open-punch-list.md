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

- **Platform billing can't charge yet (ops-only).** `@sparx/billing` engine + trial/suspension enforcement are done; go-live is manual: register live Stripe products/prices, register the billing webhook + `STRIPE_WEBHOOK_SECRET_BILLING`, load price IDs into Secret Manager, apply `20260813000000_platform_billing`. → docs/92 §7, [[stripe]], [[billing-model]].
- **Marketing attribution isn't capturing — time-sensitive.** No `attribution_source`/`referrer_host`/`landing_path`/`resolved_at` on `Order` and no traffic→sale resolver (doc 128); the "what makes money" answer resolves to sales-channel, not marketing source. Only capturable forward from ship date — every day unbuilt is lost history. → docs/128, docs/83, [[event-catalog]].
- **Email operator UI regressed to stubs.** Broadcasts / sending-domains-DNS / suppressions / settings are placeholder surfaces (no `apps/workbench/surfaces/email/`), though the full REST API + MCP tools + 21 templates are complete behind them. → docs/13, [[email-pipeline]].
- **No authenticator-app (TOTP) MFA; operator MFA not enforced.** Passkeys + email OTP + magic link exist (phishing-resistant 2FA present), but no `twoFactor`/TOTP plugin, and admin auth doesn't require MFA (docs/16 §2.4). → [[better-auth]].
- **Tenant-facing billing-settings page absent.** No `apps/workbench/app/settings/billing` and no billing surface — only the chrome banner. Customer-Portal API exists; the plan-summary/trial/enterprise page to open it doesn't. → docs/17, docs/92.
- **Domain purchase gated off.** Charge-first/refund-on-failure flow built, but its billing seams `throw paymentRequired`; needs the off-session `chargeTenantOffSession` helper. `DOMAIN_PURCHASE_ENABLED` stays off until then. → docs/92 §11, [[godaddy]].

Add to this list when a decision here creates cross-cutting follow-up.

Related: [[kanninja-is-the-record]], [[lessons-learned]]
