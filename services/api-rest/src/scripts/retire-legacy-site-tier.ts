#!/usr/bin/env tsx
// Retire the legacy sparx-builder tier: re-seed a legacy-only site onto silica.
//
//   pnpm --filter @sparx/api-rest ops:retire-legacy-tier                  # dry run
//   pnpm --filter @sparx/api-rest ops:retire-legacy-tier -- --apply
//   pnpm --filter @sparx/api-rest ops:retire-legacy-tier -- --tenant=harbor-pine
//
// ── THIS DESTROYS AUTHORED CONTENT, AND THAT IS THE POINT ──────────────────────
// It is not a backfill and it is not reversible. A legacy-only property's pages are
// DELETED and replaced with the current silica starter. There is no `.bx-*` → silica
// translator — `emailTreeToSilica` converts email trees and has no page counterpart —
// so "move these sites onto silica" cannot mean "carry their design across". It can
// only mean re-seed, and the authored trees go.
//
// `siteService.reset` deliberately refuses to do this ("a reset must never destroy the
// tree the legacy storefront is still serving"), which is the correct default while the
// two tiers run in parallel. This task is the explicit decision to end the parallel run
// for a given site, so it is a separate, confirmation-gated ops entry rather than a
// loosening of that guard.
//
// ── WHAT THESE SITES LOOK LIKE TODAY, WHICH IS WHY IT IS WORTH DOING ──────────
// A legacy-only property is already HALF broken, in a way that is easy to miss because
// each half looks fine on its own:
//
//   · Starter slugs (`/`, `/shop`, `/about`, `/contact`) are SHADOWED. `apps/site`'s
//     silica reads fall back to the code starter when a property has published no
//     silica (lib/silica.ts), and the home route's legacy tier was deleted on the
//     premise that the fallback made it unreachable. So a tenant with a real, published,
//     authored Home serves "Your work, beautifully online." to every visitor.
//   · Every other slug still renders its real legacy tree through the `[...slug]`
//     catch-all, which was correctly kept.
//
// So the site is half platform-generic and half the tenant's, and no screen anywhere
// says so. Re-seeding makes it whole and — unlike today — EDITABLE, because only silica
// rows reach the page switcher.
//
// ── WHAT IT WRITES ────────────────────────────────────────────────────────────
// Per property, inside one tenant-scoped transaction:
//   1. DELETE every builder_page row (assignments cascade) and every builder_layout.
//   2. `siteService.sync(..., { allowReplace: true })` with `starterSite(theme, flags)`
//      — the same path a blueprint install and the editor's first save use, so the
//      result is exactly what a fresh site gets rather than a hand-rolled approximation.
//   3. `siteService.publish` — otherwise the site would still be served by the code
//      fallback, which is the condition this task exists to end.
//
// The THEME is the one the site already wears (`effectiveTheme` — authored theme, else
// the tenant's brand compiled, else a preset). Re-seeding the content must not silently
// restyle the business.
//
// Module flags follow `GET /v1/builder/site`'s failure directions exactly: Commerce
// fails OPEN so a flag blip never withholds a page from a tenant who pays for it,
// Scheduling and CMS fail CLOSED so a blip never invents one.
//
// ── RLS ───────────────────────────────────────────────────────────────────────
// `builder_pages` is ENABLE + FORCE RLS and the prod role is a non-superuser, so every
// read and write runs under `set_config('app.tenant_id', …)`. `siteService` does this
// itself via `withTenant`; the SCAN has to do it by hand, or it reports zero properties
// and exits looking successful (packages/db/CLAUDE.md).

import { isModuleEnabled } from '@sparx/auth';
import { siteService, type PropertyContext } from '@sparx/builder';
import { prisma, withTenant } from '@sparx/db';
import { BASE_SILICA_THEME, starterSite } from '@sparx/silica-catalog';

import { effectiveTheme } from '../lib/effective-theme.js';

const APPLY = process.argv.includes('--apply');
const ONLY_TENANT = process.argv.find((a) => a.startsWith('--tenant='))?.slice('--tenant='.length);

interface Target {
  tenantId: string;
  tenantSlug: string;
  propertyId: string;
  propertySlug: string;
  pages: { name: string; slug: string | null; published: boolean }[];
  layouts: number;
}

/**
 * Every property whose site is ENTIRELY legacy: it has pages, and not one of them
 * carries silica in either stage.
 *
 * Both columns are checked, not just the draft. A property with a published silica tree
 * and no draft is live on silica — re-seeding it would replace a site visitors are
 * being served right now, which is a different and much worse operation than the one
 * this task is for.
 */
async function findTargets(): Promise<Target[]> {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, slug: true },
    ...(ONLY_TENANT ? { where: { slug: ONLY_TENANT } } : {}),
  });
  const targets: Target[] = [];

  for (const tenant of tenants) {
    const found = await withTenant({ tenantId: tenant.id }, async (tx) => {
      const properties = await tx.property.findMany({
        where: { tenantId: tenant.id },
        select: { id: true, slug: true },
      });
      const out: Target[] = [];
      for (const property of properties) {
        const pages = await tx.builderPage.findMany({
          where: { propertyId: property.id },
          select: {
            name: true,
            slug: true,
            publishedAt: true,
            silicaDraftTree: true,
            silicaPublishedTree: true,
          },
          orderBy: [{ position: 'asc' }],
        });
        if (pages.length === 0) continue;
        const anySilica = pages.some(
          (p) => p.silicaDraftTree != null || p.silicaPublishedTree != null
        );
        if (anySilica) continue;
        out.push({
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          propertyId: property.id,
          propertySlug: property.slug,
          pages: pages.map((p) => ({
            name: p.name,
            slug: p.slug,
            published: p.publishedAt != null,
          })),
          layouts: await tx.builderLayout.count({ where: { propertyId: property.id } }),
        });
      }
      return out;
    });
    targets.push(...found);
  }
  return targets;
}

/** The module flags that decide which pages the starter composes. */
async function moduleFlags(tenantId: string) {
  const [commerceEnabled, schedulingEnabled, cmsEnabled] = await Promise.all([
    isModuleEnabled(tenantId, 'commerce').catch(() => true),
    isModuleEnabled(tenantId, 'scheduling').catch(() => false),
    isModuleEnabled(tenantId, 'cms').catch(() => false),
  ]);
  return { commerceEnabled, schedulingEnabled, cmsEnabled };
}

async function retire(target: Target): Promise<void> {
  const ctx: PropertyContext = { tenantId: target.tenantId, propertyId: target.propertyId };
  const flags = await moduleFlags(target.tenantId);

  const theme = await withTenant({ tenantId: target.tenantId }, async (tx) => {
    return effectiveTheme(tx, ctx);
  });

  // The rows go in their own transaction, BEFORE the seed. `sync` opens its own
  // (`withTenant` inside the service), so wrapping both here would nest one transaction
  // inside another — and the delete has to be committed before `sync` reconciles, or it
  // reads the rows it is meant to replace and collides on `(tenant, property, slug)`.
  await withTenant({ tenantId: target.tenantId }, async (tx) => {
    await tx.builderPage.deleteMany({ where: { propertyId: target.propertyId } });
    await tx.builderLayout.deleteMany({ where: { propertyId: target.propertyId } });
  });

  // `BASE_SILICA_THEME` only if the brand compile failed outright — the same fallback
  // `resolveEmailBrand` uses, so a tenant whose brand cannot be read gets one platform
  // default rather than two different ones depending on which subsystem asked.
  const site = starterSite(theme ?? BASE_SILICA_THEME, flags);
  await siteService.sync(ctx, site, { allowReplace: true });
  await siteService.publish(ctx);
}

async function main() {
  const targets = await findTargets();

  console.log(
    APPLY ? 'APPLYING — this deletes authored content.\n' : 'DRY RUN — nothing written.\n'
  );
  if (ONLY_TENANT) console.log(`filtered to tenant: ${ONLY_TENANT}\n`);

  if (targets.length === 0) {
    console.log('No legacy-only properties found. Nothing to do.');
    return;
  }

  const totalPages = targets.reduce((n, t) => n + t.pages.length, 0);
  const totalPublished = targets.reduce((n, t) => n + t.pages.filter((p) => p.published).length, 0);
  console.log(
    `${targets.length} legacy-only properties · ${totalPages} pages (${totalPublished} published) would be DELETED and re-seeded.\n`
  );

  for (const t of targets) {
    console.log(
      `${t.tenantSlug} / ${t.propertySlug}   (${t.pages.length} pages, ${t.layouts} layouts)`
    );
    for (const p of t.pages) {
      const where = p.slug ?? '(home)';
      console.log(
        `    ${p.published ? 'published' : 'draft    '}  ${where.padEnd(22)} ${JSON.stringify(p.name)}`
      );
    }
    console.log('');
  }

  if (!APPLY) {
    console.log('Re-run with --apply to write. Nothing above has been changed.');
    return;
  }

  let done = 0;
  for (const t of targets) {
    await retire(t);
    done += 1;
    console.log(`re-seeded  ${t.tenantSlug} / ${t.propertySlug}   (${done}/${targets.length})`);
  }
  console.log(`\nDone. ${done} properties are now on silica and published.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
