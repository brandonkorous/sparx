// Seed a new tenant's starter legal pages + footer placements (docs/42 §3).
//
// Runs inside withTenant() so every insert satisfies the FORCE-RLS WITH CHECK
// (tenant_id = current_tenant_id()). Idempotent: a redelivered tenant.created
// (or an existing page at the same slug) is skipped, so re-processing is safe.
// Pages are seeded as DRAFTS — nothing unreviewed goes live; the dashboard
// Legal checklist makes publishing one click.
//
// This is the SINGLE source of truth shared by two callers (docs/104 §4.3):
//   - the legal-seed-worker — prod, on the `tenant.created` Pub/Sub push;
//   - the signup flow (tenant-events) — in-process, in dev where the standalone
//     worker isn't running. Both seed identically because both call this.

import { withTenant, type Prisma } from '@wizeworks/db';
import { LEGAL_TEMPLATES, legalEntryBody } from '@wizeworks/legal-templates';

export interface SeedResult {
  created: number;
  skipped: number;
}

/** Minimal structured logger — satisfied by pino (worker) and the signup flow's
 *  console-based logger alike, so this package needs no pino dependency. */
export interface SeedLogger {
  info(obj: object, msg?: string): void;
}

export async function seedLegalPages(tenantId: string, logger: SeedLogger): Promise<SeedResult> {
  return withTenant({ tenantId }, async (tx) => {
    let created = 0;
    let skipped = 0;

    for (const [i, t] of LEGAL_TEMPLATES.entries()) {
      // The page entry — find-or-create on the (tenant, type, slug) unique.
      const existing = await tx.contentEntry.findFirst({
        where: { typeKey: 'page', slug: t.defaultSlug },
        select: { id: true },
      });

      let entryId: string;
      if (existing) {
        entryId = existing.id;
        skipped++;
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

      // The footer placement — find-or-create (avoids relying on a compound
      // unique selector that includes the nullable entry_id column).
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

    logger.info({ tenantId, created, skipped }, 'legal pages seeded');
    return { created, skipped };
  });
}
