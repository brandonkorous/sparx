// Wholesale — selling to other businesses rather than to the public.
//
// The keys are the contract: a saved layout, a deep link and every cross-link
// from an account into its orders/quotes/invoices all name these strings, so
// they are immutable. Detail surfaces are `listed: false` — reachable from their
// list (and the nav's `+`), never opened cold from the launcher.

import { Building2, CheckCircle, DollarSign, FileText, Receipt, ShoppingCart } from 'lucide-react';
import { B2B_QUOTE_WORKFLOW_SLUG } from '@wizeworks/crm-schemas/builtins';
import type { SurfaceDefinition } from '../registry';
import { AccountsListSurface } from '../../../surfaces/b2b/accounts-list';
import { AccountDetailSurface } from '../../../surfaces/b2b/account-detail';
import { WholesaleOrdersListSurface } from '../../../surfaces/b2b/orders-list';
import { QuotesListSurface } from '../../../surfaces/b2b/quotes-list';
import { QuoteDetailSurface } from '../../../surfaces/b2b/quote-detail';
import { InvoicesListSurface } from '../../../surfaces/b2b/invoices-list';
import { InvoiceDetailSurface } from '../../../surfaces/b2b/invoice-detail';
import { PricingTiersListSurface } from '../../../surfaces/b2b/pricing-tiers-list';
import { PricingTierDetailSurface } from '../../../surfaces/b2b/pricing-tier-detail';
import { ApprovalsSurface } from '../../../surfaces/b2b/approvals';

export const B2B_SURFACES: SurfaceDefinition[] = [
  {
    // Unsectioned on purpose: accounts are the module's centre — everything else
    // hangs off one — so they lead the panel above the Trade/Setup groups.
    key: 'b2b.accounts.list',
    title: 'Accounts',
    module: 'b2b',
    icon: Building2,
    order: 1,
    keywords: ['trade', 'companies', 'buyers', 'dealers', 'wholesale'],
    component: AccountsListSurface,
    createSurface: 'b2b.account.detail',
    createLabel: 'Add a trade account',
  },
  {
    key: 'b2b.account.detail',
    title: (params) => (params.id === 'new' ? 'New account' : 'Account'),
    module: 'b2b',
    icon: Building2,
    component: AccountDetailSurface,
    listed: false,
  },

  /* ── Trade ─────────────────────────────────────────────────────────────── */
  {
    key: 'b2b.orders.list',
    title: 'Wholesale orders',
    module: 'b2b',
    icon: ShoppingCart,
    section: 'Trade',
    order: 10,
    keywords: ['trade orders', 'bulk'],
    component: WholesaleOrdersListSurface,
  },
  {
    key: 'b2b.quotes.list',
    title: 'Quotes',
    module: 'b2b',
    icon: FileText,
    section: 'Trade',
    order: 11,
    keywords: ['rfq', 'estimate', 'request for quote', 'pricing request'],
    component: QuotesListSurface,
    // The invoicing editor, told which kind of document to make. A quote IS a
    // billing document on the system `b2b-quotes` workflow, so the screen that
    // prices one already exists — it just had no door from here. A business
    // that rings and asks what a bulk order would cost is the ordinary way a
    // quote starts, and this pane answered it with an empty card and nothing
    // to press (issue 761).
    createSurface: 'invoicing.invoice.edit',
    createParams: { workflow: B2B_QUOTE_WORKFLOW_SLUG },
    createLabel: 'Price up a quote',
  },
  {
    key: 'b2b.quote.detail',
    title: 'Quote',
    module: 'b2b',
    icon: FileText,
    component: QuoteDetailSurface,
    listed: false,
  },
  {
    key: 'b2b.invoices.list',
    title: 'Wholesale invoices',
    module: 'b2b',
    icon: Receipt,
    section: 'Trade',
    order: 12,
    keywords: ['bills', 'terms', 'payment due', 'receivables'],
    component: InvoicesListSurface,
    createSurface: 'b2b.invoice.detail',
    createLabel: 'Raise an invoice',
  },
  {
    key: 'b2b.invoice.detail',
    title: (params) => (params.id === 'new' ? 'New invoice' : 'Invoice'),
    module: 'b2b',
    icon: Receipt,
    component: InvoiceDetailSurface,
    listed: false,
  },

  /* ── Setup ─────────────────────────────────────────────────────────────── */
  {
    key: 'b2b.pricing-tiers.list',
    title: 'Price tiers',
    module: 'b2b',
    icon: DollarSign,
    section: 'Setup',
    order: 20,
    keywords: ['trade price', 'levels', 'discount tier', 'volume'],
    component: PricingTiersListSurface,
    createSurface: 'b2b.pricing-tier.detail',
    createLabel: 'Add a price tier',
  },
  {
    key: 'b2b.pricing-tier.detail',
    title: (params) => (params.id === 'new' ? 'New price tier' : 'Price tier'),
    module: 'b2b',
    icon: DollarSign,
    component: PricingTierDetailSurface,
    listed: false,
  },
  {
    key: 'b2b.approvals',
    title: 'Approvals',
    module: 'b2b',
    icon: CheckCircle,
    section: 'Setup',
    order: 21,
    keywords: ['approval queue', 'authorize', 'authorise', 'sign off', 'credit limit'],
    component: ApprovalsSurface,
  },
];
