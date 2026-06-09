import type { ModuleManifest } from '@sparx/ui/shell';
import { Building2, CheckCircle, DollarSign, FileText, Receipt } from 'lucide-react';

export const b2bManifest: ModuleManifest = {
  id: 'b2b',
  label: 'B2B',
  icon: Building2,
  routePrefix: '/b2b',
  sections: [
    {
      id: 'accounts',
      label: 'Accounts',
      icon: Building2,
      href: '/b2b/accounts',
    },
    {
      id: 'quotes',
      label: 'Quotes / RFQ',
      icon: FileText,
      href: '/b2b/quotes',
    },
    {
      id: 'invoices',
      label: 'Invoices',
      icon: Receipt,
      href: '/b2b/invoices',
    },
    {
      id: 'pricing-tiers',
      label: 'Pricing Tiers',
      icon: DollarSign,
      href: '/b2b/pricing-tiers',
    },
    {
      id: 'approval-queue',
      label: 'Approval Queue',
      icon: CheckCircle,
      href: '/b2b/approval-queue',
    },
  ],
  actions: [],
  entityTypes: ['b2b-account'],
};
