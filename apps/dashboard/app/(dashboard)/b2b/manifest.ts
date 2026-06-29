import type { ModuleManifest } from '@sparx/ui/shell';
import { Building2, Calendar, CheckCircle, DollarSign, FileText, Receipt } from 'lucide-react';

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
    {
      id: 'appointments',
      label: 'Appointments',
      icon: Calendar,
      href: '/b2b/appointments',
    },
    {
      id: 'service-types',
      label: 'Service Types',
      icon: Calendar,
      href: '/b2b/service-types',
    },
  ],
  actions: [],
  entityTypes: [
    { id: 'b2b-account', label: 'B2B Account', routePrefix: '/b2b/accounts' },
    // Create-only overlays (no detail view: the lists edit via a self-owned modal).
    { id: 'b2b-service-type', label: 'Service type', routePrefix: '/b2b/service-types' },
    { id: 'b2b-pricing-tier', label: 'Pricing tier', routePrefix: '/b2b/pricing-tiers' },
  ],
};
