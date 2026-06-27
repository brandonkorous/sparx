import type { LucideIcon } from 'lucide-react';
import { Banknote, CreditCard, ReceiptText, Store, Wallet } from 'lucide-react';

// The Finance hub surface, in one place (docs/109 §4). Finance is a first-class
// platform area (a peer of Settings, not a module — no manifest, no module color),
// so the contextual panel borrows the section slot to navigate it, and the hub
// landing renders the same list as a grouped card grid. Single source → the panel
// and the landing can never drift.
//
// `group` carries the money-flow split that is the whole point of the hub
// (docs/109 §4.1): every "you get paid" section vs the one "you pay sparx"
// section. The panel and landing render the split from this field — it is the
// binding visual contract, not decoration.
//
// `ready: false` items are sections we've scoped but not built yet (their slice
// in docs/110 hasn't landed). They render as disabled rows in the panel and
// "Soon" cards on the landing — the `href` is their eventual home, unused while
// disabled.

export type FinanceFlow = 'in' | 'sparx';

export interface FinanceNavItem {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  href: string;
  ready: boolean;
  /** 'in' = money in (customers/marketplace pay you); 'sparx' = money out (you pay sparx). */
  group: FinanceFlow;
}

export const FINANCE_NAV: readonly FinanceNavItem[] = [
  {
    id: 'payments',
    label: 'Payments',
    description: 'Accept payments with sparx Pay, your own processor, or PayPal.',
    icon: Wallet,
    href: '/finance/payments',
    ready: true,
    group: 'in',
  },
  {
    id: 'payouts',
    label: 'Payouts',
    description: 'Connect payout balance, sparx.market settlement, and your bank account.',
    icon: Banknote,
    href: '/finance/payouts',
    ready: true,
    group: 'in',
  },
  {
    id: 'channels',
    label: 'Channels',
    description: 'Revenue, fees, and net by sales channel.',
    icon: Store,
    href: '/finance/channels',
    ready: true,
    group: 'in',
  },
  {
    id: 'receivables',
    label: 'Receivables',
    description: 'Outstanding invoices and AR aging across Invoicing and B2B.',
    icon: ReceiptText,
    href: '/finance/receivables',
    ready: true,
    group: 'in',
  },
  {
    id: 'subscription',
    label: 'sparx subscription',
    description: 'What you pay sparx — your plan, status, and invoices.',
    icon: CreditCard,
    href: '/finance/subscription',
    ready: true,
    group: 'sparx',
  },
] as const;

/** Section groups in display order, with the human label for the money-flow split. */
export const FINANCE_FLOW_LABELS: Record<FinanceFlow, string> = {
  in: 'You get paid',
  sparx: 'You pay sparx',
};
