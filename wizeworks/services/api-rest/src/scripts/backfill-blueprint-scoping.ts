#!/usr/bin/env tsx
// Backfill: give per-site scope to the categories and collections that blueprint
// installs created GLOBAL, using only rows whose owning site can be PROVEN.
//
//   pnpm --filter @wizeworks/api-rest ops:backfill-blueprint-scoping                 # dry run
//   pnpm --filter @wizeworks/api-rest ops:backfill-blueprint-scoping -- --apply
//   pnpm --filter @wizeworks/api-rest ops:backfill-blueprint-scoping -- --tenant=wizeworks
//
// ── WHY THIS EXISTS ────────────────────────────────────────────────────────────
// In Model B (docs/49 §3) a category or collection with NO `commerce_category_properties`
// / `commerce_collection_properties` rows is visible on EVERY site the tenant owns. The
// blueprint installer never passed `propertyIds` when it minted one, so every category a
// design created was global — and a tenant that ran two designs on two sites got each
// business's catalogue showing in the other's. Products were always scoped correctly, so
// the leak is confined to the two taxonomy tables. The installer is fixed
// (`blueprint-installer.ts`, `propertyIds: [propertyId]` on create); this closes the rows
// that already exist.
//
// ── WHY IT CANNOT HIDE SOMETHING A SITE IS USING ───────────────────────────────
// Narrowing is the dangerous direction: adding the FIRST link to a global row removes it
// from every other site at once. So a row is only ever narrowed to the union of the sites
// that can be PROVEN to want it, and any row without proof is left global:
//
//   claim A — an install created it. `tenant_blueprint_installs.result.categories` maps
//             handle → id, and the row carries the `property_id` it installed into.
//   claim B — a product in it is scoped to a site. A merchant who filed a product under
//             a category has made that category meaningful on that product's sites,
//             whether or not an install put it there.
//
// Two gates then decide:
//   · ANY product in the row is itself global ⇒ the row is legitimately visible
//     everywhere, because its contents are. SKIPPED, never narrowed.
//   · NO claim at all ⇒ nothing is known about where it belongs, and "unknown" must not
//     be written as if it were a measurement. SKIPPED and reported for a human.
//
// Rows that ALREADY carry links are never touched — they are correct by definition, and
// widening one is the installer's job (`widenScopeIfScoped`), not a backfill's.
//
// The union is computed across ALL installs before anything is written, so a design
// installed onto three sites ends up linked to those three rather than to whichever
// install this run happened to read last.
//
// ── IDEMPOTENT ─────────────────────────────────────────────────────────────────
// Writes go through `createMany({ skipDuplicates: true })`, and a row that gained links
// on a previous run no longer qualifies as global — so a second run reports zero work.
//
// ── RLS ────────────────────────────────────────────────────────────────────────
// `tenant_blueprint_installs`, `commerce_product_categories` and
// `commerce_product_collections` are ENABLE + FORCE RLS and the prod role is a
// non-superuser, so every read and write runs under `withTenant`. A raw `prisma` read
// would return zero rows and exit looking successful (wizeworks/packages/db/CLAUDE.md). The two
// junctions carry no `tenant_id` of their own — their scoping rides the FK parents.

import { prisma, withTenant } from '@wizeworks/db';

const APPLY = process.argv.includes('--apply');
const argValue = (flag: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`${flag}=`))?.slice(flag.length + 1);

const ONLY_TENANT = argValue('--tenant');

type Kind = 'category' | 'collection';

/** One global row and everything known about where it belongs. */
interface Candidate {
  kind: Kind;
  tenantId: string;
  tenantSlug: string;
  id: string;
  name: string;
  handle: string;
  /** Sites proven to want this row — installs that created it, plus the sites its
   *  products are scoped to. Empty ⇒ no evidence, leave global. */
  claims: Set<string>;
  /** Site slugs for the claims above, for the report. */
  claimSlugs: string[];
  /** How the claims were reached, for the report. */
  viaInstall: boolean;
  viaProducts: boolean;
  /** A product in this row is itself global ⇒ the row belongs everywhere. */
  hasGlobalProduct: boolean;
  productCount: number;
}

/** `result.categories` / `result.collections` are `Record<handle, id>` on the install
 *  row. Read defensively: the column is free-form JSON and old rows predate the shape. */
function idsFromInstallResult(result: unknown, key: 'categories' | 'collections'): string[] {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return [];
  const map = (result as Record<string, unknown>)[key];
  if (!map || typeof map !== 'object' || Array.isArray(map)) return [];
  return Object.values(map as Record<string, unknown>).filter(
    (v): v is string => typeof v === 'string' && v.length > 0
  );
}

async function scanTenant(tenantId: string, tenantSlug: string): Promise<Candidate[]> {
  return withTenant({ tenantId }, async (tx) => {
    // Site slugs for the report — one read, reused by every candidate below.
    const properties = await tx.property.findMany({ select: { id: true, slug: true } });
    const slugOf = new Map(properties.map((p) => [p.id, p.slug]));

    // ── Claim A: what each install created, and where it installed it ──────────
    const installs = await tx.tenantBlueprintInstall.findMany({
      select: { propertyId: true, result: true },
    });
    const installClaims: Record<Kind, Map<string, Set<string>>> = {
      category: new Map(),
      collection: new Map(),
    };
    for (const install of installs) {
      const pairs: [Kind, string[]][] = [
        ['category', idsFromInstallResult(install.result, 'categories')],
        ['collection', idsFromInstallResult(install.result, 'collections')],
      ];
      for (const [kind, ids] of pairs) {
        for (const id of ids) {
          const claims = installClaims[kind].get(id) ?? new Set<string>();
          claims.add(install.propertyId);
          installClaims[kind].set(id, claims);
        }
      }
    }

    const candidates: Candidate[] = [];

    // ── The global rows, with their products' scoping ──────────────────────────
    // `propertyLinks: { none: {} }` IS the definition of global in Model B. Live rows
    // only: a soft-deleted row shows on no site, so scoping it changes nothing.
    const categories = await tx.productCategory.findMany({
      where: { deletedAt: null, propertyLinks: { none: {} } },
      select: {
        id: true,
        name: true,
        handle: true,
        products: {
          select: {
            product: {
              select: { deletedAt: true, propertyLinks: { select: { propertyId: true } } },
            },
          },
        },
      },
    });
    const collections = await tx.productCollection.findMany({
      where: { deletedAt: null, propertyLinks: { none: {} } },
      select: {
        id: true,
        name: true,
        handle: true,
        products: {
          select: {
            product: {
              select: { deletedAt: true, propertyLinks: { select: { propertyId: true } } },
            },
          },
        },
      },
    });

    const collect = (
      kind: Kind,
      rows: {
        id: string;
        name: string;
        handle: string;
        products: {
          product: { deletedAt: Date | null; propertyLinks: { propertyId: string }[] };
        }[];
      }[]
    ): void => {
      for (const row of rows) {
        // A soft-deleted product sells nowhere, so it is evidence of nothing — it must
        // not confer a claim NOR count as the global product that vetoes the narrowing.
        const live = row.products.map((p) => p.product).filter((p) => p.deletedAt === null);
        const hasGlobalProduct = live.some((p) => p.propertyLinks.length === 0);
        const productClaims = new Set(
          live.flatMap((p) => p.propertyLinks.map((l) => l.propertyId))
        );
        const fromInstall = installClaims[kind].get(row.id) ?? new Set<string>();
        const claims = new Set([...fromInstall, ...productClaims]);
        candidates.push({
          kind,
          tenantId,
          tenantSlug,
          id: row.id,
          name: row.name,
          handle: row.handle,
          claims,
          claimSlugs: [...claims].map((id) => slugOf.get(id) ?? id).sort(),
          viaInstall: fromInstall.size > 0,
          viaProducts: productClaims.size > 0,
          hasGlobalProduct,
          productCount: live.length,
        });
      }
    };

    collect('category', categories);
    collect('collection', collections);
    return candidates;
  });
}

async function link(c: Candidate): Promise<void> {
  await withTenant({ tenantId: c.tenantId }, async (tx) => {
    const propertyIds = [...c.claims];
    if (c.kind === 'category') {
      await tx.categoryProperty.createMany({
        data: propertyIds.map((propertyId) => ({ categoryId: c.id, propertyId })),
        skipDuplicates: true,
      });
      return;
    }
    await tx.collectionProperty.createMany({
      data: propertyIds.map((propertyId) => ({ collectionId: c.id, propertyId })),
      skipDuplicates: true,
    });
  });
}

/** How a candidate's claims were reached — reported so an operator can judge the
 *  evidence rather than trust a count. */
function evidence(c: Candidate): string {
  const parts: string[] = [];
  if (c.viaInstall) parts.push('install');
  if (c.viaProducts) parts.push(`${c.productCount} product(s)`);
  return parts.join(' + ');
}

async function main(): Promise<void> {
  console.log(
    APPLY
      ? 'APPLYING — scoping global blueprint categories/collections to their proven sites.\n'
      : 'DRY RUN — nothing written.\n'
  );
  if (ONLY_TENANT) console.log(`filtered to tenant: ${ONLY_TENANT}\n`);

  const tenants = await prisma.tenant.findMany({
    select: { id: true, slug: true },
    ...(ONLY_TENANT ? { where: { slug: ONLY_TENANT } } : {}),
  });

  const all: Candidate[] = [];
  for (const tenant of tenants) all.push(...(await scanTenant(tenant.id, tenant.slug)));

  // A single-site tenant cannot leak anything — every site IS the only site, so scoping
  // is a no-op that only adds rows. Reported separately so the numbers stay honest.
  const propertyCounts = new Map<string, number>();
  for (const tenant of tenants) {
    propertyCounts.set(tenant.id, await prisma.property.count({ where: { tenantId: tenant.id } }));
  }

  const multiSite = all.filter((c) => (propertyCounts.get(c.tenantId) ?? 1) > 1);
  const singleSite = all.filter((c) => (propertyCounts.get(c.tenantId) ?? 1) <= 1);

  const scopable = multiSite.filter((c) => c.claims.size > 0 && !c.hasGlobalProduct);
  const globalContents = multiSite.filter((c) => c.hasGlobalProduct);
  const unclaimed = multiSite.filter((c) => c.claims.size === 0 && !c.hasGlobalProduct);

  const byTenant = new Map<string, Candidate[]>();
  for (const c of scopable)
    (byTenant.get(c.tenantSlug) ?? byTenant.set(c.tenantSlug, []).get(c.tenantSlug)!).push(c);

  for (const [slug, group] of [...byTenant.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const sites = new Set(group.flatMap((c) => c.claimSlugs)).size;
    console.log(`${slug}  ·  ${group.length} row(s) → ${sites} site(s)`);
    for (const c of group.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      console.log(
        `    ${c.kind.padEnd(10)} ${c.name.padEnd(28)} → ${c.claimSlugs.join(', ')}   [${evidence(c)}]`
      );
    }
    console.log('');
  }

  if (unclaimed.length > 0) {
    console.log(`${unclaimed.length} row(s) left GLOBAL — no evidence of an owning site:`);
    for (const c of unclaimed)
      console.log(
        `    ${c.tenantSlug} / ${c.kind} ${c.name} (${c.handle}) — no install, no products`
      );
    console.log('');
  }
  if (globalContents.length > 0) {
    console.log(
      `${globalContents.length} row(s) left GLOBAL — they hold a product that is itself global:`
    );
    for (const c of globalContents) console.log(`    ${c.tenantSlug} / ${c.kind} ${c.name}`);
    console.log('');
  }

  console.log(
    `${scopable.length} scopable · ${unclaimed.length} unclaimed · ${globalContents.length} global-by-contents · ` +
      `${singleSite.length} on single-site tenants (skipped — nothing to leak into)\n`
  );

  if (!APPLY) {
    if (scopable.length > 0) console.log('Re-run with --apply to write the links above.');
    return;
  }

  let done = 0;
  for (const c of scopable) {
    await link(c);
    done += 1;
    console.log(
      `scoped  ${c.tenantSlug} / ${c.kind} ${c.name} → ${c.claimSlugs.join(', ')}  (${done}/${scopable.length})`
    );
  }
  console.log(
    `\nDone. ${done} row(s) scoped. ${unclaimed.length + globalContents.length} left global by design.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
