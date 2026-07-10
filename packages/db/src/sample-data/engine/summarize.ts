// Summarize — count the sample rows currently loaded for a tenant, by the same
// markers Clear uses. Drives the dashboard status + the Clear confirmation copy
// ("removes 24 products, 10 orders, …"). Runs inside a tenant-scoped tx.

import type { Prisma } from '@prisma/client';

import {
  SAMPLE_HANDLE_PREFIX,
  SAMPLE_MEDIA_FILENAME_PREFIX,
  SAMPLE_MOVEMENT_SOURCE,
  SAMPLE_SLUG_PREFIX,
} from '../markers';
import type { SampleDataCounts } from '../types';

const sampleMeta = { path: ['sample'], equals: true };
const samplePrefix = { startsWith: SAMPLE_HANDLE_PREFIX };

export async function summarizeSampleDataOnTx(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<SampleDataCounts> {
  // Returns carry no own marker — count them via their sample orders (ReturnRequest
  // exposes only an `orderId` scalar, no `order` relation filter).
  const sampleOrders = await tx.order.findMany({
    where: { tenantId, metadata: sampleMeta },
    select: { id: true },
  });
  const orderIds = sampleOrders.map((o) => o.id);

  const [
    products,
    collections,
    categories,
    articles,
    customers,
    returns,
    reviews,
    questions,
    bookings,
    deals,
    bundles,
    movements,
    images,
  ] = await Promise.all([
    tx.product.count({ where: { tenantId, handle: samplePrefix } }),
    tx.productCollection.count({ where: { tenantId, handle: samplePrefix } }),
    tx.productCategory.count({ where: { tenantId, handle: samplePrefix } }),
    tx.contentEntry.count({ where: { tenantId, slug: { startsWith: SAMPLE_SLUG_PREFIX } } }),
    tx.customer.count({ where: { tenantId, metadata: sampleMeta } }),
    orderIds.length
      ? tx.returnRequest.count({ where: { tenantId, orderId: { in: orderIds } } })
      : Promise.resolve(0),
    tx.productReview.count({ where: { tenantId, product: { handle: samplePrefix } } }),
    tx.productQuestion.count({ where: { tenantId, product: { handle: samplePrefix } } }),
    tx.booking.count({ where: { tenantId, service: { settings: sampleMeta } } }),
    tx.deal.count({ where: { tenantId, metadata: sampleMeta } }),
    tx.bundle.count({ where: { tenantId, bundleProduct: { handle: samplePrefix } } }),
    tx.inventoryMovement.count({ where: { tenantId, source: SAMPLE_MOVEMENT_SOURCE } }),
    tx.mediaAsset.count({
      where: { tenantId, originalFilename: { startsWith: SAMPLE_MEDIA_FILENAME_PREFIX } },
    }),
  ]);
  // billingDocuments covers quotes too now (quotes are billing documents on the
  // system b2b-quotes workflow) — no separate quotes count.
  const [aiPrompts, toolCalls, billingDocuments] = await Promise.all([
    tx.aiPromptTemplate.count({ where: { tenantId, metadata: sampleMeta } }),
    tx.auditLog.count({ where: { tenantId, entityType: 'McpToolCall', diff: sampleMeta } }),
    tx.billingDocument.count({ where: { tenantId, metadata: sampleMeta } }),
  ]);
  const orders = orderIds.length;

  return {
    products,
    collections,
    categories,
    articles,
    customers,
    orders,
    returns,
    reviews,
    questions,
    bookings,
    deals,
    billingDocuments,
    bundles,
    movements,
    images,
    aiPrompts,
    toolCalls,
  };
}

/** Total sample rows across every entity — `loaded` is `> 0`. */
export function countsTotal(c: SampleDataCounts): number {
  return (
    c.products +
    c.collections +
    c.categories +
    c.articles +
    c.customers +
    c.orders +
    c.returns +
    c.reviews +
    c.questions +
    c.bookings +
    c.deals +
    c.billingDocuments +
    c.bundles +
    c.movements +
    c.images +
    c.aiPrompts +
    c.toolCalls
  );
}
