---
title: Modules
type: map
status: active
---

# modules

A **module** is a *paid, feature-flagged product domain* — one of the **12** keys in `ModuleSlug` (`packages/modules/src/index.ts`). Each has a manifest, a catalog entry, a Stripe price, and a flag at `tenants.settings.modules.<slug>.enabled` (**default-deny**). That is the strict definition: anything with a hue but no `ModuleSlug` key is a **program** or **platform** capability — see [[features]] and [[taxonomy]].

See [[module-mechanism]] for how a module is wired and gated. The *principle* (gate by module flag, never by plan) lives in [[architecture]] + [[billing-model]].

## The 12 modules

| Module | Hue | PRD | UI `(dashboard)/` | API / MCP | Data `prisma/schema/` |
|---|---|---|---|---|---|
| **builder** | indigo `#6366F1` | docs/40 (+08,29,30,98) | `builder/` | `v1/builder/*`, `v1/sitebuilder/*` · builder+sitebuilder mcp | 49,51,56,07 |
| **commerce** | orange `#F97316` | docs/09 | `commerce/` | `v1/commerce/*` · commerce mcp | 30–47 commerce-* |
| **cms** | teal `#14B8A6` | docs/12 | `cms/` | `v1/content/*`, media, navigation… | 10–16 cms-* |
| **crm** | cyan `#06B6D4` | docs/11 | `crm/` | `v1/crm/*` · crm mcp | 20–32 crm-* |
| **email** | sky `#0EA5E9` | docs/13 (+91) | `email/` | `v1/email/*` · email mcp · `email-worker` | 50-email |
| **b2b** | slate `#475569` | docs/10 | `b2b/` *(REQUIRES commerce)* | `v1/b2b/*` | 21,41,60–64 |
| **invoicing** | lime `#65A30D` | docs/75,87 | `invoicing/` *(BUNDLED_FREE)* | `v1/invoicing/*` · invoicing mcp | 72-invoicing |
| **dropship** | emerald `#10B981` | docs/14 | `dropship/` | `v1/dropship/*` | 65-dropship |
| **inventory** | amber `#F59E0B` | docs/66,100 | `inventory/` *(BUNDLED_FREE)* | `v1/inventory/*` · inventory mcp | 34–40,66 |
| **chat** | violet `#8B5CF6` | docs/56 | `chat/` + `settings/chat/` | `v1/chat/*` + ws-token | 57-chat |
| **scheduling** | rose `#F43F5E` | docs/79 | `scheduling/` | `v1/scheduling/*`, `v1/public/scheduling*` · scheduling mcp | 78 (+64) |
| **ai** | magenta `#EC4899` | docs/07 | `ai/` + `settings/ai-integrations/` | **is** `services/api-mcp/` · `v1/ai/*` | 82-ai |

Building in a module? Open its row, read its PRD, and **match its existing UI** before adding surfaces ([[design]], [[components]]).

## Per-module notes

Created **boy-scout**, seeded from the row above, as we work each module — a stub that only echoes its table row would be duplication ([[CONTRACT]]). Real per-module gotchas + "how to build here" land in `modules/<slug>.md` when that module is worked.

## Sources of truth

`packages/modules/src/index.ts` (the registry) · `apps/dashboard/app/(dashboard)/_shell/registry.ts` (manifests + order) · `packages/ui/src/providers/module-provider.tsx` (hues) · `packages/auth/src/module-gate.ts` (the gate).
