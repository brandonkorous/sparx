#!/usr/bin/env tsx
// Backfill — make every site's `Property.name` the real customer-facing name, and
// retire `businessName` as a name source (tenant↔site clarity, docs/49).
//
// WHY: the customer-facing SITE name is now `Property.name` — storefront chrome/
// title/OG and email wordmark/footer/`{{site.name}}` all read it (they used to read
// the brand `businessName`, falling back to the tenant's legal name). Two gaps to
// close so no merchant sees a name regression:
//   1. A primary site seeded before this work has `name = 'Default'` (a placeholder),
//      while the merchant's real display name may live in `tenant_brands.business_name`
//      or a per-site `brand_override.businessName`. Copy that real name INTO
//      `Property.name` so the site keeps showing it.
//   2. `brand_override.businessName` is deprecated for naming — strip the dead key so
//      nothing reads it again.
//
// RESOLUTION (per property): set `name` to the first non-empty of
//   brand_override.businessName → tenant_brands.business_name → current name
// but ONLY when the current name is empty or the literal seed 'Default' — we never
// clobber a name a merchant already set. Independently, the `businessName` key is
// stripped from every `brand_override` (presentation-only colors/type/logo stay).
//
// IDEMPOTENT: a property with a real name and no `brand_override.businessName` passes
// through untouched, so re-running is a no-op.
//
// RLS: `properties` is FORCE-RLS and prod `sparx_owner` is a NON-superuser, so reads/
// writes need the tenant GUC set (memory: sparx_db_rls_pattern). We loop tenants and
// run each tenant's batch inside a transaction that sets `app.tenant_id`. tenants /
// tenant_brands are non-RLS, so those reads are plain.
//
// DRY-RUN by default; pass `--apply` to write.
//
//   pnpm --filter @wizeworks/db db:backfill:property-name            # dry-run
//   pnpm --filter @wizeworks/db db:backfill:property-name -- --apply # write

import { PrismaClient } from '@prisma/client';

const APPLY = process.argv.includes('--apply');

const prisma = new PrismaClient();

const SEED_NAME = 'Default';

interface PropertyRow {
  id: string;
  name: string;
  brand_override: unknown;
}

/** The per-site brand override is a loose JSON object. Pull just `businessName`
 *  (a string) off it; everything else is presentation we leave alone. */
function overrideBusinessName(value: unknown): string {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const bn = (value as Record<string, unknown>).businessName;
    if (typeof bn === 'string') return bn.trim();
  }
  return '';
}

/** Return the brand_override with its `businessName` key removed, or null if there
 *  was nothing to strip (so we only write when it actually changes). */
function stripBusinessName(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  if (!('businessName' in obj)) return null;
  const { businessName: _drop, ...rest } = obj;
  return rest;
}

function firstNonEmpty(...vals: string[]): string {
  for (const v of vals) if (v) return v;
  return '';
}

async function main(): Promise<void> {
  const tenants = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM tenants ORDER BY created_at
  `;

  let nameUpdates = 0;
  let overrideStrips = 0;

  for (const { id: tenantId } of tenants) {
    // tenant_brands is non-RLS (PK = tenant_id), so this read is plain.
    const brand = await prisma.$queryRawUnsafe<{ business_name: string | null }[]>(
      `SELECT business_name FROM tenant_brands WHERE tenant_id = $1::uuid`,
      tenantId
    );
    const tenantBusinessName = (brand[0]?.business_name ?? '').trim();

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);

      const props = await tx.$queryRawUnsafe<PropertyRow[]>(
        `SELECT id, name, brand_override FROM properties WHERE tenant_id = $1::uuid`,
        tenantId
      );

      for (const p of props) {
        const current = (p.name ?? '').trim();
        const overrideName = overrideBusinessName(p.brand_override);

        // (1) Only fill a placeholder/empty name — never clobber a real one.
        let nextName = current;
        if (current === '' || current === SEED_NAME) {
          const resolved = firstNonEmpty(overrideName, tenantBusinessName, current);
          if (resolved && resolved !== current) nextName = resolved;
        }

        // (2) Strip the deprecated businessName key from the override (always).
        const strippedOverride = stripBusinessName(p.brand_override);

        const nameChanged = nextName !== current;
        const overrideChanged = strippedOverride !== null;
        if (!nameChanged && !overrideChanged) continue;

        const sets: string[] = [];
        const args: unknown[] = [p.id];
        if (nameChanged) {
          args.push(nextName);
          sets.push(`name = $${args.length}`);
          nameUpdates += 1;
        }
        if (overrideChanged) {
          // An empty object stays an object (a real override may exist with only
          // presentation fields); null only if the override was solely the name.
          const remaining = Object.keys(strippedOverride).length > 0 ? strippedOverride : null;
          if (remaining === null) {
            sets.push(`brand_override = NULL`);
          } else {
            args.push(JSON.stringify(remaining));
            sets.push(`brand_override = $${args.length}::jsonb`);
          }
          overrideStrips += 1;
        }

        if (APPLY) {
          await tx.$executeRawUnsafe(
            `UPDATE properties SET ${sets.join(', ')} WHERE id = $1::uuid`,
            ...args
          );
        }
        const verb = APPLY ? 'updated' : 'would update';
        console.log(
          `${verb} property ${p.id}: ` +
            `${nameChanged ? `name "${current}" → "${nextName}"` : 'name unchanged'}` +
            `${overrideChanged ? '; stripped brand_override.businessName' : ''}`
        );
      }
    });
  }

  console.log('───');
  console.log(
    `${APPLY ? 'APPLIED' : 'DRY-RUN'}: ${nameUpdates} name fill(s), ${overrideStrips} override strip(s)`
  );
  if (!APPLY && (nameUpdates > 0 || overrideStrips > 0)) {
    console.log('Re-run with `-- --apply` to write.');
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
