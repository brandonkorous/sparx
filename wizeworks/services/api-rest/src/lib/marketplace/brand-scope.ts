// Which blueprint listings a platform brand may see.
//
// WizeWorks runs more than one brand on this platform (`tenants.platform_brand`),
// and the blueprint catalog is SHARED between them — deliberately. 169 of the
// templates are branded as invented businesses ("Foundry Coffee Trade"), which is
// exactly what makes them reusable: fork them per brand and every future
// improvement stops at the brand boundary.
//
// The exception is the SHOWCASE family — the ~21 whose `brand.businessName` is
// the platform's own name. Those are not vertical templates, they are the
// platform demonstrating itself, and a demonstration is brand identity by
// definition. There is no neutral version of one: strip the brand and you have a
// bare template, which is what the other 169 already are. So each brand keeps its
// own, and they must not cross — a Piggles business offered a site branded
// "sparx" is a bug with a support ticket attached.
//
// ── WHY A SLUG LIST AND NOT A COLUMN ────────────────────────────────────────
//
// The obvious shape is a `brands` column on `marketplace_blueprints`, filtered in
// SQL. This does the same job with no migration, because the manifests are
// already in the image: read them, and hand the query a `notIn`. That keeps the
// filter IN the SQL — which matters, because the listing paginates and counts,
// and an application-tier filter would return short pages against a total that
// disagrees with them.
//
// If the catalog ever grows past what a `notIn` should carry, promote it to a
// column — the manifest field is already the source of truth either way.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { blueprintCatalogDir } from './blueprint-bundles.js';

/** Blueprint slug → the brands allowed to see it. Only RESTRICTED listings are in
 *  here; an absent slug means "every brand", which is the default. */
type BrandScopes = Map<string, string[]>;

let cached: BrandScopes | null = null;

/**
 * Read the brand restrictions out of the manifests.
 *
 * Deliberately does NOT go through `loadFirstPartyBlueprints`. That validates a
 * whole bundle — dynamically importing each payload and stat-ing its media — and
 * paying 190 dynamic imports to learn one optional field would double what boot
 * already spends. This reads the manifest JSON and nothing else.
 */
async function readBrandScopes(): Promise<BrandScopes> {
  const dir = blueprintCatalogDir();
  const scopes: BrandScopes = new Map();

  // Guarded, because the fail-open promise below is only worth as much as this
  // line: an unreadable catalog directory here would reject, and every caller
  // would 500 rather than degrade — which is failing CLOSED, loudly, and taking
  // the whole marketplace with it. Per-file reads are guarded further down for
  // the same reason.
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return scopes;
  }

  await Promise.all(
    entries
      .filter((e) => e.isDirectory())
      .map(async (e) => {
        try {
          const raw = await readFile(join(dir, e.name, 'sparx.json'), 'utf8');
          const parsed: unknown = JSON.parse(raw);
          const brands = (parsed as { brands?: unknown }).brands;
          if (Array.isArray(brands) && brands.length > 0) {
            scopes.set(
              e.name,
              brands.filter((b): b is string => typeof b === 'string')
            );
          }
        } catch {
          // A directory with no manifest, or an unreadable one, is not this
          // function's problem to report — the bundle loader validates the
          // catalog properly at boot and names the offender. Skipping here just
          // means "no restriction declared", which is the default anyway.
        }
      })
  );

  return scopes;
}

/**
 * Slugs this brand must NOT see. Memoized — the catalog ships in the image and
 * cannot change without a deploy.
 *
 * FAILS OPEN, and that is a judgement call worth stating: if the manifests
 * cannot be read, every listing stays visible rather than none. Getting it wrong
 * the other way empties the whole marketplace for every tenant on both brands —
 * a total outage — where failing open is one brand's showcase appearing where it
 * should not. The louder failure is the worse one here.
 */
export async function blueprintSlugsHiddenFrom(brand: string): Promise<string[]> {
  cached ??= await readBrandScopes();
  const hidden: string[] = [];
  for (const [slug, brands] of cached) {
    if (!brands.includes(brand)) hidden.push(slug);
  }
  return hidden;
}

/** Whether one blueprint is visible to a brand — the install-time check, so a
 *  slug that is merely hidden from the browse list cannot be installed by
 *  guessing its key. */
export async function blueprintVisibleTo(slug: string, brand: string): Promise<boolean> {
  cached ??= await readBrandScopes();
  const brands = cached.get(slug);
  return !brands || brands.includes(brand);
}

/** Test seam — the catalog is immutable in a running process, so nothing else
 *  should need this. */
export function resetBrandScopeCache(): void {
  cached = null;
}
