// Universal-search projectors for what an owner names in Stock (persona issue 261).
//
// Shelves, counting schedules, recipes, spending limits, reports sent to an
// inbox, stock sources and dropship suppliers each have a screen and a name the
// owner typed, and none of them could be found by it. The purchasing paperwork
// beside them (orders to suppliers, deliveries, stock checks) already could; see
// `universal-projection.ts`.
//
// Each projector reads Prisma through `withTenant`, like every other one. The
// write-time signals come from the inventory services (`indexInventoryEntity`),
// the stock-source and dropship-supplier routes, and the workers that sync them.

import { withTenant } from '@wizeworks/db';
import { inventoryService } from '@wizeworks/inventory';
import {
  type EntityProjector,
  type ProjectorContext,
  type UniversalSearchDocument,
  universalId,
} from '@wizeworks/search';

import { codeAsWords } from './search-words';
import { epoch, keywords, snippet } from './universal-projection-kit';

// ─── inventory: a shelf ──────────────────────────────────────────────────────
//
// The code is what is printed on the label and what a picker reads out, so it is
// the title when the shelf has no name of its own, and a keyword either way.

const binProjector: EntityProjector = {
  entityType: 'bin',
  module: 'inventory',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.inventoryBin.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const b = await tx.inventoryBin.findFirst({
        where: { id, deletedAt: null },
        include: { warehouse: { select: { name: true } } },
      });
      if (!b) return null;
      const named = b.name?.trim() ? b.name.trim() : undefined;
      return {
        id: universalId(ctx.tenantId, 'bin', b.id),
        tenant_id: ctx.tenantId,
        entity_type: 'bin',
        module: 'inventory',
        record_id: b.id,
        title: named ?? b.code,
        // Where it is. With a name as the title, the code goes first so the
        // label on the shelf can be matched by eye.
        subtitle: named ? `${b.code} at ${b.warehouse.name}` : `At ${b.warehouse.name}`,
        body: snippet(b.notes),
        keywords: keywords([b.code, b.name, b.zone, b.aisle, b.rack, b.shelf, b.warehouse.name]),
        status: b.isActive ? 'active' : 'inactive',
        url: `/inventory/shelves/${b.id}`,
        created_at: epoch(b.createdAt),
        updated_at: epoch(b.updatedAt),
      };
    }),
};

// ─── inventory: a counting schedule ──────────────────────────────────────────

const CADENCE_WORDS: Record<string, string> = {
  weekly: 'Every week',
  monthly: 'Every month',
  quarterly: 'Every quarter',
  annually: 'Once a year',
};

function cadenceWords(cadence: string, intervalDays: number): string {
  return CADENCE_WORDS[cadence] ?? `Every ${String(intervalDays)} days`;
}

const countScheduleProjector: EntityProjector = {
  entityType: 'count_schedule',
  module: 'inventory',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.cycleCountSchedule.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const s = await tx.cycleCountSchedule.findFirst({
        where: { id },
        include: { warehouse: { select: { name: true } } },
      });
      if (!s) return null;
      return {
        id: universalId(ctx.tenantId, 'count_schedule', s.id),
        tenant_id: ctx.tenantId,
        entity_type: 'count_schedule',
        module: 'inventory',
        record_id: s.id,
        title: s.name,
        subtitle: `${cadenceWords(s.cadence, s.intervalDays)} at ${s.warehouse.name}`,
        keywords: keywords([s.warehouse.name, s.zoneName, s.assignedTo]),
        status: s.isActive ? 'active' : 'paused',
        url: `/inventory/count-schedules/${s.id}`,
        created_at: epoch(s.createdAt),
        updated_at: epoch(s.updatedAt),
      };
    }),
};

// ─── inventory: a recipe (bill of materials) ─────────────────────────────────

const bomProjector: EntityProjector = {
  entityType: 'bom',
  module: 'inventory',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.billOfMaterials.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const b = await tx.billOfMaterials.findFirst({
        where: { id },
        include: {
          outputVariant: {
            select: { sku: true, title: true, product: { select: { title: true } } },
          },
        },
      });
      if (!b) return null;
      const item = b.outputVariant.title
        ? `${b.outputVariant.product.title}, ${b.outputVariant.title}`
        : b.outputVariant.product.title;
      return {
        id: universalId(ctx.tenantId, 'bom', b.id),
        tenant_id: ctx.tenantId,
        entity_type: 'bom',
        module: 'inventory',
        record_id: b.id,
        title: b.name,
        // What it makes. Two recipes for one item differ by version.
        subtitle: `Makes ${item}, version ${String(b.version)}`,
        body: snippet(b.notes),
        keywords: keywords([b.outputVariant.sku, b.outputVariant.product.title, item]),
        status: b.status,
        url: `/inventory/boms/${b.id}`,
        created_at: epoch(b.createdAt),
        updated_at: epoch(b.updatedAt),
      };
    }),
};

// ─── inventory: a spending limit ─────────────────────────────────────────────

const approvalRuleProjector: EntityProjector = {
  entityType: 'po_approval_rule',
  module: 'inventory',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.purchaseOrderApprovalRule.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const r = await tx.purchaseOrderApprovalRule.findFirst({
        where: { id },
        include: {
          supplier: { select: { name: true } },
          warehouse: { select: { name: true } },
        },
      });
      if (!r) return null;
      // Which orders it stops: the thing two limits differ by.
      const covers = r.supplier
        ? `Orders to ${r.supplier.name}`
        : r.warehouse
          ? `Orders for ${r.warehouse.name}`
          : 'Every order to a supplier';
      return {
        id: universalId(ctx.tenantId, 'po_approval_rule', r.id),
        tenant_id: ctx.tenantId,
        entity_type: 'po_approval_rule',
        module: 'inventory',
        record_id: r.id,
        title: r.name,
        subtitle: covers,
        keywords: keywords([r.supplier?.name, r.warehouse?.name]),
        status: r.isActive ? 'active' : 'inactive',
        url: `/inventory/purchase-orders/approval-rules/${r.id}`,
        created_at: epoch(r.createdAt),
        updated_at: epoch(r.updatedAt),
      };
    }),
};

// ─── inventory: a report sent to an inbox ────────────────────────────────────

const SEND_WORDS: Record<string, string> = {
  daily: 'every day',
  weekly: 'every week',
  monthly: 'every month',
};

const reportScheduleProjector: EntityProjector = {
  entityType: 'report_schedule',
  module: 'inventory',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.inventoryReportSchedule.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const s = await tx.inventoryReportSchedule.findFirst({ where: { id } });
      if (!s) return null;
      // The report's own title, never its key.
      const report = inventoryService.reportDefinition(s.reportKey)?.label;
      const when = SEND_WORDS[s.cadence] ?? codeAsWords(s.cadence).toLowerCase();
      return {
        id: universalId(ctx.tenantId, 'report_schedule', s.id),
        tenant_id: ctx.tenantId,
        entity_type: 'report_schedule',
        module: 'inventory',
        record_id: s.id,
        title: s.name,
        subtitle: report ? `${report}, sent ${when}` : `Sent ${when}`,
        keywords: keywords([report, ...s.recipients]),
        status: s.isActive ? 'active' : 'paused',
        url: `/inventory/reports/schedules/${s.id}`,
        created_at: epoch(s.createdAt),
        updated_at: epoch(s.updatedAt),
      };
    }),
};

// ─── inventory: a stock source ───────────────────────────────────────────────

/** The stock-sources screen's own names for each kind of connection. */
const SOURCE_KINDS: Record<string, string> = {
  csv: 'Spreadsheet file',
  api: 'Connected system',
  agent: 'On-site bridge',
};

const inventorySourceProjector: EntityProjector = {
  entityType: 'inventory_source',
  module: 'inventory',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.inventorySource.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const s = await tx.inventorySource.findFirst({ where: { id, deletedAt: null } });
      if (!s) return null;
      return {
        id: universalId(ctx.tenantId, 'inventory_source', s.id),
        tenant_id: ctx.tenantId,
        entity_type: 'inventory_source',
        module: 'inventory',
        record_id: s.id,
        title: s.name,
        subtitle: SOURCE_KINDS[s.type] ?? codeAsWords(s.type),
        body: snippet(s.notes),
        status: s.status,
        url: `/inventory/sources/${s.id}`,
        created_at: epoch(s.createdAt),
        updated_at: epoch(s.updatedAt),
      };
    }),
};

// ─── dropship: a supplier ────────────────────────────────────────────────────
//
// Not the inventory `supplier` (who an owner buys stock from): this is who ships
// for her. Separate kinds, separate screens, separate headings.

const DROPSHIP_CONNECTIONS: Record<string, string> = {
  csv: 'From a spreadsheet file',
  dsers: 'Connected through DSers',
  spocket: 'Connected through Spocket',
  faire: 'Connected through Faire',
  autods: 'Connected through AutoDS',
  tapstitch: 'Connected through Tapstitch',
  printful: 'Connected through Printful',
  zendrop: 'Connected through Zendrop',
  custom: 'Your own connection',
};

const dropshipSupplierProjector: EntityProjector = {
  entityType: 'dropship_supplier',
  module: 'dropship',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.dropshipSupplier.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const s = await tx.dropshipSupplier.findFirst({ where: { id, deletedAt: null } });
      if (!s) return null;
      return {
        id: universalId(ctx.tenantId, 'dropship_supplier', s.id),
        tenant_id: ctx.tenantId,
        entity_type: 'dropship_supplier',
        module: 'dropship',
        record_id: s.id,
        title: s.name,
        subtitle: DROPSHIP_CONNECTIONS[s.type] ?? `Connected through ${codeAsWords(s.type)}`,
        body: snippet(s.notes),
        keywords: keywords([s.type]),
        status: s.status,
        url: `/dropshipping/suppliers/${s.id}`,
        created_at: epoch(s.createdAt),
        updated_at: epoch(s.updatedAt),
      };
    }),
};

export const stockOwnerNamedProjectors: EntityProjector[] = [
  binProjector,
  countScheduleProjector,
  bomProjector,
  approvalRuleProjector,
  reportScheduleProjector,
  inventorySourceProjector,
  dropshipSupplierProjector,
];
