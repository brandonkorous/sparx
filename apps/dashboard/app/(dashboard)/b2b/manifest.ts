import type { ModuleManifest } from '@sparx/ui/shell';
import { Building2, CheckCircle, DollarSign, FileText, Receipt, ShoppingCart } from 'lucide-react';

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
    // B2B's own order route — the receivables desk, scoped to orders placed by
    // customers who belong to a B2B account. Orders are a shared spine (one
    // /v1/orders API root) but Commerce, B2B, and CRM are separately billed
    // modules with different jobs, so each owns a real route. This one leads
    // with balance + terms rather than fulfillment. See _orders/lens.ts.
    // Sits after Accounts and before Quotes: accounts → their orders → the
    // quotes that become them.
    {
      id: 'orders',
      label: 'Orders',
      icon: ShoppingCart,
      href: '/b2b/orders',
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
  entityTypes: [
    { id: 'b2b-account', label: 'B2B Account', routePrefix: '/b2b/accounts' },
    // Order detail opens in the drawer/modal chrome like the other two lenses.
    { id: 'order', label: 'Order', routePrefix: '/b2b/orders', hasDetailView: true },
    // Create-only overlays (no detail view: the lists edit via a self-owned modal).
    { id: 'b2b-pricing-tier', label: 'Pricing tier', routePrefix: '/b2b/pricing-tiers' },
  ],
};
