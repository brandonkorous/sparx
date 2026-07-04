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

Add to this list when a decision here creates cross-cutting follow-up.

Related: [[kanninja-is-the-record]], [[lessons-learned]]
