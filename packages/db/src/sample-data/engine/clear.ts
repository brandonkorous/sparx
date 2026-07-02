// Clear — remove exactly what a load created, in FK-safe order. Runs inside a
// tenant-scoped tx (RLS confines it). The two RESTRICT edges drive the ordering:
// CartItem→variant (drop cart items first) and BundleComponent→variant (drop
// bundles first); Order→customer (drop orders before customers). Everything else
// is reached by cascade once its parent goes.

import type { Prisma } from '@prisma/client';

import {
  SAMPLE_HANDLE_PREFIX,
  SAMPLE_MEDIA_FILENAME_PREFIX,
  SAMPLE_MOVEMENT_SOURCE,
  SAMPLE_PO_PREFIX,
  SAMPLE_SLUG_PREFIX,
  SAMPLE_SUPPLIER_PREFIX,
} from '../markers';

const sampleMeta = { path: ['sample'], equals: true };
const samplePrefix = { startsWith: SAMPLE_HANDLE_PREFIX };

export async function clearSampleDataOnTx(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<void> {
  // Resolve sample product + variant ids (needed to free RESTRICT edges).
  const products = await tx.product.findMany({
    where: { tenantId, handle: samplePrefix },
    select: { id: true },
  });
  const productIds = products.map((p) => p.id);
  const variants = productIds.length
    ? await tx.productVariant.findMany({
        where: { tenantId, productId: { in: productIds } },
        select: { id: true },
      })
    : [];
  const variantIds = variants.map((v) => v.id);

  // Cart items referencing a sample variant (RESTRICT) — clear before products.
  if (variantIds.length) {
    await tx.cartItem.deleteMany({ where: { tenantId, variantId: { in: variantIds } } });
  }

  // Orders (cascade items/payments/fulfillments/returns), quotes, deals.
  await tx.order.deleteMany({ where: { tenantId, metadata: sampleMeta } });
  await tx.quote.deleteMany({ where: { tenantId, metadata: sampleMeta } });
  await tx.deal.deleteMany({ where: { tenantId, metadata: sampleMeta } });

  // Billing documents (cascade lines/payments/snapshots). The workflow/stages/
  // line-types are durable config (seeded on activation) — left intact, like
  // pipelines and warehouses.
  await tx.billingDocument.deleteMany({ where: { tenantId, metadata: sampleMeta } });

  // The demo B2B account behind the net-terms AR documents above (tagged `sample`);
  // its documents are already gone, so this removes only the account row.
  await tx.b2BAccount.deleteMany({ where: { tenantId, tags: { has: 'sample' } } });

  // Scheduling — bookings (via sample services) then the services/resources.
  const sampleServices = await tx.schedulingService.findMany({
    where: { tenantId, settings: sampleMeta },
    select: { id: true },
  });
  if (sampleServices.length) {
    await tx.booking.deleteMany({
      where: { tenantId, serviceId: { in: sampleServices.map((s) => s.id) } },
    });
  }
  await tx.schedulingService.deleteMany({ where: { tenantId, settings: sampleMeta } });
  await tx.schedulingResource.deleteMany({ where: { tenantId, settings: sampleMeta } });

  // Content (cascade revisions/references/property links).
  await tx.contentEntry.deleteMany({
    where: { tenantId, slug: { startsWith: SAMPLE_SLUG_PREFIX } },
  });

  // Bundles (BundleComponent→variant RESTRICT) — before products. Cascades components.
  if (productIds.length) {
    await tx.bundle.deleteMany({ where: { tenantId, bundleProductId: { in: productIds } } });
  }

  // Inventory supply chain — transfers + suppliers (cascade POs/receipts/links) before products.
  await tx.inventoryTransfer.deleteMany({ where: { tenantId, number: { startsWith: 'TRF-9' } } });
  await tx.purchaseOrder.deleteMany({
    where: { tenantId, number: { startsWith: SAMPLE_PO_PREFIX } },
  });
  await tx.supplier.deleteMany({
    where: { tenantId, code: { startsWith: SAMPLE_SUPPLIER_PREFIX } },
  });

  // Belt-and-suspenders: any stray sample movements not reached by variant cascade.
  if (variantIds.length === 0) {
    await tx.inventoryMovement.deleteMany({ where: { tenantId, source: SAMPLE_MOVEMENT_SOURCE } });
  }

  // Products (cascade variants → levels/movements/lots/supplier-links/PO-lines/
  // transfer-lines/configurator/reviews/questions), then catalog org.
  await tx.product.deleteMany({ where: { tenantId, handle: samplePrefix } });
  await tx.productCollection.deleteMany({ where: { tenantId, handle: samplePrefix } });
  await tx.productCategory.deleteMany({ where: { tenantId, handle: samplePrefix } });

  // Customers last (Order→customer RESTRICT is now satisfied). Cascades addresses
  // + segment memberships; reviews/quotes/deals already gone (or SetNull).
  await tx.customer.deleteMany({ where: { tenantId, metadata: sampleMeta } });

  // Sample imagery — VariantImage rows cascaded with their products and an article's
  // featuredImage is just an id string (no FK), so the MediaAssets are now orphaned.
  // Identified by the `sample-` filename prefix (MediaAsset has no metadata column).
  await tx.mediaAsset.deleteMany({
    where: { tenantId, originalFilename: { startsWith: SAMPLE_MEDIA_FILENAME_PREFIX } },
  });

  // AI demo rows (docs/07 §9) — the sample prompt library + the MCP usage history
  // behind the /ai dashboard. Both are standalone (no inbound FKs); matched by the
  // metadata/diff `sample:true` marker, so a tenant's REAL prompts + real MCP audit
  // rows survive untouched.
  await tx.aiPromptTemplate.deleteMany({ where: { tenantId, metadata: sampleMeta } });
  await tx.auditLog.deleteMany({
    where: { tenantId, entityType: 'McpToolCall', diff: sampleMeta },
  });
}
