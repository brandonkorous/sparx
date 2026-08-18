---
title: Modules
type: map
status: active
---

# modules

A **module** is a *feature-flagged product domain* — one of the **14** keys in `ModuleSlug` (`wizeworks/packages/modules/src/index.ts`). Each has a manifest, a catalog entry, and a flag at `tenants.settings.modules.<slug>.enabled` (**default-deny**). That is the strict definition: anything with a hue but no `ModuleSlug` key is a **program** or **platform** capability — see [[features]] and [[taxonomy]].

Most are *paid*, but not all: a Stripe price is not part of the definition. `social` is a registered module with **no** `MODULE_MONTHLY_CENTS` entry, so it activates at $0 through the normal flow — "paid" was in this sentence for the first twelve and stopped being true when social shipped.

See [[module-mechanism]] for how a module is wired and gated. The *principle* (gate by module flag, never by plan) lives in [[architecture]] + [[billing-model]].

## The 14 modules

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
| **ai** | magenta `#EC4899` | docs/07 | `ai/` + `settings/ai-integrations/` | **is** `wizeworks/services/api-mcp/` · `v1/ai/*` | 82-ai |
| **social** | blue `#2563EB` | docs/133,134 | workbench `surfaces/social/` *(FREE — no price)* | `v1/social/*` · `social-worker` | 87-social |
| **finance** | green `#16A34A` | docs/148 | workbench `surfaces/finance/` | `v1/finance/*` *(pending)* · `@wizeworks/finance` | 89-finance |

Building in a module? Open its row, read its PRD, and **match its existing UI** before adding surfaces ([[design]], [[components]]).

## Per-module notes

Created **boy-scout**, seeded from the row above, as we work each module — a stub that only echoes its table row would be duplication ([[CONTRACT]]). Real per-module gotchas + "how to build here" land in `modules/<slug>.md` when that module is worked.

## Designed, not yet registered

| Planned | Price | Doc | State |
|---|---|---|---|
| **staff** | $29 | docs/149 | Not started. Sequenced behind finance, which it supplies labour cost to — wages are the largest expense for most service businesses, and job profitability is impossible without hours × rate. |

## Finance is the one module with a per-SURFACE gate

Every other module answers "may this account see it?" once, for the whole group. Finance answers it three different ways inside one hue, which is why `SurfaceDefinition.requiresModules` exists (`sparx/apps/workbench/lib/surfaces/registry.ts`):

- **Money coming in** (Payments, Payouts, Owed to you, Where money comes from) — free, gated on *any of* `commerce / invoicing / b2b / scheduling`. It is a view of data the tenant already bought; charging for it would tax data they paid for.
- **Your sparx bill** — `requiresModules: []`, never gated. It is where someone goes to BUY a module.
- **Spend + profitability** — the billable `finance` flag.

The gate is applied by `surfaceIsVisible`, shared by the rail, the mobile drawer, the launcher **and** record-search routing. Absent `requiresModules` means "gate on `module`", which is what every other surface wants.

**The product line both finance and staff hold: sparx records spend and nets it against revenue; it never keeps the books.** No general ledger, no chart of accounts, no payroll, no tax filing — QuickBooks / Sage 50 / Xero keep that trust and we integrate with them instead. Two schema-level traps are locked and commented in `89-finance.prisma`: **stock purchases are not expenses** (PO → inventory value → COGS on sale; expensing the PO double-counts every part), and **never materialize a number the platform already owns** (COGS and fees are read by the rollup, never copied into the ledger). See [[billing-model]] for how the flags bill.

## Sources of truth

`wizeworks/packages/modules/src/index.ts` (the registry) · `apps/dashboard/app/(dashboard)/_shell/registry.ts` (manifests + order) · `sparx/packages/ui/src/providers/module-provider.tsx` (hues) · `wizeworks/packages/auth/src/module-gate.ts` (the gate).
