#!/usr/bin/env tsx
// Move a business's free subdomain onto its OWN brand's zone.
//
//   pnpm --filter @wizeworks/api-rest ops:repair-cross-brand-subdomains            # dry run
//   pnpm --filter @wizeworks/api-rest ops:repair-cross-brand-subdomains -- --apply
//
// ── WHY THIS EXISTS ───────────────────────────────────────────────────────────
//
// This platform runs more than one product on one deployment, and each brand
// mints its tenants' free addresses in its own zone: a sparx business gets
// `<slug>.sparx.zone`, a Piggles business `<slug>.piggles.site`.
//
// Adding a SECOND site went through a different path, and that path took the
// default zone rather than the tenant's. A Piggles business with three sites
// ended up with its first on `piggles.site` and the rest on `sparx.zone` — the
// public web address customers type, carrying the name of a product the shop
// owner has never heard of and cannot find anywhere in her console.
//
// The code is fixed (`tenantZone` + `mintZoneHost`, and the comment on
// `POST /v1/properties` names this exact outcome). What was never fixed is the
// ROWS it had already written. A code fix that leaves its own output behind is
// half a fix, and the half it left is the half customers see.
// [[feedback_data_is_a_deploy_stage]] [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// Measured 2026-09-18 against the local platform database:
//
//   Piggles businesses' addresses on piggles.site          11
//   Piggles businesses' addresses on sparx.zone             3   ← all one shop
//   sparx businesses' addresses on sparx.zone              44
//   sparx businesses' addresses on piggles.site             0
//
// ── WHAT IT DOES, AND WHAT IT REFUSES TO DO ───────────────────────────────────
//
// It MINTS the right host and makes it canonical. It does NOT delete the wrong
// one: that address is live, it may be written on something, and a repair that
// turns a working link into a dead one has traded a cosmetic problem for a real
// one. A non-canonical host redirects to the canonical, so after this runs the
// old address still answers and everything anybody SEES is the right brand.
//
// Only `type: 'subdomain'` rows are considered — the ones the platform minted
// itself. A custom domain is the tenant's own property and is never touched.
//
// The intended zone comes from the tenant's BRAND, not from its rows. Everywhere
// else in this codebase reads the zone off the host, deliberately, because the
// row is the record of what provisioning decided. This is the one place that
// cannot: it exists because some of those rows are wrong, so reading them back
// would be asking the mistake to confirm itself.
//
// A brand with no configured zone is REPORTED and skipped, never guessed at.
// Guessing is what wrote these rows in the first place.
//
// Safe to re-run: a tenant already on its own zone is counted and skipped, and
// the write upserts on the globally-unique host.

// Local runs read `.env`; in the cluster the vars are already on the process.
import 'dotenv/config';

import { platformBrandIdentity } from '@wizeworks/brand-core';
import { prisma, withTenant } from '@wizeworks/db';

import { crossBrandMoves, type ZoneHost } from '../lib/brand-zone-repair.js';
import { normalizeHost } from '../lib/domain.js';

const apply = process.argv.includes('--apply');
const only = process.argv.find((a) => a.startsWith('--tenant='))?.slice('--tenant='.length);

async function main(): Promise<void> {
  const tenants = await prisma.tenant.findMany({
    where: only ? { id: only } : {},
    select: { id: true, slug: true, name: true, platformBrand: true },
    orderBy: { slug: 'asc' },
  });

  let scanned = 0;
  let alreadyRight = 0;
  let repaired = 0;
  let blocked = 0;
  const brandsWithoutZone = new Set<string>();

  for (const tenant of tenants) {
    const zone = normalizeHost(platformBrandIdentity(tenant.platformBrand).zoneDomain ?? '');
    if (zone === '') {
      brandsWithoutZone.add(tenant.platformBrand);
      continue;
    }

    // `domains` HAS NO ROW LEVEL SECURITY, deliberately: the host→site resolver
    // and Caddy's on-demand-TLS ask both look a host up BEFORE any tenant is
    // known, so the row has to be readable without a tenant GUC (the audit's own
    // note, user-approved 2026-06-04). That makes `tenantId` in the WHERE the
    // ONLY thing scoping this read, not a redundant belt — reading it inside
    // `withTenant` without one returns every tenant on the platform.
    //
    // `properties` IS force-RLS, so it is read separately, in context. Asking
    // Prisma to join the two crossed that line and it said so: "Field property is
    // required to return data, got null" — another tenant's domain beside this
    // tenant's properties.
    const rows = await prisma.domain.findMany({
      where: { tenantId: tenant.id, type: 'subdomain' },
      select: { id: true, host: true, propertyId: true },
      orderBy: { host: 'asc' },
    });
    if (rows.length === 0) continue;
    scanned += 1;

    const sites = await withTenant({ tenantId: tenant.id }, (tx) =>
      tx.property.findMany({ select: { id: true, slug: true, isPrimary: true } })
    );
    const siteById = new Map(sites.map((site) => [site.id, site]));

    const hosts: ZoneHost[] = [];
    for (const row of rows) {
      const site = siteById.get(row.propertyId);
      if (!site) {
        console.log(`SKIPPED     ${tenant.slug}: ${row.host} points at a site that is not there.`);
        continue;
      }
      hosts.push({
        host: row.host,
        propertyId: row.propertyId,
        siteSlug: site.slug,
        isPrimary: site.isPrimary,
      });
    }
    // The rule lives in `lib/brand-zone-repair.ts` so it can be tested without a
    // database; this file only reads and writes.
    const wrong = crossBrandMoves(tenant.slug, zone, hosts);
    if (wrong.length === 0) {
      alreadyRight += 1;
      continue;
    }

    for (const item of wrong) {
      // The right host is globally unique and may already belong to somebody —
      // another tenant that took the name, or this same site from a half-run
      // repair. Report and leave it; re-pointing a host somebody else answers on
      // is worse than the address this is fixing.
      const held = await prisma.domain.findUnique({
        where: { host: item.to },
        select: { tenantId: true, propertyId: true },
      });
      const takenByAnother =
        held !== null && (held.tenantId !== tenant.id || held.propertyId !== item.propertyId);
      if (takenByAnother) {
        console.log(
          `BLOCKED     ${tenant.slug} · ${item.siteSlug}: ${item.from} → ${item.to} ` +
            `(that address already belongs to another site)`
        );
        blocked += 1;
        continue;
      }

      if (!apply) {
        console.log(`WOULD MOVE  ${tenant.slug} · ${item.siteSlug}: ${item.from} → ${item.to}`);
        repaired += 1;
        continue;
      }

      await withTenant({ tenantId: tenant.id }, async (tx) => {
        await tx.domain.upsert({
          where: { host: item.to },
          update: { propertyId: item.propertyId, status: 'active' },
          create: {
            tenantId: tenant.id,
            propertyId: item.propertyId,
            host: item.to,
            type: 'subdomain',
            status: 'active',
            isCanonical: false,
          },
        });
        // Sole canonical per site — clear then set, the same order
        // `PATCH /v1/properties/:id/primary` uses. The old host keeps answering
        // and redirects here.
        await tx.domain.updateMany({
          where: { propertyId: item.propertyId, isCanonical: true },
          data: { isCanonical: false },
        });
        await tx.domain.update({ where: { host: item.to }, data: { isCanonical: true } });
      });
      console.log(`moved       ${tenant.slug} · ${item.siteSlug}: ${item.from} → ${item.to}`);
      repaired += 1;
    }
  }

  for (const brand of brandsWithoutZone) {
    console.log(
      `SKIPPED brand "${brand}": no ${brand.toUpperCase()}_ZONE_DOMAIN is set, ` +
        `so there is nothing to say its addresses should be. Set it and re-run.`
    );
  }

  console.log(
    `\n${apply ? 'Applied' : 'Dry run'}: ${String(scanned)} businesses with a platform address, ` +
      `${String(alreadyRight)} already on their own brand, ` +
      `${String(repaired)} ${apply ? 'moved' : 'to move'}, ` +
      `${String(blocked)} blocked.`
  );
  if (!apply && repaired > 0) console.log('Re-run with --apply to write.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    void prisma.$disconnect();
    process.exit(1);
  });
