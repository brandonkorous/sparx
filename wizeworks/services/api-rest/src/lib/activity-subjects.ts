// WHICH RECORD AN ACTIVITY ROW IS ABOUT.
//
// The security screen showed a business owner six of these in a row:
//
//     Updated  Price list updated
//              Devi Raman · 4 hours ago
//     Updated  Price list updated
//              Devi Raman · 4 hours ago
//     …
//
// Six identical lines. She cannot tell whether that is one price list six times
// or six different ones. (It was one.)
//
// The card above them states its own job:
//
//     it arrives already turned into sentences with real names attached, which
//     is what a business owner needs to answer "did someone change my prices,
//     and who?"
//
// ── Why the names were missing ──────────────────────────────────────────────
//
// `subjectFromDiff` reads the name out of the DIFF — it tries `name`, `title`,
// `label`, `orderNumber`, `number`, `email`, `slug` on the before/after sides
// and gives up when none is there. So whether a row can be identified is an
// accident of which fields the writer happened to record. A purchase order
// writes `{after:{number:'PO-000002'}}` and reads beautifully; a price list
// writes `{after:{status:'draft'}}` and is anonymous.
//
// Measured across the whole audit table:
//
//     Variant       404 rows, 404 with no name in the diff
//     Customer      126 rows, 126
//     Order          18 rows,  18
//     PriceList      21 rows,  21
//
// The identifier was on the row the entire time. `audit_logs.entity_id` is
// right beside `entity_type`, and nothing looked at it
// ([[feedback_fetched_but_never_rendered]]).
//
// ── How this resolves them ──────────────────────────────────────────────────
//
// One query per entity TYPE on the page, never one per row — the same shape
// `actorNames` already uses for the person who did it. A page of 50 rows
// touching four kinds of record costs four queries.
//
// Every entry below is checked by the compiler: the delegate and the selected
// fields are the generated Prisma client's, so a wrong model or a renamed
// column does not compile. That is the guard on this table, because the map is
// too long to hold in a head.
//
// ── What is deliberately absent ─────────────────────────────────────────────
//
// Some audited records genuinely have no name. A `CheckoutSession`, a `Cart`, a
// `TaxZone`, an `InventoryLevel`, a `SiteVersion`, an `OrderFulfillment`, a
// `VariantImage` — none carries a field a person would recognize it by, and
// inventing one (an id, a row number) would be a placeholder printed as an
// answer, which is the bug next door on the same screen
// ([[feedback_never_present_absence_as_measurement]]). Those stay unnamed and
// the console prints the action alone, which is the truth.

import type { withRequestTenant } from '@wizeworks/api-core/db';

type TxClient = Parameters<Parameters<typeof withRequestTenant>[1]>[0];

interface Namer {
  find: (tx: TxClient, ids: string[]) => Promise<{ id: string }[]>;
  label: (row: never) => string | null;
}

/** Bind a lookup to the way its rows are read aloud, keeping both typed. */
function named<T extends { id: string }>(
  find: (tx: TxClient, ids: string[]) => Promise<T[]>,
  label: (row: T) => string | null
): Namer {
  return { find, label };
}

const trimmed = (value: string | null | undefined): string | null => {
  const text = (value ?? '').trim();
  return text === '' ? null : text;
};

/**
 * `entity_type` as the audit writers spell it → how to read that record aloud.
 *
 * The keys are whatever each writer passed, which is a mix of Prisma model
 * names and table names; that is data already in the column and not something
 * to tidy retroactively, so the map absorbs it.
 */
const SUBJECTS: Record<string, Namer> = {
  Product: named(
    (tx, ids) =>
      tx.product.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } }),
    (row) => trimmed(row.title)
  ),
  Variant: named(
    (tx, ids) =>
      tx.productVariant.findMany({
        where: { id: { in: ids } },
        select: { id: true, sku: true, title: true },
      }),
    // The SKU first: it is what a person types, prints and reads off a label,
    // and a variant's title is often just the option ("Large").
    (row) => trimmed(row.sku) ?? trimmed(row.title)
  ),
  Customer: named(
    (tx, ids) =>
      tx.customer.findMany({
        where: { id: { in: ids } },
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
    (row) => trimmed([row.firstName, row.lastName].filter(Boolean).join(' ')) ?? trimmed(row.email)
  ),
  Order: named(
    (tx, ids) =>
      tx.order.findMany({ where: { id: { in: ids } }, select: { id: true, orderNumber: true } }),
    (row) => trimmed(row.orderNumber)
  ),
  PurchaseOrder: named(
    (tx, ids) =>
      tx.purchaseOrder.findMany({ where: { id: { in: ids } }, select: { id: true, number: true } }),
    (row) => trimmed(row.number)
  ),
  BillingDocument: named(
    (tx, ids) =>
      tx.billingDocument.findMany({
        where: { id: { in: ids } },
        select: { id: true, number: true },
      }),
    (row) => trimmed(row.number)
  ),
  PriceList: named(
    (tx, ids) =>
      tx.priceList.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    (row) => trimmed(row.name)
  ),
  Category: named(
    (tx, ids) =>
      tx.productCategory.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    (row) => trimmed(row.name)
  ),
  Collection: named(
    (tx, ids) =>
      tx.productCollection.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      }),
    (row) => trimmed(row.name)
  ),
  Discount: named(
    (tx, ids) =>
      tx.discount.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, code: true },
      }),
    (row) => trimmed(row.name) ?? trimmed(row.code)
  ),
  Deal: named(
    (tx, ids) =>
      tx.deal.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } }),
    (row) => trimmed(row.title)
  ),
  Task: named(
    (tx, ids) =>
      tx.task.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } }),
    (row) => trimmed(row.title)
  ),
  Pipeline: named(
    (tx, ids) =>
      tx.pipeline.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    (row) => trimmed(row.name)
  ),
  PipelineStage: named(
    (tx, ids) =>
      tx.pipelineStage.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    (row) => trimmed(row.name)
  ),
  Segment: named(
    (tx, ids) =>
      tx.segment.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    (row) => trimmed(row.name)
  ),
  Broadcast: named(
    (tx, ids) =>
      tx.broadcast.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    (row) => trimmed(row.name)
  ),
  BuilderPage: named(
    (tx, ids) =>
      tx.builderPage.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    (row) => trimmed(row.name)
  ),
  BuilderEmail: named(
    (tx, ids) =>
      tx.builderEmail.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    (row) => trimmed(row.name)
  ),
  BuilderLayout: named(
    (tx, ids) =>
      tx.builderLayout.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    (row) => trimmed(row.name)
  ),
  BuilderComponent: named(
    (tx, ids) =>
      tx.builderComponent.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      }),
    (row) => trimmed(row.name)
  ),
  SiteTheme: named(
    (tx, ids) =>
      tx.siteTheme.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    (row) => trimmed(row.name)
  ),
  Property: named(
    (tx, ids) =>
      tx.property.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    (row) => trimmed(row.name)
  ),
  Warehouse: named(
    (tx, ids) =>
      tx.warehouse.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    (row) => trimmed(row.name)
  ),
  ShippingZone: named(
    (tx, ids) =>
      tx.shippingZone.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    (row) => trimmed(row.name)
  ),
  ShippingRate: named(
    (tx, ids) =>
      tx.shippingRate.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    (row) => trimmed(row.name)
  ),
  TaxRate: named(
    (tx, ids) =>
      tx.taxRate.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    (row) => trimmed(row.name)
  ),
  DocumentWorkflow: named(
    (tx, ids) =>
      tx.documentWorkflow.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      }),
    (row) => trimmed(row.name)
  ),
  DocumentStage: named(
    (tx, ids) =>
      tx.documentStage.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    (row) => trimmed(row.name)
  ),
  content_entry: named(
    (tx, ids) =>
      tx.contentEntry.findMany({ where: { id: { in: ids } }, select: { id: true, slug: true } }),
    // A content entry's headline lives inside its `body` JSON, which differs per
    // content type; the slug is the one stable, human-readable handle on the row.
    (row) => trimmed(row.slug)
  ),
  media_asset: named(
    (tx, ids) =>
      tx.mediaAsset.findMany({
        where: { id: { in: ids } },
        select: { id: true, originalFilename: true },
      }),
    // The filename she uploaded, not the storage key she has never seen.
    (row) => trimmed(row.originalFilename)
  ),
  Supplier: named(
    (tx, ids) =>
      tx.supplier.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, code: true },
      }),
    (row) => trimmed(row.name) ?? trimmed(row.code)
  ),
  SupplierBill: named(
    (tx, ids) =>
      tx.supplierBill.findMany({
        where: { id: { in: ids } },
        select: { id: true, number: true },
      }),
    (row) => trimmed(row.number)
  ),
  GoodsReceipt: named(
    (tx, ids) =>
      tx.goodsReceipt.findMany({
        where: { id: { in: ids } },
        select: { id: true, number: true },
      }),
    (row) => trimmed(row.number)
  ),
  PickList: named(
    (tx, ids) =>
      tx.pickList.findMany({
        where: { id: { in: ids } },
        select: { id: true, number: true },
      }),
    (row) => trimmed(row.number)
  ),
  InventoryCount: named(
    (tx, ids) =>
      tx.inventoryCount.findMany({
        where: { id: { in: ids } },
        select: { id: true, number: true },
      }),
    (row) => trimmed(row.number)
  ),
  InventoryTransfer: named(
    (tx, ids) =>
      tx.inventoryTransfer.findMany({
        where: { id: { in: ids } },
        select: { id: true, number: true },
      }),
    (row) => trimmed(row.number)
  ),
  CycleCountSchedule: named(
    (tx, ids) =>
      tx.cycleCountSchedule.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      }),
    (row) => trimmed(row.name)
  ),
  InventoryCustomField: named(
    (tx, ids) =>
      tx.inventoryCustomField.findMany({
        where: { id: { in: ids } },
        select: { id: true, label: true, key: true },
      }),
    (row) => trimmed(row.label) ?? trimmed(row.key)
  ),
  ShippingProfile: named(
    (tx, ids) =>
      tx.shippingProfile.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      }),
    (row) => trimmed(row.name)
  ),
  SurchargeRule: named(
    (tx, ids) =>
      tx.surchargeRule.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, label: true },
      }),
    (row) => trimmed(row.name) ?? trimmed(row.label)
  ),
  MarkupRule: named(
    (tx, ids) =>
      tx.markupRule.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      }),
    (row) => trimmed(row.name)
  ),
  GiftCard: named(
    (tx, ids) =>
      tx.giftCard.findMany({
        where: { id: { in: ids } },
        select: { id: true, code: true },
      }),
    (row) => trimmed(row.code)
  ),
  ProductReview: named(
    (tx, ids) =>
      tx.productReview.findMany({
        where: { id: { in: ids } },
        select: { id: true, title: true },
      }),
    (row) => trimmed(row.title)
  ),
  ProductTranslation: named(
    (tx, ids) =>
      tx.productTranslation.findMany({
        where: { id: { in: ids } },
        select: { id: true, title: true },
      }),
    (row) => trimmed(row.title)
  ),
  FitmentDomain: named(
    (tx, ids) =>
      tx.fitmentDomain.findMany({
        where: { id: { in: ids } },
        select: { id: true, slug: true },
      }),
    (row) => trimmed(row.slug)
  ),
  ConfigurationTemplate: named(
    (tx, ids) =>
      tx.configurationTemplate.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      }),
    (row) => trimmed(row.name)
  ),
  CrmRecord: named(
    (tx, ids) =>
      tx.crmRecord.findMany({
        where: { id: { in: ids } },
        select: { id: true, title: true },
      }),
    (row) => trimmed(row.title)
  ),
  CrmObjectDef: named(
    (tx, ids) =>
      tx.crmObjectDef.findMany({
        where: { id: { in: ids } },
        select: { id: true, label: true, key: true },
      }),
    (row) => trimmed(row.label) ?? trimmed(row.key)
  ),
  CrmDashboard: named(
    (tx, ids) =>
      tx.crmDashboard.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      }),
    (row) => trimmed(row.name)
  ),
  CrmReport: named(
    (tx, ids) =>
      tx.crmReport.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      }),
    (row) => trimmed(row.name)
  ),
  ScoringModel: named(
    (tx, ids) =>
      tx.scoringModel.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      }),
    (row) => trimmed(row.name)
  ),
  Ticket: named(
    (tx, ids) =>
      tx.ticket.findMany({
        where: { id: { in: ids } },
        select: { id: true, subject: true },
      }),
    // A ticket's `number` is an integer, and a person asks for it by what it is about.
    (row) => trimmed(row.subject)
  ),
  TicketSlaPolicy: named(
    (tx, ids) =>
      tx.ticketSlaPolicy.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      }),
    (row) => trimmed(row.name)
  ),
  SalesTemplate: named(
    (tx, ids) =>
      tx.salesTemplate.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      }),
    (row) => trimmed(row.name)
  ),
  EmailSuppression: named(
    (tx, ids) =>
      tx.emailSuppression.findMany({
        where: { id: { in: ids } },
        select: { id: true, email: true },
      }),
    (row) => trimmed(row.email)
  ),
  AiPromptTemplate: named(
    (tx, ids) =>
      tx.aiPromptTemplate.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      }),
    (row) => trimmed(row.name)
  ),
  BillingDocumentTemplate: named(
    (tx, ids) =>
      tx.billingDocumentTemplate.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      }),
    (row) => trimmed(row.name)
  ),
  BillingDocumentLineType: named(
    (tx, ids) =>
      tx.billingDocumentLineType.findMany({
        where: { id: { in: ids } },
        select: { id: true, label: true, name: true },
      }),
    (row) => trimmed(row.label) ?? trimmed(row.name)
  ),
  PageLayout: named(
    (tx, ids) =>
      tx.pageLayout.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      }),
    (row) => trimmed(row.name)
  ),
  TenantSectionDefinition: named(
    (tx, ids) =>
      tx.tenantSectionDefinition.findMany({
        where: { id: { in: ids } },
        select: { id: true, label: true, slug: true },
      }),
    (row) => trimmed(row.label) ?? trimmed(row.slug)
  ),
  ProviderInstallation: named(
    (tx, ids) =>
      tx.providerInstallation.findMany({
        where: { id: { in: ids } },
        select: { id: true, label: true },
      }),
    (row) => trimmed(row.label)
  ),
  Tenant: named(
    (tx, ids) =>
      tx.tenant.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      }),
    // The business itself. Rare, but an owner renaming her own shop should read as that.
    (row) => trimmed(row.name)
  ),
};

/** Entity types that are audited and have no name a person would know them by. */
export const UNNAMEABLE = new Set([
  'VariantImage',
  'CheckoutSession',
  'Cart',
  'TaxZone',
  'Booking',
  'SiteVersion',
  'InventoryLevel',
  'OrderFulfillment',
  'BillingDocumentLine',
  'CommerceSiteSettings',
  'SiteConfig',
  'ReturnRequest',
  'McpToolCall',
]);

/** The key a resolved name is stored under. */
export const subjectKey = (entityType: string | null, entityId: string | null): string =>
  `${entityType ?? ''}:${entityId ?? ''}`;

/**
 * Look up a display name for every row that has one, in one query per kind.
 *
 * Best-effort by design: a lookup that throws (a record deleted under us, a
 * module whose table is absent) leaves that kind unnamed rather than failing
 * the whole feed. An activity page that loads without names beats one that
 * does not load.
 */
export async function subjectNames(
  tx: TxClient,
  rows: readonly { entityType: string | null; entityId: string | null }[]
): Promise<Map<string, string>> {
  const byType = new Map<string, Set<string>>();
  for (const row of rows) {
    const { entityType, entityId } = row;
    if (!entityType || !entityId) continue;
    if (!(entityType in SUBJECTS)) continue;
    const ids = byType.get(entityType) ?? new Set<string>();
    ids.add(entityId);
    byType.set(entityType, ids);
  }

  const out = new Map<string, string>();
  await Promise.all(
    [...byType].map(async ([entityType, ids]) => {
      const namer = SUBJECTS[entityType];
      if (!namer) return;
      try {
        const found = await namer.find(tx, [...ids]);
        for (const record of found) {
          const label = namer.label(record as never);
          if (label !== null) out.set(subjectKey(entityType, record.id), label);
        }
      } catch {
        // Leave this kind unnamed. See the doc comment.
      }
    })
  );
  return out;
}

/** Every entity type this can name — the denominator a guard needs. */
export const NAMEABLE_TYPES = Object.keys(SUBJECTS);
