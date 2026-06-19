// Throwaway end-to-end verification for the blueprint UPDATE engine (docs/55).
// Provisions an isolated tenant, installs a blueprint, then proves the three things
// that matter:
//   A) PARITY — an unchanged new version yields ZERO changes (baseline == live).
//   B) MERGE  — a tenant theme edit survives an author update; untouched fields
//      fast-forward; the same-field clash is a conflict kept as the tenant's value.
//   C) ADVANCE — after apply, the install version + baselines move forward, so a
//      re-run sees nothing to do.
// Deletes the throwaway tenant at the end (cascade). Run:
//   pnpm --filter @sparx/api-rest exec tsx src/scripts/verify-blueprint-update.ts

import type { FastifyBaseLogger } from 'fastify';

import { prisma, withTenant } from '@sparx/db';
import { safeParseBlueprint, type Blueprint } from '@sparx/blueprints';
import { savedThemeService } from '@sparx/sitebuilder';
import { productService, variantService } from '@sparx/commerce';

import { installBlueprint } from '../lib/blueprint-installer.js';
import { applyUpdate, planUpdate } from '../lib/blueprint-updater.js';
import { readArtifact } from '../lib/marketplace/artifacts.js';

/** Resolve a blueprint manifest from the catalog (data-first: object storage). */
async function resolveCatalogBlueprint(): Promise<Blueprint> {
  const row = await prisma.marketplaceBlueprint.findFirst({
    where: { status: 'published' },
    select: { slug: true, version: true },
    orderBy: { slug: 'asc' },
  });
  if (!row) throw new Error('No published marketplace blueprint to verify against.');
  const artifact = await readArtifact('blueprints', row.slug, row.version);
  if (artifact == null) throw new Error(`No stored artifact for ${row.slug}@${row.version}.`);
  const parsed = safeParseBlueprint(artifact);
  if (!parsed.success)
    throw new Error(`Blueprint ${row.slug} failed to parse: ${JSON.stringify(parsed.issues)}`);
  return parsed.data;
}

/* eslint-disable no-console */

const noop = (): undefined => undefined;
const log = {
  info: noop,
  warn: noop,
  error: noop,
  debug: noop,
  trace: noop,
  fatal: noop,
  level: 'silent',
  child: () => log,
} as unknown as FastifyBaseLogger;

const PRESETS = ['market', 'apex', 'drift', 'industrial', 'fleet', 'drop'] as const;
let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures += 1;
    console.log(`  ✗ ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`);
  }
}

async function main(): Promise<void> {
  const stamp = Date.now();
  const slug = `bp-update-verify-${stamp}`;
  const bp = await resolveCatalogBlueprint();
  console.log(`Blueprint: ${bp.key} v${bp.version}`);

  // ── provision a throwaway tenant + primary property ──────────────────────────
  const tenant = await prisma.tenant.create({
    data: { slug, name: `Verify ${stamp}`, email: `${slug}@example.test` },
    select: { id: true },
  });
  const tenantId = tenant.id;
  const ctx = { tenantId };
  const property = await withTenant(ctx, (tx) =>
    tx.property.create({
      data: { tenantId, slug: 'primary', name: 'Verify Site', isPrimary: true },
      select: { id: true },
    })
  );
  const propertyId = property.id;
  const uctx = { tenantId, userId: null, propertyId, logger: log };

  try {
    // ── install v1 ──────────────────────────────────────────────────────────────
    const { installId } = await installBlueprint(
      { tenantId, userId: null, propertyId, logger: log },
      bp
    );
    console.log(`Installed → ${installId}`);
    const install = await withTenant(ctx, (tx) =>
      tx.tenantBlueprintInstall.findFirstOrThrow({ where: { id: installId } })
    );
    const themeId = (install.result as { theme?: { id: string } }).theme?.id;

    // ── A) PARITY: identical content, only the version bumped → zero changes ─────
    const sameButNewer: Blueprint = { ...structuredClone(bp), version: '9.9.0' };
    const planA = await planUpdate(uctx, install, sameButNewer);
    console.log('A) parity', JSON.stringify(planA.summary));
    check('A1 updatable (version differs)', planA.updatable === true, planA);
    check('A2 zero auto changes', planA.summary.auto === 0, planA.summary);
    check('A3 zero conflicts', planA.summary.conflicts === 0, planA.summary);
    check(
      'A4 every artifact unchanged',
      planA.artifacts.every((a) => a.status === 'unchanged'),
      planA.artifacts
        .filter((a) => a.status !== 'unchanged')
        .map((a) => [a.kind, a.naturalKey, a.status])
    );

    // ── B) MERGE: tenant renames the theme; author bumps preset + renames it ────
    if (!themeId) throw new Error('Install produced no theme to test.');
    const origPreset = bp.theme.basePresetKey;
    const newPreset = PRESETS.find((p) => p !== origPreset) ?? 'apex';
    await savedThemeService.update(ctx, themeId, { name: 'Tenant Renamed Theme' });

    const v2: Blueprint = {
      ...structuredClone(bp),
      version: '9.9.1',
      theme: {
        ...structuredClone(bp.theme),
        name: 'Author Renamed Theme',
        basePresetKey: newPreset,
      },
    };
    const planB = await planUpdate(uctx, install, v2);
    const themeDiff = planB.artifacts.find((a) => a.kind === 'theme');
    console.log('B) theme diff', JSON.stringify(themeDiff));
    check('B1 theme is a conflict', themeDiff?.status === 'conflict', themeDiff?.status);
    check(
      'B2 name conflict kept tenant value',
      themeDiff?.changes.some(
        (c) => c.path === 'name' && c.type === 'conflict' && c.taken === 'mine'
      ) ?? false
    );
    check(
      'B3 basePresetKey auto fast-forwards',
      themeDiff?.changes.some((c) => c.path === 'basePresetKey' && c.type === 'auto') ?? false
    );

    // apply (no take_theirs → keep tenant on conflict)
    const applied = await applyUpdate(uctx, install, v2, []);
    console.log(
      '   applied',
      JSON.stringify({ applied: applied.applied, conflicts: applied.conflicts })
    );
    const themeAfter = await withTenant(ctx, (tx) =>
      tx.siteTheme.findUniqueOrThrow({
        where: { id: themeId },
        select: { name: true, basePresetKey: true },
      })
    );
    check(
      'B4 tenant theme name SURVIVED apply',
      themeAfter.name === 'Tenant Renamed Theme',
      themeAfter.name
    );
    check(
      'B5 author preset applied',
      themeAfter.basePresetKey === newPreset,
      themeAfter.basePresetKey
    );

    // ── C) ADVANCE: version bumped + baselines advanced → re-run is clean ────────
    const installAfter = await withTenant(ctx, (tx) =>
      tx.tenantBlueprintInstall.findFirstOrThrow({ where: { id: installId } })
    );
    check(
      'C1 install version advanced to v2',
      installAfter.blueprintVersion === '9.9.1',
      installAfter.blueprintVersion
    );
    const planC = await planUpdate(uctx, installAfter, v2);
    check(
      'C2 re-running the same update is a no-op',
      planC.summary.auto === 0 && planC.summary.conflicts === 0,
      planC.summary
    );
    check(
      'C3 tenant rename now reads as a tenant-only edit (kept, not re-flagged)',
      planC.artifacts.find((a) => a.kind === 'theme')?.status === 'unchanged'
    );

    // ── D) COMMERCE: a tenant product title + variant price survive an update ────
    const products =
      (install.result as { products?: { handle: string; id: string }[] }).products ?? [];
    const prod = products[0];
    const bpProd = bp.commerce?.products?.[0];
    if (prod && bpProd && bp.commerce) {
      await productService.update(ctx, prod.id, { title: 'Tenant Product Title' });
      const variants = await withTenant(ctx, (tx) =>
        tx.productVariant.findMany({
          where: { productId: prod.id, deletedAt: null },
          select: { id: true },
          take: 1,
        })
      );
      const v0 = variants[0];
      if (v0) await variantService.update(ctx, v0.id, { priceCents: 31337 });

      // v3: author renames the SAME product (conflict with the tenant) but leaves price.
      const v3: Blueprint = structuredClone(bp);
      v3.version = '9.9.2';
      v3.commerce!.products[0]!.title = 'Author Product Title';
      const after = await withTenant(ctx, (tx) =>
        tx.tenantBlueprintInstall.findFirstOrThrow({ where: { id: installId } })
      );
      const planD = await planUpdate(uctx, after, v3);
      check(
        'D0 product title is a conflict (both renamed)',
        planD.artifacts.find((a) => a.kind === 'product')?.status === 'conflict'
      );
      await applyUpdate(uctx, after, v3, []); // keep tenant on conflict
      const prodAfter = await withTenant(ctx, (tx) =>
        tx.product.findFirstOrThrow({ where: { id: prod.id }, select: { title: true } })
      );
      check(
        'D1 tenant product title SURVIVED apply',
        prodAfter.title === 'Tenant Product Title',
        prodAfter.title
      );
      if (v0) {
        const priceAfter = await withTenant(ctx, (tx) =>
          tx.productVariant.findFirstOrThrow({ where: { id: v0.id }, select: { priceCents: true } })
        );
        check(
          'D2 tenant variant price is sacred (untouched by the update)',
          priceAfter.priceCents === 31337,
          priceAfter.priceCents
        );
      }
    } else {
      console.log('   (blueprint has no product — skipping commerce check D)');
    }
  } finally {
    // ── cleanup ──────────────────────────────────────────────────────────────────
    await prisma.tenant.delete({ where: { id: tenantId } }).catch((err) => {
      console.log(`cleanup warning: ${String(err)}`);
    });
    console.log('Cleaned up throwaway tenant.');
  }

  console.log(failures === 0 ? '\n✅ ALL CHECKS PASSED' : `\n❌ ${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
