---
title: partner (program)
node: features
type: reference
status: active
sources:
  - docs/114-organizations-teams-and-partners.md
  - apps/dashboard/app/(dashboard)/partner/_lib/access.ts
  - packages/db/prisma/schema/83-partners.prisma
---

**The canonical program — not a module.** Confirmed on four independent axes: not in `ModuleSlug` / `ALL_MODULES`, not in `moduleManifests`, not in `settings/modules` `VALID_SLUGS` (no billing), and gated by a `partners` tenant-row + org role — never a module flag.

- **Hue:** `partner` `#7C3AED` (violet-600, one notch deeper than chat's violet-500 — so partner chrome reads distinct from any module).
- **Gating (two layers):** tenant opt-in (`partners` row) via `partner/_lib/access.ts` (`canOperatePartner`, `getPartnerAccess`); member role `PARTNER_OPS = {owner, admin, partner}` enforced in `services/api-rest/src/routes/v1/partner/` via `requireAnyRole`.
- **PRD:** docs/114 (Part B) + docs/78. **UI:** `(dashboard)/partner/` + `settings/partner/`. **API:** `v1/partner/*`, `v1/public/partners`, `internal/partners`; `packages/partner-schemas/`; no MCP. **Data:** `83-partners.prisma` (+ `84-bootcamps`).

**Why it's here:** partner is the lesson that produced this whole taxonomy — see [[partner-pages-drift]]. Build partner surfaces in the **console vocabulary**, not marketing ([[console-is-not-marketing]], [[in-console-document]]).

Related: [[taxonomy]], [[partner-pages-drift]], [[console-is-not-marketing]], [[in-console-document]]
