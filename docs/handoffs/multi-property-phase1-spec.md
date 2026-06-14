# Multi-Property (Multi-Site) — Phase 1 Implementation Spec

**Version:** 0.1
**Author:** Brandon Korous
**Last Updated:** 2026-06-04

> Build-ready spec for **Phase 1** of [49-multi-site-per-tenant.md](../archive/49-multi-site-per-tenant.md).
> Design rationale, the two-axes argument, and the full phase map live in doc 49 — read it
> first. This document only captures the **locked decisions** and the **exact deltas** for the
> first structural slice.

---

## 1. Locked decisions (this is what's different from doc 49's open questions)

| Decision                     | Choice                                                    | Rationale                                                                                                                                                                                                                                                                                                                      |
| ---------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Entity name**              | **`Property`** (table `properties`, column `property_id`) | Not "Site" — collides with the legacy `sitebuilder_*` `Site*` tables during the transition. Not "Site" — content-and/or-commerce, bigger than a store. Not "Channel"/"Surface" — both already taken (`channelsEnabled`, `@sparx/surface`). "Web property" is the industry term and scales from microsite → site → publication. |
| **Surface scope**            | **Builder only**                                          | Re-key only the go-forward Builder render path (`builder_pages`, `builder_layouts`). The legacy `sitebuilder_*` tables stay single-site and are retired (deleted) later, not re-keyed.                                                                                                                                         |
| **SiteSettings / SiteTheme** | **Deferred**                                              | Commerce-owned; the Builder path themes off Surface CSS + `TenantBrand`, not `SiteTheme`. With a single primary property in Phase 1, per-property currency/theme is unobservable. Re-key when the second-property + per-property-theming UX lands.                                                                             |
| **Migration base**           | Apply pending migrations first                            | ✅ Done — `builder_multi_layouts`, `builder_page_seo`, `seo_audits` confirmed live in prod (chain is linear).                                                                                                                                                                                                                  |
| **Isolation**                | `property_id` is **app-tier scoping only**                | `tenant_id` stays the only RLS security boundary. `property_id` gets **no** RLS policy anywhere. Hard isolation = multi-workspace, not multi-property (doc 49 §2).                                                                                                                                                             |

---

## 2. The A/B split (collision-aware sequencing)

A parallel agent is editing `builder_pages`/`builder_layouts` (docs/51 content-types: `record_type` →
first-class type↔template link). To make progress without a schema-file collision, Phase 1 is split:

- **Step A — Property foundation (this slice).** New `properties` table + RLS + partial-unique
  `is_primary` + backfill one primary property per tenant + `Tenant.properties` relation. Touches
  **zero** contended files. Purely additive, no behavior change, ships independently ("deploy small").
- **Step B — Re-key (after content-types lands).** Add `property_id` to `builder_pages`/
  `builder_layouts`, swap unique keys, thread `propertyId` through the service + public resolver +
  Surface-CSS aggregation. This is the contended surface — sequence it **after** the content-types
  agent's Builder-schema work merges.

---

## 3. Step A — exact deltas

### 3.1 New model — `packages/db/prisma/schema/08-property.prisma`

```prisma
model Property {
  id        String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId  String  @map("tenant_id") @db.Uuid
  slug      String  @db.VarChar(63)
  name      String  @db.VarChar(255)
  isPrimary Boolean @default(false) @map("is_primary")
  status    String  @default("active") @db.VarChar(20)   // active | paused | archived
  settings  Json    @default("{}")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, slug])
  @@index([tenantId])
  @@map("properties")
}
```

- The **partial unique** `(tenant_id) WHERE is_primary` (exactly one primary per tenant) and the
  **RLS policy** are not expressible in Prisma — they live in the migration SQL only (Prisma's
  differ ignores both), mirroring `builder_layouts_one_active_per_tenant` and every `*_tenant_isolation`.

### 3.2 `packages/db/prisma/schema/02-tenant.prisma`

Add one back-relation in the "Platform core" section:

```prisma
  // Multi-property (multi-site) — a tenant's web properties (docs/49). Phase 1
  // seeds exactly one is_primary property per tenant; the presentation layer
  // re-keys onto it in a later slice.
  properties Property[]
```

### 3.3 Migration — `20260626000000_properties/migration.sql`

`CREATE TABLE properties` (snake_case cols) → unique `(tenant_id, slug)` + index `(tenant_id)` → FK
to `tenants` (cascade) → **ENABLE + FORCE RLS** + `properties_tenant_isolation` policy on
`current_tenant_id()` → **backfill** one primary property per tenant in a per-tenant
`set_config('app.tenant_id', …)` loop (FORCE RLS + non-superuser `sparx_owner` in prod ⇒ the INSERT's
`WITH CHECK` only passes with `app.tenant_id` set) → partial unique `(tenant_id) WHERE is_primary` →
`ALTER COLUMN updated_at DROP DEFAULT` (Prisma owns the timestamp).

> If the content-types agent's migration also lands at `2026-06-26`, rename this one to sequence
> after it (Prisma applies lexically; only identical dir names conflict).

---

## 4. Step B — re-key (deferred, documented for continuity)

Not built in this slice. When the content-types Builder-schema work merges:

1. `BuilderPage`: add `propertyId`; `@@unique([tenantId, slug])` → `@@unique([tenantId, propertyId, slug])`;
   `getPublishedByRecordType` filters by property.
2. `BuilderLayout`: add `propertyId`; partial unique `(tenant_id) WHERE is_active` →
   `(tenant_id, property_id) WHERE is_active` (one active chrome **per property**).
3. `ServiceContext` (`packages/builder/src/errors.ts` = `TenantContext`) gains optional `propertyId`;
   every read in `page-service.ts` / `layout-service.ts` / `surface-css-service.ts` filters by it.
4. `resolvePrimaryProperty(tenantId)` helper; the public route (`v1/public/builder.ts`) and dashboard
   Server Actions resolve the **primary** property and pass it in — **zero observable change** until
   Phase 2 flips that one line to host→property.
5. Surface CSS aggregation scopes to the property.
6. Migration: add `property_id` nullable → backfill each row with its tenant's primary property
   (per-tenant `set_config` loop) → `SET NOT NULL` → swap unique keys → FK.

---

## 5. Explicitly out of Phase 1

Host→property routing, create-second-property flow, the dashboard property switcher, per-property
`SiteBrand` override, Model B data scoping, billing add-on, per-property search facet. Phases 2–5 of
doc 49 §10.
