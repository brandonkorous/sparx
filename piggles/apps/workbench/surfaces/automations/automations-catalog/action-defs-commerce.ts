import type { ActionDef } from './types';

export const COMMERCE_ACTION_DEFS: readonly ActionDef[] = [
  // ── Selling (Commerce — deferred) ──
  {
    type: 'commerce.create_invoice',
    label: 'Create an invoice',
    module: 'commerce',
    description: 'Not available yet.',
    mode: 'json',
    available: false,
  },
  {
    type: 'commerce.apply_discount',
    label: 'Apply a discount',
    module: 'commerce',
    description: 'Not available yet.',
    mode: 'json',
    available: false,
  },
  {
    type: 'commerce.update_inventory',
    label: 'Adjust stock',
    module: 'commerce',
    description: 'Not available yet.',
    mode: 'json',
    available: false,
  },
  {
    type: 'commerce.create_order',
    label: 'Create an order',
    module: 'commerce',
    description: 'Not available yet.',
    mode: 'json',
    available: false,
  },
  {
    type: 'inventory.draft_reorder_po',
    label: 'Draft a restock order',
    module: 'commerce',
    // Built and running: the shipped "Auto-reorder low stock" recipe uses it. It
    // was listed as unavailable, so nobody could pick it for their own rule.
    description:
      'Adds the item that ran low to a draft order for its usual supplier. Use it with "A product runs low on stock". Nothing is sent until you review the order.',
    mode: 'none',
    available: true,
  },
];
