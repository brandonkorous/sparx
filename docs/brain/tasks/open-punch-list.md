---
title: Open punch-list
node: tasks
type: entry
status: active
---

Cross-cutting open items seeded while building the brain (each links to its context). Move anything actionable-now into kanNINJA per [[kanninja-is-the-record]].

- **Fix the 16px body floor in docs.** `DESIGN.md §3` + `docs/23 §4` say 15px; the token + platform guidance say 16px. → [[spec-drifted-from-token]], [[typography]].
- **Graduated docs migration.** As each node is verified, slim its source docs (23 / 35 / 86 / 34 / …) to linked references or retire them, fixing cross-references. → [[doc-style]], [[CONTRACT]].
- **Formalize [[in-console-document]].** It is `status: draft` — turn it into a shared primitive when the next presentational console surface appears.
- **Audit 11px labels** against the 14px caption floor when touching a surface. → [[typography]].
- **Correct the stale root `CLAUDE.md`** — repo-status ("early scaffold / empty apps"), email provider (Postal → Mailgun), event names (`order.created`/`customer.updated` don't exist), Better-Auth API-key/MFA framing. Binding file — operator's call. → [[claude-md-drifted]].
- **Reconcile Phase-1 infra docs** — docs/03 + CLAUDE.md frame Typesense as Phase-2 and email as Postal; live reality is Typesense-now + Mailgun. → [[phased-infra]].
- **Postal decommission cleanup** — remove `packages/email/src/providers/postal.ts` + `k8s/postal/*` once Mailgun is confirmed stable; stub the `sparx.email` DNS records in Cloudflare. → [[mailgun]].

Add to this list when a decision here creates cross-cutting follow-up.

Related: [[kanninja-is-the-record]], [[lessons-learned]]
