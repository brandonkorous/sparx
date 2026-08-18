// Inventory sample data, part two (docs/146 Phase 11.6).
//
// `inventory.ts` fills the surfaces the module shipped with: levels, the ledger,
// suppliers, purchase orders, receiving, a transfer. This fills the ones phases
// 2–6 added, which a loaded sample tenant would otherwise open to an empty
// state — and an empty screen is indistinguishable from a broken one to somebody
// deciding whether to buy the thing.
//
//   shelves    a small rack layout on the primary location, with the stock that
//              is already there distributed across it
//   barcodes   the SKU as a Code 128 label, which is what a business that has
//              never had barcodes actually starts with
//   a recipe   one bill of materials, so the assembly surfaces have something
//              real to compute against
//
// ── The rule this file follows, and the reason for it ────────────────────
//
//   SAMPLE DATA AUTHORS FACTS, NEVER MEASUREMENTS.
//
// A shelf, a barcode and a recipe are things a business DECIDED — inventing them
// is honest, because a demo tenant genuinely has them. A supplier scorecard, an
// ABC class, a demand forecast and a reorder point are things sparx CALCULATED
// from evidence, and fabricating one puts a number on screen that nothing
// measured. That is the same failure as a report showing 0% for a ratio nobody
// computed, and it is worse here because it would be showing a prospective
// customer exactly the behaviour the platform promises not to have.
//
// So the planning and supplier-performance surfaces stay empty in a sample
// tenant until the nightly sweep runs over the sample POs and movements this
// data creates — which is precisely what a real tenant sees in week one, and is
// the honest demo.
//
// ── What Clear removes ───────────────────────────────────────────────────
//
// Barcodes, bin levels and the recipe all hang off a sample VARIANT and go when
// it does. The BINS THEMSELVES are durable, exactly like the warehouses in
// `inventory.ts`: a shelf layout is somewhere a tenant put things, and a Clear
// that removed the shelves but left the location would be a strange half-measure.

import type { SampleDataPack } from '../types';
import type { ApplyCtx } from './context';

/** A small, believable rack: three pick faces, a bulk shelf and a receiving bay.
 *  Enough for put-away to have somewhere to suggest and for a pick walk to have
 *  an order, without pretending a corner shop is a distribution centre. */
const BINS = [
  {
    code: 'A-01',
    name: 'Aisle A, bay 1',
    zone: 'Pick face',
    aisle: 'A',
    rack: '01',
    type: 'pick',
    pickSequence: 10,
  },
  {
    code: 'A-02',
    name: 'Aisle A, bay 2',
    zone: 'Pick face',
    aisle: 'A',
    rack: '02',
    type: 'pick',
    pickSequence: 20,
  },
  {
    code: 'B-01',
    name: 'Aisle B, bay 1',
    zone: 'Pick face',
    aisle: 'B',
    rack: '01',
    type: 'pick',
    pickSequence: 30,
  },
  {
    code: 'BULK-1',
    name: 'Overstock',
    zone: 'Bulk',
    aisle: 'BULK',
    rack: '1',
    type: 'bulk',
    pickSequence: 90,
    // Not sellable: overstock is stock you have, in a place a picker does not
    // go. Marking it sellable would make the bulk shelf silently satisfy orders
    // and hide the whole reason a pick face exists.
    isSellable: false,
  },
  {
    code: 'RECV',
    name: 'Receiving bay',
    zone: 'Inbound',
    type: 'receiving',
    pickSequence: 1,
    isSellable: false,
  },
] as const;

export async function applyInventoryDepth(ctx: ApplyCtx, pack: SampleDataPack): Promise<void> {
  if (!ctx.isOn('inventory')) return;
  const { tx, tenantId } = ctx;

  const primaryKey = pack.warehouses?.[0]?.key;
  const warehouseId = primaryKey ? ctx.warehouseIdByKey.get(primaryKey) : undefined;
  if (!warehouseId) return;

  // ── Shelves ────────────────────────────────────────────────────────────
  //
  // Turning bins ON for this location is a real configuration change and it
  // survives Clear, like the location itself. That is deliberate: bins are opt-in
  // per location precisely so a shop with one stockroom is never forced into
  // them, and a sample load that quietly turned them off again would leave a
  // tenant's put-away behaving differently from the demo they just saw.
  await tx.warehouse.update({ where: { id: warehouseId }, data: { usesBins: true } });

  const binIdByCode = new Map<string, string>();
  for (const bin of BINS) {
    const row = await tx.inventoryBin.upsert({
      where: { warehouseId_code: { warehouseId, code: bin.code } },
      update: {},
      create: {
        tenantId,
        warehouseId,
        code: bin.code,
        name: bin.name,
        zone: bin.zone,
        ...('aisle' in bin ? { aisle: bin.aisle } : {}),
        ...('rack' in bin ? { rack: bin.rack } : {}),
        type: bin.type,
        pickSequence: bin.pickSequence,
        ...('isSellable' in bin ? { isSellable: bin.isSellable } : {}),
      },
      select: { id: true },
    });
    binIdByCode.set(bin.code, row.id);
  }

  const pickFaces = ['A-01', 'A-02', 'B-01']
    .map((code) => binIdByCode.get(code))
    .filter((id): id is string => id !== undefined);
  const bulkBinId = binIdByCode.get('BULK-1');
  if (pickFaces.length === 0 || !bulkBinId) return;

  // ── Where the stock actually sits ──────────────────────────────────────
  //
  // Every level already loaded is placed on a shelf, so `Σ(bin levels) ==
  // location on-hand` holds for this location. A mismatch there is the exact
  // discrepancy the bins surfaces exist to surface, and shipping it in the demo
  // data would make the reconciliation screen accuse the sample of being broken.
  const levels = await tx.inventoryLevel.findMany({
    where: { tenantId, warehouseId, onHand: { gt: 0 } },
    select: { variantId: true, onHand: true },
    orderBy: { variantId: 'asc' },
  });

  for (const [index, level] of levels.entries()) {
    const face = pickFaces[index % pickFaces.length]!;
    // A deep line keeps a working quantity on the pick face and the rest
    // upstairs — which is what makes the replenishment and put-away suggestions
    // in the bins surfaces have anything to say.
    const onFace = level.onHand > 24 ? Math.ceil(level.onHand * 0.4) : level.onHand;
    const inBulk = level.onHand - onFace;

    await tx.inventoryBinLevel.upsert({
      where: { variantId_binId: { variantId: level.variantId, binId: face } },
      update: { onHand: onFace },
      create: {
        tenantId,
        variantId: level.variantId,
        binId: face,
        warehouseId,
        onHand: onFace,
      },
    });
    if (inBulk > 0) {
      await tx.inventoryBinLevel.upsert({
        where: { variantId_binId: { variantId: level.variantId, binId: bulkBinId } },
        update: { onHand: inBulk },
        create: {
          tenantId,
          variantId: level.variantId,
          binId: bulkBinId,
          warehouseId,
          onHand: inBulk,
        },
      });
    }
  }

  // ── Barcodes ───────────────────────────────────────────────────────────
  //
  // The SKU, as a Code 128 label. Not a fabricated EAN-13: a made-up EAN is a
  // number that belongs to somebody else's product, and the check digit would
  // have to be computed here as well as in @wizeworks/commerce-schemas — two
  // implementations of one arithmetic, which is how a barcode that scans on
  // screen and fails on paper gets shipped. A business with no barcodes really
  // does start by printing its own codes, so this is also what they would have.
  for (const meta of ctx.variantsByKey.values()) {
    await tx.variantBarcode.upsert({
      where: { tenantId_value: { tenantId, value: meta.sku } },
      update: {},
      create: {
        tenantId,
        variantId: meta.id,
        value: meta.sku,
        symbology: 'code_128',
        packSize: 1,
        isPrimary: true,
      },
    });
  }

  // ── One recipe ─────────────────────────────────────────────────────────
  //
  // A kit made of two things the pack already sells, so the buildable-quantity
  // and assembly surfaces compute against real stock instead of nothing. Only
  // when there are at least three variants — a two-item catalogue making a kit
  // out of itself reads as a bug.
  const variants = [...ctx.variantsByKey.values()];
  if (variants.length >= 3) {
    const output = variants[0]!;
    const components = variants.slice(1, 3);
    const existing = await tx.billOfMaterials.findFirst({
      where: { tenantId, outputVariantId: output.id },
      select: { id: true },
    });
    if (!existing) {
      const bom = await tx.billOfMaterials.create({
        data: {
          tenantId,
          outputVariantId: output.id,
          name: `${output.productTitle} — assembly`,
          status: 'active',
          outputQuantity: 1,
          notes: 'Sample recipe. Change the components, or delete it with the sample data.',
        },
        select: { id: true },
      });
      for (const [position, component] of components.entries()) {
        await tx.bomComponent.create({
          data: {
            tenantId,
            bomId: bom.id,
            variantId: component.id,
            quantityPer: position === 0 ? 1 : 2,
            position,
          },
        });
      }
    }
  }
}
