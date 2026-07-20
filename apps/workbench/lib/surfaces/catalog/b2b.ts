// Wholesale — selling to other businesses rather than to the public.

import { Building2, CheckCircle, DollarSign, FileText, Receipt, ShoppingCart } from 'lucide-react';
import type { SurfaceDefinition } from '../registry';
import { stub } from './stub';

export const B2B_SURFACES: SurfaceDefinition[] = [
  stub({
    key: 'b2b.accounts.list',
    title: 'Accounts',
    module: 'b2b',
    icon: Building2,
    order: 1,
    keywords: ['trade', 'companies', 'buyers', 'dealers'],
    body: 'The businesses that buy from you, each with its own agreed prices and its own people who can order.',
  }),

  /* ── Trade ─────────────────────────────────────────────────────────────── */
  stub({
    key: 'b2b.orders.list',
    title: 'Wholesale orders',
    module: 'b2b',
    icon: ShoppingCart,
    section: 'Trade',
    order: 10,
    keywords: ['trade orders', 'bulk'],
    body: 'Orders placed by a wholesale account, which usually run on agreed prices and payment terms rather than card at checkout.',
  }),
  stub({
    key: 'b2b.quotes.list',
    title: 'Quotes',
    module: 'b2b',
    icon: FileText,
    section: 'Trade',
    order: 11,
    keywords: ['rfq', 'estimate', 'request for quote', 'pricing request'],
    body: 'A business asks what a job or a bulk order would cost; you price it up and they accept or decline.',
  }),
  stub({
    key: 'b2b.invoices.list',
    title: 'Wholesale invoices',
    module: 'b2b',
    icon: Receipt,
    section: 'Trade',
    order: 12,
    keywords: ['bills', 'terms', 'payment due'],
    body: 'What each account owes you, when it is due, and what has been paid.',
  }),

  /* ── Setup ─────────────────────────────────────────────────────────────── */
  stub({
    key: 'b2b.pricing-tiers.list',
    title: 'Price tiers',
    module: 'b2b',
    icon: DollarSign,
    section: 'Setup',
    order: 20,
    keywords: ['trade price', 'levels', 'discount tier', 'volume'],
    body: 'Named price levels — trade, distributor, key account — so you set a discount once instead of per customer.',
  }),
  stub({
    key: 'b2b.approvals',
    title: 'Approvals',
    module: 'b2b',
    icon: CheckCircle,
    section: 'Setup',
    order: 21,
    keywords: ['approval queue', 'authorise', 'sign off', 'credit limit'],
    body: 'Orders waiting on someone to say yes — because they are over a limit, or the account requires it.',
  }),
];
