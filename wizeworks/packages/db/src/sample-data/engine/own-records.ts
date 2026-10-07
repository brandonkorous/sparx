// Own records — how many of a kind the business made itself, leaving out the
// practice records a pack loaded and the example products a design brought.
//
// A list's `total` cannot answer "has she added her first product yet?" once a
// pack has loaded, because the pack has added a hundred. The Piggles Home
// checklist read those totals, so on a business three minutes old every step
// was already ticked and the checklist had retired itself before anybody saw it
// (Piggles persona issue 935). Runs inside a tenant-scoped tx, and counts by the
// same markers Clear removes by, so "yours" and "what Clear leaves" agree.

import type { Prisma } from '@prisma/client';

import { SAMPLE_HANDLE_PREFIX, SAMPLE_SLUG_PREFIX } from '../markers';

/** The three first-day jobs the checklist asks about. */
export type OwnRecordKind = 'product' | 'customer' | 'invoice' | 'article';

const sampleMeta = { path: ['sample'], equals: true };

export async function countOwnRecordsOnTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  kind: OwnRecordKind
): Promise<number> {
  if (kind === 'article') {
    // Something she wrote and put out, for a business that publishes (Piggles
    // persona issue 941). Published only: the checklist step is "publish", and
    // a draft is the step in progress. A design's example articles are copies
    // with ordinary slugs, so its own record of them is the only way to tell.
    const examples = await tx.tenantBlueprintInstallArtifact.findMany({
      where: { tenantId, kind: 'content', refId: { not: null } },
      select: { refId: true },
    });
    const exampleIds = examples.flatMap((row) => (row.refId ? [row.refId] : []));
    return tx.contentEntry.count({
      where: {
        tenantId,
        deletedAt: null,
        status: 'published',
        // A slug can be empty, and NOT on an empty one is empty too in SQL, so
        // the plain NOT would drop exactly the entries with no address yet.
        OR: [{ slug: null }, { NOT: { slug: { startsWith: SAMPLE_SLUG_PREFIX } } }],
        ...(exampleIds.length > 0 ? { id: { notIn: exampleIds } } : {}),
      },
    });
  }
  if (kind === 'product') {
    // A design's example products are copies with ordinary handles, so the
    // install's own record of what it created is the only way to tell them from
    // hers. Edited or not, they arrived with the design.
    const examples = await tx.tenantBlueprintInstallArtifact.findMany({
      where: { tenantId, kind: 'product', refId: { not: null } },
      select: { refId: true },
    });
    const exampleIds = examples.flatMap((row) => (row.refId ? [row.refId] : []));
    return tx.product.count({
      where: {
        tenantId,
        deletedAt: null,
        NOT: { handle: { startsWith: SAMPLE_HANDLE_PREFIX } },
        ...(exampleIds.length > 0 ? { id: { notIn: exampleIds } } : {}),
      },
    });
  }
  // A total less its practice rows, rather than one count with NOT on a JSON
  // path: a row whose metadata has no `sample` key reads NULL there, and NOT
  // NULL is NULL, so the single count drops exactly the rows it should keep.
  if (kind === 'customer') {
    const [all, practice] = await Promise.all([
      tx.customer.count({ where: { tenantId, deletedAt: null } }),
      tx.customer.count({ where: { tenantId, deletedAt: null, metadata: sampleMeta } }),
    ]);
    return all - practice;
  }
  const [all, practice] = await Promise.all([
    tx.billingDocument.count({ where: { tenantId, deletedAt: null } }),
    tx.billingDocument.count({ where: { tenantId, deletedAt: null, metadata: sampleMeta } }),
  ]);
  return all - practice;
}
