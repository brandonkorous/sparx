import type { ModuleManifest } from '@sparx/ui/shell';
import { Warehouse, MapPin, Link2 } from 'lucide-react';

export const inventoryManifest: ModuleManifest = {
  id: 'inventory',
  label: 'Inventory',
  icon: Warehouse,
  routePrefix: '/inventory',
  sections: [
    { id: 'sources', label: 'Sources', icon: Link2, href: '/inventory/sources' },
    { id: 'locations', label: 'Locations', icon: MapPin, href: '/inventory/locations' },
  ],
  actions: [],
  entityTypes: [],
};
