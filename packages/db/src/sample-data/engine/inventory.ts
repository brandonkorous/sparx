// Inventory slice — warehouses, stock levels + ledger movements, lots, suppliers,
// purchasing links, purchase orders (draft + submitted w/ a partial goods
// receipt), and a draft transfer. Gated on `inventory`.
//
// Warehouses are durable config (find-or-create by code, never cleared — a tenant
// keeps its locations). Everything else is sample: levels/movements/lots cascade
// away when the sample products delete; suppliers carry an `SMP-` code prefix so
// Clear removes them (cascading their POs + receipts). Movements replay
// oldest→newest so `balanceAfter` is the running on-hand and Σ(delta) == on-hand —
// the ledger invariant the Inventory surfaces depend on.

import { SAMPLE_MOVEMENT_SOURCE, SAMPLE_PO_PREFIX, SAMPLE_SUPPLIER_PREFIX } from '../markers';
import type { SampleDataPack } from '../types';
import { type ApplyCtx, daysAgo } from './context';

export async function applyInventory(ctx: ApplyCtx, pack: SampleDataPack): Promise<void> {
  if (!ctx.isOn('inventory')) return;
  const { tx, tenantId } = ctx;

  // Warehouses — durable config, find-or-create by (tenant, code).
  for (const w of pack.warehouses ?? []) {
    const row = await tx.warehouse.upsert({
      where: { tenantId_code: { tenantId, code: w.code } },
      update: {
        name: w.name,
        type: w.type ?? 'owned',
        city: w.city,
        region: w.region,
        country: 'US',
      },
      create: {
        tenantId,
        code: w.code,
        name: w.name,
        type: w.type ?? 'owned',
        city: w.city,
        region: w.region,
        country: 'US',
      },
      select: { id: true },
    });
    ctx.warehouseIdByKey.set(w.key, row.id);
  }
  const primaryWarehouseId = pack.warehouses?.[0]
    ? ctx.warehouseIdByKey.get(pack.warehouses[0].key)
    : undefined;

  // Levels + movement ledger — walk the authored stock on each variant.
  for (const p of pack.products) {
    for (const v of p.variants) {
      const meta = ctx.variantsByKey.get(v.key ?? v.sku);
      if (!meta) continue;
      for (const lvl of v.stock ?? []) {
        const warehouseId = ctx.warehouseIdByKey.get(lvl.warehouseKey);
        if (!warehouseId) continue;
        const onHand = lvl.movements.reduce((s, m) => s + m.delta, 0);
        await tx.inventoryLevel.create({
          data: {
            tenantId,
            variantId: meta.id,
            warehouseId,
            onHand,
            ...(lvl.reorderPoint !== undefined ? { reorderPoint: lvl.reorderPoint } : {}),
            ...(lvl.reorderQuantity !== undefined ? { reorderQuantity: lvl.reorderQuantity } : {}),
            ...(lvl.leadTimeDays !== undefined ? { leadTimeDays: lvl.leadTimeDays } : {}),
            unitCostCents: meta.costCents,
            avgCostCents: meta.costCents,
          },
        });
        let balance = 0;
        const chrono = [...lvl.movements].sort((a, b) => b.daysAgo - a.daysAgo);
        for (const m of chrono) {
          balance += m.delta;
          await tx.inventoryMovement.create({
            data: {
              tenantId,
              variantId: meta.id,
              warehouseId,
              delta: m.delta,
              balanceAfter: balance,
              reason: m.reason,
              actorType: 'system',
              source: SAMPLE_MOVEMENT_SOURCE,
              ...(m.reason === 'receive' ? { unitCostCents: meta.costCents } : {}),
              createdAt: daysAgo(ctx, m.daysAgo),
            },
          });
          ctx.counts.movements += 1;
        }
      }
    }
  }

  // Lot batches.
  for (const lot of pack.lots ?? []) {
    const meta = ctx.variantsByKey.get(lot.variantKey);
    const warehouseId = ctx.warehouseIdByKey.get(lot.warehouseKey);
    if (!meta || !warehouseId) continue;
    await tx.lotBatch.create({
      data: {
        tenantId,
        variantId: meta.id,
        warehouseId,
        lotNumber: lot.lotNumber,
        quantity: lot.quantity,
        hazmatClass: lot.hazmatClass ?? 'none',
        ...(lot.expiresInDays !== undefined ? { expiresAt: daysAgo(ctx, -lot.expiresInDays) } : {}),
        manufacturedAt: daysAgo(ctx, 90),
        ...(lot.recall
          ? { recallStatus: 'active', recallReason: lot.recall, recalledAt: daysAgo(ctx, 4) }
          : {}),
      },
    });
  }

  // Suppliers + purchasing links.
  const suppliers: { id: string; variantIds: string[] }[] = [];
  for (const s of pack.suppliers ?? []) {
    const supplier = await tx.supplier.create({
      data: {
        tenantId,
        code: `${SAMPLE_SUPPLIER_PREFIX}${s.code}`,
        name: s.name,
        paymentTerms: s.paymentTerms ?? 'net30',
        leadTimeDays: s.leadTimeDays ?? 7,
        city: s.city,
        region: s.region,
        country: 'US',
      },
      select: { id: true },
    });
    const variantIds: string[] = [];
    for (const vkey of s.variantKeys) {
      const meta = ctx.variantsByKey.get(vkey);
      if (!meta) continue;
      const buyCost = Math.round(meta.costCents * 0.96);
      await tx.supplierVariant.create({
        data: {
          tenantId,
          supplierId: supplier.id,
          variantId: meta.id,
          unitCostCents: buyCost,
          supplierSku: `${meta.sku}-V`,
          minOrderQty: 5,
          isPreferred: true,
        },
      });
      variantIds.push(meta.id);
    }
    suppliers.push({ id: supplier.id, variantIds });
  }

  // Purchase orders — a draft on the first supplier, a submitted (with a partial
  // goods receipt) on the next. Needs a destination warehouse + sourced variants.
  if (primaryWarehouseId && suppliers.length > 0) {
    const variantMetaById = new Map([...ctx.variantsByKey.values()].map((m) => [m.id, m] as const));
    const poDefs = [
      { supplier: suppliers[0]!, status: 'draft', shipping: 0, submitted: false },
      {
        supplier: suppliers[1] ?? suppliers[0]!,
        status: 'submitted',
        shipping: 2500,
        submitted: true,
      },
    ];
    let poSeq = 0;
    let grSeq = 0;
    for (const def of poDefs) {
      const lineVariantIds = def.supplier.variantIds.slice(0, 2);
      if (lineVariantIds.length === 0) continue;
      poSeq += 1;
      const lines = lineVariantIds.map((variantId) => {
        const meta = variantMetaById.get(variantId)!;
        return { variantId, meta, qty: 20, unitCostCents: Math.round(meta.costCents * 0.96) };
      });
      const subtotal = lines.reduce((s, l) => s + l.qty * l.unitCostCents, 0);
      const po = await tx.purchaseOrder.create({
        data: {
          tenantId,
          number: `${SAMPLE_PO_PREFIX}${String(poSeq).padStart(4, '0')}`,
          supplierId: def.supplier.id,
          warehouseId: primaryWarehouseId,
          status: def.status,
          currency: 'USD',
          reference: 'Replenishment',
          shippingCents: def.shipping,
          subtotalCents: subtotal,
          totalCents: subtotal + def.shipping,
          ...(def.submitted
            ? { orderedAt: daysAgo(ctx, 3), expectedArrivalAt: daysAgo(ctx, -11) }
            : {}),
        },
        select: { id: true },
      });
      const poLines: { id: string; variantId: string; unitCostCents: number; qty: number }[] = [];
      for (const l of lines) {
        const row = await tx.purchaseOrderLine.create({
          data: {
            tenantId,
            purchaseOrderId: po.id,
            variantId: l.variantId,
            quantityOrdered: l.qty,
            unitCostCents: l.unitCostCents,
            supplierSku: `${l.meta.sku}-V`,
            description: l.meta.productTitle,
          },
          select: { id: true },
        });
        poLines.push({
          id: row.id,
          variantId: l.variantId,
          unitCostCents: l.unitCostCents,
          qty: l.qty,
        });
      }

      // Partial goods receipt on the submitted PO → /receiving shows history.
      if (def.submitted && poLines[0] && primaryWarehouseId) {
        grSeq += 1;
        const first = poLines[0];
        const recvQty = Math.floor(first.qty / 2);
        const gr = await tx.goodsReceipt.create({
          data: {
            tenantId,
            number: `GR-9${String(grSeq).padStart(4, '0')}`,
            purchaseOrderId: po.id,
            warehouseId: primaryWarehouseId,
            reference: 'PACKING-7741',
            receivedAt: daysAgo(ctx, 1),
          },
          select: { id: true },
        });
        const level = await tx.inventoryLevel.findUnique({
          where: {
            variantId_warehouseId: { variantId: first.variantId, warehouseId: primaryWarehouseId },
          },
        });
        const prevOnHand = level?.onHand ?? 0;
        const newOnHand = prevOnHand + recvQty;
        const oldAvg = level?.avgCostCents ?? first.unitCostCents;
        const newAvg = Math.round(
          (prevOnHand * oldAvg + recvQty * first.unitCostCents) / newOnHand
        );
        const mv = await tx.inventoryMovement.create({
          data: {
            tenantId,
            variantId: first.variantId,
            warehouseId: primaryWarehouseId,
            delta: recvQty,
            balanceAfter: newOnHand,
            reason: 'receive',
            actorType: 'system',
            source: SAMPLE_MOVEMENT_SOURCE,
            unitCostCents: first.unitCostCents,
            referenceType: 'GoodsReceipt',
            referenceId: gr.id,
            createdAt: daysAgo(ctx, 1),
          },
          select: { id: true },
        });
        ctx.counts.movements += 1;
        await tx.inventoryLevel.upsert({
          where: {
            variantId_warehouseId: { variantId: first.variantId, warehouseId: primaryWarehouseId },
          },
          update: { onHand: newOnHand, avgCostCents: newAvg },
          create: {
            tenantId,
            variantId: first.variantId,
            warehouseId: primaryWarehouseId,
            onHand: newOnHand,
            avgCostCents: newAvg,
            unitCostCents: first.unitCostCents,
          },
        });
        await tx.goodsReceiptLine.create({
          data: {
            tenantId,
            goodsReceiptId: gr.id,
            purchaseOrderLineId: first.id,
            variantId: first.variantId,
            quantityReceived: recvQty,
            unitCostCents: first.unitCostCents,
            movementId: mv.id,
          },
        });
        await tx.purchaseOrderLine.update({
          where: { id: first.id },
          data: { quantityReceived: recvQty },
        });
        await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: 'partial' } });
      }
    }
  }

  // A draft transfer (primary → secondary warehouse) the user can ship + receive.
  const secondaryWarehouseId = pack.warehouses?.[1]
    ? ctx.warehouseIdByKey.get(pack.warehouses[1].key)
    : undefined;
  if (primaryWarehouseId && secondaryWarehouseId && secondaryWarehouseId !== primaryWarehouseId) {
    const shippable = await tx.inventoryLevel.findMany({
      where: { warehouseId: primaryWarehouseId, onHand: { gte: 5 } },
      select: { variantId: true },
      orderBy: { onHand: 'desc' },
      take: 2,
    });
    if (shippable.length > 0) {
      const transfer = await tx.inventoryTransfer.create({
        data: {
          tenantId,
          number: 'TRF-90001',
          fromWarehouseId: primaryWarehouseId,
          toWarehouseId: secondaryWarehouseId,
          status: 'draft',
          note: 'Rebalance fast movers to the secondary location',
        },
        select: { id: true },
      });
      for (const lvl of shippable) {
        await tx.inventoryTransferLine.create({
          data: { tenantId, transferId: transfer.id, variantId: lvl.variantId, quantity: 5 },
        });
      }
    }
  }
}
