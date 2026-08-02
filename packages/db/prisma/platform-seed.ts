// PLATFORM data — the rows that belong to the PLATFORM itself, not to any
// tenant and not to the local demo: the global platform component library, and
// the starter legal pages every tenant is entitled to.
//
// WHY THIS IS A SEPARATE FILE FROM seed.ts. They are two different deliverables
// that happened to share one entrypoint, and the seam only showed up in
// production. `prisma/seed.ts` provisions a DEMO tenant — e2e-staff@sparx.test,
// a diesel parts catalog, fake orders, fake bookings, a fake partner payout —
// which is exactly right on a laptop and unshippable to a live platform. So the
// seed was never wired into any deploy, and the platform data trapped inside it
// never shipped either. `marketplace_themes` held ZERO rows in production across
// both clouds while 20 theme bundles sat committed in the repo, and
// /market/themes served its empty state to every visitor for a month.
//
// Everything here is therefore held to a stricter contract than the demo seed:
//
//   IDEMPOTENT   — every write is an upsert or a find-or-create keyed on a
//                  stable natural key. Re-running changes nothing but
//                  updated_at, which is what lets it run on EVERY deploy
//                  rather than being a thing someone remembers to trigger.
//   TENANT-SAFE  — it creates no tenants and invents no business data. The one
//                  function that touches tenant rows (backfillLegalPages) only
//                  adds platform-authored legal documents that every tenant is
//                  owed, and skips any that already exist.
//   LOUD IN PROD — see `tolerateFailures`. On a laptop a catalog hiccup should
//                  not block the demo seed; in a deploy it must fail the
//                  rollout. Swallowing errors is how "the seed ran green" and
//                  "the catalog is empty" were true at the same time.
//
// Consumed by TWO entrypoints: prisma/seed.ts (local dev, tolerant) and
// prisma/seed-platform.ts (the deploy's data stage, strict).

import { readFileSync } from 'node:fs';

import { PrismaClient, type Prisma } from '@prisma/client';

import { LEGAL_TEMPLATES, legalEntryBody } from '@sparx/legal-templates';
import { PLATFORM_CATALOG } from '@sparx/builder-schemas';

// The owner (sparx_owner) connection string, for the few GLOBAL, owner-write
// tables (e.g. platform_components). Prefers the ambient env (prod sets it on
// the job); falls back to reading packages/db/.env in dev — dependency-free so
// the seed needs no dotenv. Falls back to the default URL if neither resolves.
export function ownerDatabaseUrl(): string | undefined {
  if (process.env.MIGRATION_DATABASE_URL) return process.env.MIGRATION_DATABASE_URL;
  try {
    const env = readFileSync('.env', 'utf8');
    const match = /^\s*MIGRATION_DATABASE_URL\s*=\s*"?([^"\n\r]+)"?/m.exec(env);
    if (match?.[1]) return match[1].trim();
  } catch {
    // no .env file (e.g. prod) — fall through to the default connection
  }
  return process.env.DATABASE_URL;
}

// THE MARKETPLACE CATALOG IS NOT SEEDED, AND NOTHING HERE PUBLISHES A LISTING.
//
// All four categories — themes, components, blueprints, integrations — are published
// by api-rest at BOOT, into the same rows a licensed collaborator's upload will write
// (services/api-rest/src/lib/marketplace/self-register.ts, docs/85 §14). It also
// RETRACTS by absence, which a seed structurally cannot do: a seed that deleted rows
// would be a destructive migration wearing a seed's clothes.
//
// This file used to own three of the four categories, by three different mechanisms —
// six dead theme "foundations", 15 PascalCase component pointers carrying no tree, and
// a blueprint loop over an in-code registry that was deliberately empty — beside a
// release-stage ingest Job that owned the fourth. Four mechanisms for one job.
//
// The last to move was `SPARX_INTEGRATIONS`, and it moved for a reason worth keeping:
// integrations have no upload story yet, so leaving them behind here would have read as
// "integrations are different" exactly when someone sits down to build that story.

// Backfill starter legal pages + footer placements for EXISTING tenants (docs/42
// Slice 7). New tenants get these from the legal-seed-worker on `tenant.created`;
// this covers tenants created before that worker existed. Idempotent find-or-create
// per (tenant, template) — re-running skips everything already present — and it
// reuses @sparx/legal-templates for the canonical bodies, so there is no fragile
// inline-SQL copy of the legal text.
//
// content_entries + site_doc_placements are FORCE-RLS, so each tenant's
// writes run inside a transaction with app.tenant_id SET LOCAL to that tenant
// (the WITH CHECK is tenant_id = current_tenant_id()). This mirrors the
// legal-seed-worker's withTenant() path; sparx_owner is a non-superuser in prod,
// so the per-tenant set_config is mandatory (see packages/db/CLAUDE.md).
export async function backfillLegalPages(prisma: PrismaClient): Promise<void> {
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  let created = 0;

  for (const { id: tenantId } of tenants) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);

      for (const [i, t] of LEGAL_TEMPLATES.entries()) {
        const existing = await tx.contentEntry.findFirst({
          where: { typeKey: 'page', slug: t.defaultSlug },
          select: { id: true },
        });

        let entryId: string;
        if (existing) {
          entryId = existing.id;
        } else {
          const entry = await tx.contentEntry.create({
            data: {
              tenantId,
              typeKey: 'page',
              slug: t.defaultSlug,
              status: 'draft',
              body: legalEntryBody(t) as unknown as Prisma.InputJsonObject,
              legalKind: t.legalKind,
              legalTemplateVersion: t.templateVersion,
            },
            select: { id: true },
          });
          entryId = entry.id;
          created++;
        }

        const existingPlacement = await tx.siteDocPlacement.findFirst({
          where: { placement: 'footer', sourceKind: 'cms_entry', entryId },
          select: { id: true },
        });
        if (!existingPlacement) {
          await tx.siteDocPlacement.create({
            data: {
              tenantId,
              placement: 'footer',
              sourceKind: 'cms_entry',
              entryId,
              legalKind: t.legalKind,
              label: t.title,
              columnKey: 'legal',
              position: i,
            },
          });
        }
      }
    });
  }

  console.log(
    `Backfilled legal pages for ${tenants.length} tenant(s): ${created} entr(ies) created.`
  );
}

// The platform COMPONENT catalog (docs/98 §5) — the GLOBAL platform_components table
// (no tenant_id). The published library IS the data-as-code PLATFORM_CATALOG, so the
// seed mirrors every entry in as a `published` row: this is what the
// `/v1/platform/catalog/*` API serves and what a future admin app lists. Idempotent
// upsert by key; descriptions are clamped to the column's 280-char bound. Authored by
// the reserved `system` id (the seed predates any real platform user). Stays in sync
// with the static catalog automatically — new catalog entries seed with no change here.
export async function seedPlatformCatalog(): Promise<void> {
  // platform_components is GLOBAL with owner-only writes: the sparx_app role can
  // only SELECT published rows (packages/db/CLAUDE.md), so the default seed
  // connection's upsert violates RLS. Write through the owner connection
  // (MIGRATION_DATABASE_URL = sparx_owner) so it passes in both docker and prod.
  const owner = new PrismaClient({ datasourceUrl: ownerDatabaseUrl() });
  try {
    for (const e of PLATFORM_CATALOG) {
      const data = {
        name: e.name,
        category: e.category,
        kind: e.kind,
        icon: e.icon,
        description: e.description.slice(0, 280),
        surfaces: e.surfaces,
        tree: e.tree as unknown as Prisma.InputJsonValue,
        tags: e.tags ?? [],
        status: 'published' as const,
        visibility: 'public' as const,
      };
      await owner.platformComponent.upsert({
        where: { key: e.key },
        update: data,
        create: { key: e.key, authorId: 'system', ...data },
      });
    }
    console.log(`[seed] platform component catalog: ${PLATFORM_CATALOG.length} entries published`);
  } finally {
    await owner.$disconnect();
  }
}
/** Apply every piece of platform-owned data, in dependency order.
 *
 *  `tolerateFailures` is the ONLY behavioural difference between the two
 *  callers, and it is deliberate. Local dev passes true: a marketplace hiccup
 *  must not stop a developer getting a working demo tenant. The deploy passes
 *  false, so a failure here fails the Job and therefore the deploy — because the
 *  alternative is what already happened once, a green pipeline sitting on top of
 *  an empty catalog with the reason logged as a warning nobody read.
 */
export async function seedPlatformData(
  prisma: PrismaClient,
  opts: { tolerateFailures?: boolean } = {}
): Promise<void> {
  const steps: [string, () => Promise<void>][] = [
    // NOTE: no marketplace step. api-rest publishes the whole catalog on boot — see
    // the note at the top of this file.
    //
    // Global platform component library (docs/98 §5) — writes through the OWNER
    // connection, since platform_components is owner-write.
    ['platform component catalog', seedPlatformCatalog],
    // Starter legal pages for tenants that predate the legal-seed-worker
    // (docs/42 Slice 7). Find-or-create per (tenant, template).
    ['legal pages backfill', () => backfillLegalPages(prisma)],
  ];

  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!opts.tolerateFailures) {
        throw new Error(`platform seed failed at "${label}": ${message}`, { cause: err });
      }
      console.warn(`[seed] ${label} skipped: ${message}`);
    }
  }
}
