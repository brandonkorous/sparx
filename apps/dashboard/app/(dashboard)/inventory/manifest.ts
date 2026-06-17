import type { ModuleManifest } from '@sparx/ui/shell';
import { Warehouse, Boxes, Layers, Link2, Plus } from 'lucide-react';

export const inventoryManifest: ModuleManifest = {
  id: 'inventory',
  label: 'Inventory',
  icon: Warehouse,
  routePrefix: '/inventory',
  sections: [
    { id: 'stock', label: 'Stock', icon: Boxes, href: '/inventory/stock' },
    { id: 'warehouses', label: 'Warehouses', icon: Warehouse, href: '/inventory/warehouses' },
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
