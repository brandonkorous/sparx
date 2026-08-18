// Inventory system-automation seeds (docs/100 P3d). Ships on Inventory activation.
//
// Auto-reorder is powerful but opinionated — it drafts purchase orders on the
// tenant's behalf — so it seeds PAUSED. The tenant reviews how suggestions look
// on /inventory/reorder, then flips this rule on to have low stock auto-draft a
// PO to the preferred supplier (find-or-appended into one open draft per supplier
// + warehouse, so it never spams). The draft still requires a human submit.

import type { SystemAutomationSpec } from '@wizeworks/automation';

/** Draft a reorder PO to the preferred supplier when a variant crosses its
 *  reorder point. Seeded `paused` — opt-in (the tenant enables it). The
 *  `inventory.draft_reorder_po` action is module-gated to inventory. */
export const INVENTORY_AUTO_REORDER: SystemAutomationSpec = {
  name: 'Auto-reorder low stock',
  description:
    'Drafts a purchase order to the preferred supplier when a product variant drops to its reorder point. Review and submit the draft from Purchase orders. Off by default — turn it on to automate replenishment.',
  trigger: { kind: 'event', eventType: 'inventory.low' },
  conditions: { logic: 'AND', conditions: [] },
  actions: [{ type: 'inventory.draft_reorder_po', config: {} }],
  locked: false,
  status: 'paused',
};
