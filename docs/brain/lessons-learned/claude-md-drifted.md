---
title: The always-loaded CLAUDE.md itself drifted from the code
node: lessons-learned
type: decision
status: active
sources:
  - CLAUDE.md
  - services/CLAUDE.md
---

Grounding the brain against real code found the **root `CLAUDE.md`** — which loads every turn and is treated as binding — materially stale in several places:

1. **Repo status:** "early scaffold phase… `apps/*` are empty placeholders… `@sparx/ui` has no actual components yet." Reality: **~6 apps, ~18 services, ~60 packages, 164 migrations, 277 Prisma models, ~90 UI components.** The single most misleading statement in the repo.
2. **Email provider:** "Postal on `sparx.email`." Reality: **Mailgun** in prod; Postal decommissioned (fallback only). `services/CLAUDE.md` is correct.
3. **Event names:** cites `order.created` / `customer.updated` — **neither exists** (`order.placed/paid/…`, `search.entity.changed`).
4. **Better Auth primitives:** "use its API-key and MFA primitives." Reality: **API keys are custom; MFA is unimplemented.** Only org membership uses the plugin.

**Why it matters:** a stale *always-loaded* instruction is worse than a stale doc — it's read every turn and trusted by default. It's the macro version of [[spec-drifted-from-token]].

**Fix owed:** correct these four in root `CLAUDE.md` (the operator's call — it's a binding file). Tracked in [[open-punch-list]]. Meanwhile the brain records the grounded truth in [[better-auth]], [[event-catalog]], [[email-pipeline]], [[prisma-schema]].

Related: [[spec-drifted-from-token]], [[CONTRACT]]
