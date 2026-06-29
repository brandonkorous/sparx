import type { ModuleManifest } from '@sparx/ui/shell';
import {
  Warehouse,
  Boxes,
  Layers,
  Link2,
  Plus,
  Truck,
  ClipboardList,
  ClipboardCheck,
  PackageCheck,
  RefreshCw,
  ArrowLeftRight,
  History,
  BarChart3,
} from 'lucide-react';

export const inventoryManifest: ModuleManifest = {
  id: 'inventory',
  label: 'Inventory',
  icon: Warehouse,
  routePrefix: '/inventory',
  sections: [
    { id: 'stock', label: 'Stock', icon: Boxes, href: '/inventory/stock' },
    { id: 'warehouses', label: 'Warehouses', icon: Warehouse, href: '/inventory/warehouses' },
    { id: 'suppliers', label: 'Suppliers', icon: Truck, href: '/inventory/suppliers' },
    {
      id: 'purchase-orders',
      label: 'Purchase orders',
      icon: ClipboardList,
      href: '/inventory/purchase-orders',
    },
    { id: 'receiving', label: 'Receiving', icon: PackageCheck, href: '/inventory/receiving' },
    { id: 'reorder', label: 'Reorder', icon: RefreshCw, href: '/inventory/reorder' },
    { id: 'counts', label: 'Counts', icon: ClipboardCheck, href: '/inventory/counts' },
    { id: 'transfers', label: 'Transfers', icon: ArrowLeftRight, href: '/inventory/transfers' },
    { id: 'movements', label: 'Movements', icon: History, href: '/inventory/movements' },
    { id: 'lots', label: 'Lots & serials', icon: Layers, href: '/inventory/lots' },
    { id: 'reports', label: 'Reports', icon: BarChart3, href: '/inventory/reports' },
    { id: 'sources', label: 'Sources', icon: Link2, href: '/inventory/sources' },
  ],
  actions: [
    {
      id: 'inventory.warehouse.create',
      label: 'Add warehouse',
      icon: Plus,
      href: '/inventory/warehouses/new',
    },
    {
      id: 'inventory.supplier.create',
      label: 'Add supplier',
      icon: Plus,
      href: '/inventory/suppliers/new',
    },
    {
      id: 'inventory.purchase_order.create',
      label: 'New purchase order',
      icon: Plus,
      href: '/inventory/purchase-orders/new',
    },
    {
      id: 'inventory.count.create',
      label: 'New count',
      icon: Plus,
      href: '/inventory/counts/new',
    },
    {
      id: 'inventory.transfer.create',
      label: 'New transfer',
      icon: Plus,
      href: '/inventory/transfers/new',
    },
    {
      id: 'inventory.lot.create',
      label: 'New lot',
      icon: Plus,
      href: '/inventory/lots/new',
    },
  ],
  entityTypes: [
    {
      id: 'warehouse',
      label: 'Warehouse',
      routePrefix: '/inventory/warehouses',
      hasDetailView: true,
    },
    // Create-only overlay entities (no `hasDetailView`: their editors are wide,
    // full-page surfaces). The manifest entry gives the create overlay chrome a
    // label + the "open in full page" href; the multi-step SurfaceFrame create
    // opts into the drawer/modal via CREATE_VIEW_TYPES + detail-slot.
    {
      id: 'purchase-order',
      label: 'Purchase order',
      routePrefix: '/inventory/purchase-orders',
    },
    {
      id: 'transfer',
      label: 'Transfer',
      routePrefix: '/inventory/transfers',
    },
    // Connect-a-source create overlay. The connection detail lives at a full-page
    // route (not a @detail drawer), and editing rides a self-owned modal — so no
    // `hasDetailView`. The single-step SurfaceFrame create opts into drawer/modal.
    {
      id: 'inventory-source',
      label: 'Inventory source',
      routePrefix: '/inventory/sources',
    },
    // Supplier create-only overlay. The supplier detail (edit/archive + per-variant
    // purchasing links) is a wide full-page surface, so no `hasDetailView`; the
    // single-step SurfaceFrame create opts into the drawer/modal.
    {
      id: 'supplier',
      label: 'Supplier',
      routePrefix: '/inventory/suppliers',
    },
    // Lot create-only overlay. The lot detail (serial roster, status changes,
    // recalls) is a full-page surface, so no `hasDetailView`; the single-step
    // SurfaceFrame create opts into the drawer/modal.
    {
      id: 'lot',
      label: 'Lot',
      routePrefix: '/inventory/lots',
    },
    // Count create-only overlay. The count detail (quantity entry → review →
    // approve → post) is a full-page surface, so no `hasDetailView`; the single-step
    // SurfaceFrame create opts into the drawer/modal.
    {
      id: 'count',
      label: 'Count',
      routePrefix: '/inventory/counts',
    },
  ],
};
