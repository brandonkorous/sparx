// Dropshipping — the dropship module's surfaces.
//
// Lifted out of small-modules.ts once the section grew past a handful: a full
// operator experience now, not one or two panes. Suppliers you connect, the
// products they offer, the orders routed to them, and what you make on it all.
//
// The keys are the contract — persisted in saved layouts and deep links — so
// they must stay stable. `dropship.suppliers.list`, `dropship.products.list` and
// `dropship.analytics` keep the keys their stubs registered, so nobody's saved
// workspace or bookmark breaks in the swap from stub to real screen.
//
// Every surface stays `module: 'dropship'`, so the pane accent is dropship's hue.
// The one deliberate exception is the CROSS-module link on a supplier-order pane,
// which wears commerce's hue via a nested module scope inside the surface itself.

import { BarChart2, Link2, Package, Truck } from 'lucide-react';
import type { SurfaceDefinition } from '../registry';
import { SuppliersListSurface } from '../../../surfaces/dropship/suppliers-list';
import { SupplierDetailSurface } from '../../../surfaces/dropship/supplier-detail';
import { DropshipProductsListSurface } from '../../../surfaces/dropship/products-list';
import { DropshipOrdersListSurface } from '../../../surfaces/dropship/orders-list';
import { DropshipOrderDetailSurface } from '../../../surfaces/dropship/order-detail';
import { DropshipProfitabilitySurface } from '../../../surfaces/dropship/profitability';

export const DROPSHIP_SURFACES: SurfaceDefinition[] = [
  {
    // Unsectioned on purpose: suppliers are where the module starts, so the row
    // leads the panel above the grouped sections.
    key: 'dropship.suppliers.list',
    title: 'Suppliers',
    module: 'dropship',
    icon: Link2,
    order: 1,
    keywords: ['partners', 'sources', 'vendors', 'connect'],
    component: SuppliersListSurface,
    createSurface: 'dropship.supplier.detail',
    createLabel: 'Connect a supplier',
  },
  {
    key: 'dropship.supplier.detail',
    title: 'Supplier',
    module: 'dropship',
    icon: Link2,
    // Opened from the list ({id:'new'} to connect, {id} to manage) — connect is
    // the same surface as manage, so it is a pane, not a launcher entry.
    listed: false,
    component: SupplierDetailSurface,
  },

  /* ── Catalog ───────────────────────────────────────────────────────────── */
  {
    key: 'dropship.products.list',
    title: 'Supplier products',
    module: 'dropship',
    icon: Package,
    section: 'Catalog',
    order: 10,
    keywords: ['import', 'listings', 'sync', 'catalog'],
    // Optionally takes { supplierId } to scope to one supplier's catalog; opened
    // cold it merges every connected supplier's catalog.
    component: DropshipProductsListSurface,
  },

  /* ── Orders ────────────────────────────────────────────────────────────── */
  {
    key: 'dropship.orders.list',
    title: 'Supplier orders',
    module: 'dropship',
    icon: Truck,
    section: 'Orders',
    order: 20,
    keywords: ['fulfilment', 'fulfillment', 'routing', 'tracking', 'shipments'],
    component: DropshipOrdersListSurface,
  },
  {
    key: 'dropship.order.detail',
    title: 'Supplier order',
    module: 'dropship',
    icon: Truck,
    // Reachable from the orders list; opening "a supplier order" cold is not a
    // thing anyone wants, and there is no create counterpart — orders are routed
    // from customer orders, never made by hand.
    listed: false,
    component: DropshipOrderDetailSurface,
  },

  /* ── Reporting ─────────────────────────────────────────────────────────── */
  {
    key: 'dropship.analytics',
    title: 'Profitability',
    module: 'dropship',
    icon: BarChart2,
    section: 'Reporting',
    order: 30,
    keywords: ['margin', 'profit', 'cost', 'sla', 'performance'],
    // Not a singleton: each instance owns its own period, so two side by side is
    // a real comparison.
    component: DropshipProfitabilitySurface,
  },
];
