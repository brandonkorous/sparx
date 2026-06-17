import type { ModuleManifest } from '@sparx/ui/shell';
import {
  Warehouse,
  Boxes,
  Layers,
  Link2,
  Plus,
  Truck,
  ClipboardList,
  PackageCheck,
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
    { id: 'lots', label: 'Lots & serials', icon: Layers, href: '/inventory/lots' },
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
  ],
  entityTypes: [
    {
      id: 'warehouse',
      label: 'Warehouse',
      routePrefix: '/inventory/warehouses',
      hasDetailView: true,
    },
  ],
};
