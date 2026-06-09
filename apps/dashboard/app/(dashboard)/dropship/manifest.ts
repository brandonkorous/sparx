import type { ModuleManifest } from '@sparx/ui/shell';
import { Truck, Package, Link2, BarChart2 } from 'lucide-react';

export const dropshipManifest: ModuleManifest = {
  id: 'dropship',
  label: 'Dropship',
  icon: Truck,
  routePrefix: '/dropship',
  sections: [
    { id: 'suppliers', label: 'Suppliers', icon: Link2, href: '/dropship/suppliers' },
    { id: 'products', label: 'Products', icon: Package, href: '/dropship/products' },
    { id: 'analytics', label: 'Profitability', icon: BarChart2, href: '/dropship/analytics' },
  ],
  actions: [],
  entityTypes: [],
};
