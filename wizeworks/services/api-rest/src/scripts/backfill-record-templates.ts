#!/usr/bin/env tsx
// Backfill: re-stamp UNEDITED record-detail pages to the CURRENT code template.
//
//   pnpm --filter @wizeworks/api-rest ops:backfill-record-templates                    # dry run
//   pnpm --filter @wizeworks/api-rest ops:backfill-record-templates -- --apply
//   pnpm --filter @wizeworks/api-rest ops:backfill-record-templates -- --tenant=harbor-pine
//   pnpm --filter @wizeworks/api-rest ops:backfill-record-templates -- --type=commerce.product
//   pnpm --filter @wizeworks/api-rest ops:backfill-record-templates -- --include-fingerprint=4499a774a668
//
// ── WHY THIS EXISTS ────────────────────────────────────────────────────────────
// A record-detail page (a product page, a blog post) is served from the property's
// STORED `builder_pages.silica_published_tree` when one is materialized, else the code
// `RECORD_TEMPLATES[recordType]()` fallback. `starterSite` stamps that SAME code template,
// so the template is the single source — EXCEPT that a stamp is a point-in-time copy. When
// the code template gains structure (docs/143 added the typed-attribute auto-render sections
// to `productDetailPage`), every site whose page was materialized BEFORE that change keeps a
// STALE stamp that shadows the new floor: the storefront shows the old page, missing the new
// sections, until the page is re-published. A brand-new / never-materialized site is fine —
// it serves the current code fallback. This backfill closes the gap for the already-stamped.
//
// ── WHY IT WILL NOT CLOBBER A HAND-EDITED PAGE ─────────────────────────────────
// `stampTree` mints a fresh random `id` per node and changes nothing else, so two stamps of
// the SAME template version are byte-identical once `id` is stripped. That gives a stable
// structural FINGERPRINT: every unedited stamp of one template version fingerprints alike; a
// hand-edit (an added/removed/retyped node) necessarily diverges. A page is treated as a
// factory stamp — and only then re-stampable — when its fingerprint is
//   · shared by TWO OR MORE distinct tenants (independent tenants cannot hand-edit their way
//     to a byte-identical tree — that only happens when a factory produced both), or
//   · explicitly opted in with `--include-fingerprint=<fp>` after the operator has eyeballed
//     the dry-run preview (use this for a legitimate factory shape that only ONE tenant is on,
//     e.g. a lone e2e tenant).
// A page whose fingerprint already matches the CURRENT template is skipped (already current).
// Anything else — a singleton not opted in — is reported as `review` and never written. So the
// same run is safe to repeat after real merchants exist: their edited pages are singletons and
// are left untouched.
//
// ── WHAT IT WRITES ─────────────────────────────────────────────────────────────
// Per qualifying page, inside one tenant-scoped transaction: the page's non-null
// `silica_draft_tree` / `silica_published_tree` columns are replaced with ONE fresh stamp of
// the current template (same tree in both, so the editor shows no phantom "unpublished
// changes"). Nothing else on the row moves — id, slug, recordType, recordSubtype, isDefault,
// SEO and `published_at` are the page's identity and are preserved. It writes the column
// directly rather than routing through `siteService.publish`, which is a WHOLE-SITE publish
// and would prematurely push a real edited tenant's OTHER pending drafts live.
//
// The storefront serves `silica_published_tree` through an ISR cache (revalidate window, not
// force-dynamic), so a re-stamped page rolls out on the next revalidation rather than
// instantly. Force it with a publish/revalidation if you need it live immediately.
//
// ── RLS ────────────────────────────────────────────────────────────────────────
// `builder_pages` is ENABLE + FORCE RLS and the prod role is a non-superuser, so every read
// and write runs under `withTenant` (set_config('app.tenant_id', …)); a raw `prisma` read
// would report zero rows and exit looking successful (wizeworks/packages/db/CLAUDE.md).

import { prisma, withTenant, Prisma } from '@wizeworks/db';
import {
  RECORD_TEMPLATES,
  ROUTED_RECORD_TYPES,
  type RoutedRecordType,
} from '@wizeworks/silica-catalog';
import { stampTree } from '@wizeworks/silicaui-html';
import { createHash } from 'node:crypto';

const APPLY = process.argv.includes('--apply');
const argValue = (flag: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`${flag}=`))?.slice(flag.length + 1);
const argValues = (flag: string): string[] =>
  process.argv.filter((a) => a.startsWith(`${flag}=`)).map((a) => a.slice(flag.length + 1));

const ONLY_TENANT = argValue('--tenant');
const ONLY_TYPE = argValue('--type') as RoutedRecordType | undefined;
/** Factory fingerprints a single tenant is on that the operator has confirmed by eye. */
const INCLUDE_FPS = new Set(argValues('--include-fingerprint'));

/** id-stripped structural fingerprint of a silica tree. Drops every `id` key (the only field
 *  `stampTree` varies), canonicalizes with sorted keys, and hashes — short hex for the report. */
function fingerprint(tree: unknown): string {
  return createHash('sha1').update(canonical(tree)).digest('hex').slice(0, 12);
}
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>)
      .filter(([k]) => k !== 'id')
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, val]) => `${JSON.stringify(k)}:${canonical(val)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(v);
}

/** The record types this run considers — those that actually have a code template. */
const TYPES: RoutedRecordType[] = (ONLY_TYPE ? [ONLY_TYPE] : [...ROUTED_RECORD_TYPES]).filter(
  // Keep the runtime guard: a bogus `--type=` slips past the compile-time cast on ONLY_TYPE
  // and would index RECORD_TEMPLATES to `undefined`.
  (t) => Boolean(RECORD_TEMPLATES[t])
);

/** The current template's fingerprint per record type — a page matching it is already current.
 *  Stamped first so the comparison is post-stamp-shape vs post-stamp-shape either way. */
const CURRENT_FP = new Map<RoutedRecordType, string>(
  TYPES.map((t) => [t, fingerprint(stampTree(RECORD_TEMPLATES[t]()))])
);

interface Candidate {
  tenantId: string;
  tenantSlug: string;
  propertyId: string;
  propertySlug: string;
  pageId: string;
  recordType: RoutedRecordType;
  recordSubtype: string | null;
  slug: string | null;
  /** Fingerprints of this page's non-null stored trees, excluding any that already match the
   *  current template. Empty ⇒ the page is already current (not a candidate at all). */
  staleFps: string[];
  hasDraft: boolean;
  hasPublished: boolean;
}

async function scan(): Promise<{ candidates: Candidate[]; alreadyCurrent: number }> {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, slug: true },
    ...(ONLY_TENANT ? { where: { slug: ONLY_TENANT } } : {}),
  });

  const candidates: Candidate[] = [];
  let alreadyCurrent = 0;

  for (const tenant of tenants) {
    const rows = await withTenant({ tenantId: tenant.id }, (tx) =>
      tx.builderPage.findMany({
        where: {
          recordType: { in: TYPES },
          OR: [
            { silicaPublishedTree: { not: Prisma.DbNull } },
            { silicaDraftTree: { not: Prisma.DbNull } },
          ],
        },
        select: {
          id: true,
          propertyId: true,
          recordType: true,
          recordSubtype: true,
          slug: true,
          silicaPublishedTree: true,
          silicaDraftTree: true,
          property: { select: { slug: true } },
        },
      })
    );

    for (const r of rows) {
      const rt = r.recordType as RoutedRecordType;
      const current = CURRENT_FP.get(rt);
      const trees: unknown[] = [r.silicaPublishedTree, r.silicaDraftTree].filter((t) => t != null);
      const fps = trees.map(fingerprint);
      const staleFps = fps.filter((fp) => fp !== current);
      if (staleFps.length === 0) {
        alreadyCurrent += 1;
        continue;
      }
      candidates.push({
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        propertyId: r.propertyId,
        propertySlug: r.property?.slug ?? '(unknown)',
        pageId: r.id,
        recordType: rt,
        recordSubtype: r.recordSubtype,
        slug: r.slug,
        staleFps: [...new Set(staleFps)],
        hasDraft: r.silicaDraftTree != null,
        hasPublished: r.silicaPublishedTree != null,
      });
    }
  }

  return { candidates, alreadyCurrent };
}

/** Fingerprints proven to be factory output: shared across ≥2 distinct tenants, plus any the
 *  operator opted in by hand. */
function factoryFingerprints(candidates: Candidate[]): Set<string> {
  const tenantsByFp = new Map<string, Set<string>>();
  for (const c of candidates) {
    for (const fp of c.staleFps) {
      (tenantsByFp.get(fp) ?? tenantsByFp.set(fp, new Set()).get(fp)!).add(c.tenantId);
    }
  }
  const factory = new Set<string>(INCLUDE_FPS);
  for (const [fp, tenants] of tenantsByFp) if (tenants.size >= 2) factory.add(fp);
  return factory;
}

async function restamp(c: Candidate): Promise<void> {
  // ONE fresh stamp per page — fresh ids keep node ids globally unique (the makeId rule), and
  // the SAME tree in both stages so no phantom "unpublished changes" appears in the editor.
  const tree = stampTree(RECORD_TEMPLATES[c.recordType]()) as unknown as Prisma.InputJsonValue;
  await withTenant({ tenantId: c.tenantId }, (tx) =>
    tx.builderPage.update({
      where: { id: c.pageId },
      data: {
        ...(c.hasDraft ? { silicaDraftTree: tree } : {}),
        ...(c.hasPublished ? { silicaPublishedTree: tree } : {}),
      },
    })
  );
}

async function main(): Promise<void> {
  console.log(
    APPLY ? 'APPLYING — re-stamping unedited record pages.\n' : 'DRY RUN — nothing written.\n'
  );
  if (ONLY_TENANT) console.log(`filtered to tenant: ${ONLY_TENANT}`);
  if (ONLY_TYPE) console.log(`filtered to record type: ${ONLY_TYPE}`);
  console.log(`record types in scope: ${TYPES.join(', ')}\n`);

  const { candidates, alreadyCurrent } = await scan();
  const factory = factoryFingerprints(candidates);

  const restampable = candidates.filter((c) => c.staleFps.every((fp) => factory.has(fp)));
  const review = candidates.filter((c) => !c.staleFps.every((fp) => factory.has(fp)));

  // Report, grouped by fingerprint so the clustering is visible at a glance.
  const byFp = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const key = c.staleFps.join('+');
    (byFp.get(key) ?? byFp.set(key, []).get(key)!).push(c);
  }
  for (const [key, group] of [...byFp.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const tenants = new Set(group.map((c) => c.tenantId)).size;
    const verdict = group.every((c) => c.staleFps.every((fp) => factory.has(fp)))
      ? 'FACTORY → re-stamp'
      : 'review (singleton — not written; --include-fingerprint to opt in)';
    console.log(
      `fingerprint ${key}  ·  ${group.length} page(s), ${tenants} tenant(s)  ·  ${verdict}`
    );
    for (const c of group) {
      const where = c.recordSubtype
        ? `${c.slug ?? c.recordType}::${c.recordSubtype}`
        : (c.slug ?? c.recordType);
      console.log(`    ${c.tenantSlug} / ${c.propertySlug}   ${where}`);
    }
    console.log('');
  }

  console.log(
    `${alreadyCurrent} already current · ${restampable.length} re-stampable · ${review.length} need review\n`
  );

  if (!APPLY) {
    if (restampable.length > 0)
      console.log('Re-run with --apply to re-stamp the FACTORY pages above.');
    return;
  }

  let done = 0;
  for (const c of restampable) {
    await restamp(c);
    done += 1;
    console.log(
      `re-stamped  ${c.tenantSlug} / ${c.propertySlug}  ${c.slug ?? c.recordType}  (${done}/${restampable.length})`
    );
  }
  console.log(
    `\nDone. ${done} page(s) re-stamped to the current template. ${review.length} left for review.` +
      (review.length
        ? ' Eyeball them and re-run with --include-fingerprint=<fp> to include a confirmed factory shape.'
        : '')
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
