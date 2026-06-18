// Inventory action executors (docs/100 P3d). The auto-reorder effect: when a
// variant crosses its reorder point, the `inventory.low` event fires the
// `inventory.draft_reorder_po` action, which CALLS `@sparx/inventory`'s
// `autoDraftReorder` on the engine's own transaction (the `ctx.tx` compose-into
// contract, so the draft commits atomically with the run-step write). It
// find-or-appends into a single open draft PO per (supplier, warehouse), so a
// variant that keeps re-firing `inventory.low` grows ONE reviewable draft rather
// than spawning duplicates. The seed ships PAUSED (opt-in) — a tenant turns
// auto-reorder on from its automations once it trusts the suggestions.

import {
  registerAction,
  type ActionOutput,
  type EffectInput,
  type TenantCtx,
} from '@sparx/automation';
import { inventoryService } from '@sparx/inventory';

import { requireEntityId } from './entity.js';

let installed = false;

/** Register the inventory action executors exactly once (idempotent). */
export function installInventoryActions(): void {
  if (installed) return;
  installed = true;

  registerAction({
    type: 'inventory.draft_reorder_po',
    module: 'inventory',
    gates: [],
    manifestNote:
      'Internal PO draft from a low-stock signal — no external/customer effect; the module-active gate (module: inventory) suffices. The draft is reviewed before submit.',
    async execute(ctx: TenantCtx, effect: EffectInput): Promise<ActionOutput> {
      const variantId = requireEntityId(effect.fields, 'variant.id', 'inventory.draft_reorder_po');
      const warehouseId = requireEntityId(
        effect.fields,
        'warehouse.id',
        'inventory.draft_reorder_po'
      );

      // Compose into the engine's transaction so the draft + the run-step record
      // commit as one unit (withTenant honors ctx.tx). The actor is the system
      // automation, so no userId.
      const result = await inventoryService.autoDraftReorder(
        { tenantId: ctx.tenantId, tx: ctx.tx },
        { variantId, warehouseId }
      );

      return {
        outcome: result.outcome,
        purchaseOrderId: result.purchaseOrderId,
        variantId: result.variantId,
        warehouseId: result.warehouseId,
        quantity: result.quantity,
      };
    },
  });
}
