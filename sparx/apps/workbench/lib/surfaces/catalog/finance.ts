// Finance — money in, and the one bill that goes out.
//
// The split between the two sections is deliberate and stays: what your
// customers pay YOU is a different question from what you pay sparx, and
// mixing them in one list is how an owner ends up misreading their own numbers.
//
// GATING (docs/148 §2). One colored group, three different entitlement answers,
// which is why every surface here carries an explicit `requiresModules` instead
// of inheriting the group's `finance` hue as its gate:
//
//   • Money coming in  — a VIEW of data the tenant already paid for through
//     commerce / invoicing / b2b / scheduling. Charging to look at your own
//     takings would be a tax on data they already bought, so these ride along
//     with whichever selling module produced them. A tenant with none of those
//     has no payments to show, so hiding them is also the honest answer.
//   • Your sparx bill  — NEVER gated. It is where someone goes to buy a module;
//     putting it behind one is a locked door with the key inside.
//   • Spend + profitability (docs/148 §5) — the billable `finance` module, and
//     the only part of this group that requires it. Note that "requires it" is
//     satisfied for a Commerce or B2B tenant WITHOUT a purchase: `finance` is
//     BUNDLED_FREE with both, so `useReachableModules` reports it enabled for
//     them and these surfaces simply appear. Nothing here needs to know that.
//
// Leaving any of these to the default would gate the whole group on `finance`
// the moment that slug became real, which would take four shipping surfaces away
// from every tenant that has not bought the new module.

/** The selling modules that can produce money coming in. Any one is enough. */
const EARNS_MONEY = ['commerce', 'invoicing', 'b2b', 'scheduling'] as const;

import {
  Banknote,
  CalendarClock,
  CreditCard,
  Building2,
  FolderTree,
  Plug,
  ReceiptText,
  Store,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { SurfaceDefinition } from '../registry';
import { PaymentsListSurface } from '../../../surfaces/finance/payments-list';
import { PayoutsListSurface } from '../../../surfaces/finance/payouts-list';
import { PayoutDetailSurface } from '../../../surfaces/finance/payout-detail';
import { ReceivablesSurface } from '../../../surfaces/finance/receivables';
import { ChannelsSurface } from '../../../surfaces/finance/channels';
import { SubscriptionSurface } from '../../../surfaces/finance/subscription';
import { SpendingListSurface } from '../../../surfaces/finance/spending-list';
import { ExpenseDetailSurface } from '../../../surfaces/finance/expense-detail';
import { BillsToPaySurface } from '../../../surfaces/finance/bills-to-pay';
import { RecurringCostsSurface } from '../../../surfaces/finance/recurring-costs';
import { VendorsListSurface } from '../../../surfaces/finance/vendors-list';
import { ProfitSurface } from '../../../surfaces/finance/profit';
import { JobProfitSurface } from '../../../surfaces/finance/job-profit';
import { CategoriesSurface } from '../../../surfaces/finance/categories';
import { AccountingSurface } from '../../../surfaces/finance/accounting';

export const FINANCE_SURFACES: SurfaceDefinition[] = [
  {
    key: 'finance.payments.list',
    title: 'Payments',
    module: 'finance',
    requiresModules: EARNS_MONEY,
    icon: Wallet,
    component: PaymentsListSurface,
    order: 1,
    keywords: ['takings', 'transactions', 'card', 'refunds'],
  },

  /* ── Money coming in ───────────────────────────────────────────────────── */
  {
    key: 'finance.payouts.list',
    title: 'Payouts',
    module: 'finance',
    requiresModules: EARNS_MONEY,
    icon: Banknote,
    component: PayoutsListSurface,
    section: 'Money coming in',
    order: 10,
    keywords: ['bank', 'deposits', 'settlement', 'transfer'],
  },
  {
    key: 'finance.payout.detail',
    title: 'Deposit',
    module: 'finance',
    requiresModules: EARNS_MONEY,
    icon: Banknote,
    component: PayoutDetailSurface,
    // Reachable from the payouts list, never the launcher — opening "a deposit"
    // with none in mind isn't a thing anyone wants.
    listed: false,
  },
  {
    key: 'finance.receivables',
    title: 'Owed to you',
    module: 'finance',
    requiresModules: EARNS_MONEY,
    icon: ReceiptText,
    component: ReceivablesSurface,
    section: 'Money coming in',
    order: 11,
    keywords: ['receivables', 'unpaid', 'overdue', 'chasing', 'debtors'],
  },
  {
    key: 'finance.channels',
    title: 'Where money comes from',
    module: 'finance',
    requiresModules: EARNS_MONEY,
    icon: Store,
    component: ChannelsSurface,
    section: 'Money coming in',
    order: 12,
    keywords: ['channels', 'sources', 'breakdown'],
  },

  /* ── Money going out — the billable half (docs/148 §5) ─────────────────── */
  {
    key: 'finance.spending',
    title: 'Spending',
    module: 'finance',
    icon: Wallet,
    component: SpendingListSurface,
    section: 'Money going out',
    order: 20,
    createSurface: 'finance.expense.detail',
    createLabel: 'Record a cost',
    keywords: ['expenses', 'costs', 'outgoings', 'purchases', 'receipts', 'bought'],
  },
  {
    key: 'finance.expense.detail',
    title: (params) => (params.id === 'new' ? 'New cost' : 'Cost'),
    module: 'finance',
    icon: ReceiptText,
    component: ExpenseDetailSurface,
    // Reached from the list or the `+`, never browsed to on its own.
    listed: false,
  },
  {
    key: 'finance.bills',
    title: 'Bills to pay',
    module: 'finance',
    icon: ReceiptText,
    component: BillsToPaySurface,
    singleton: true,
    section: 'Money going out',
    order: 21,
    keywords: ['payables', 'owed', 'unpaid', 'due', 'overdue', 'suppliers to pay'],
  },
  {
    key: 'finance.recurring',
    title: 'Repeating costs',
    module: 'finance',
    icon: CalendarClock,
    component: RecurringCostsSurface,
    singleton: true,
    section: 'Money going out',
    order: 22,
    keywords: ['recurring', 'subscriptions', 'rent', 'insurance', 'standing', 'monthly'],
  },
  {
    key: 'finance.vendors',
    title: 'Who you pay',
    module: 'finance',
    icon: Building2,
    component: VendorsListSurface,
    singleton: true,
    section: 'Money going out',
    order: 23,
    keywords: ['vendors', 'payees', 'suppliers', 'landlord', 'contractors'],
  },

  /* ── Did we make money ─────────────────────────────────────────────────── */
  {
    key: 'finance.profit',
    title: 'Profit',
    module: 'finance',
    icon: TrendingUp,
    component: ProfitSurface,
    singleton: true,
    section: 'Did we make money',
    order: 30,
    keywords: ['profit', 'margin', 'p&l', 'bottom line', 'did we make money', 'loss'],
  },
  {
    key: 'finance.jobs',
    title: 'By job',
    module: 'finance',
    icon: TrendingUp,
    component: JobProfitSurface,
    singleton: true,
    section: 'Did we make money',
    order: 31,
    keywords: ['job profitability', 'per order', 'margin by job', 'which jobs', 'losing money'],
  },

  /* ── Settings ──────────────────────────────────────────────────────────── */
  {
    key: 'finance.categories',
    title: 'Spending categories',
    module: 'finance',
    icon: FolderTree,
    component: CategoriesSurface,
    singleton: true,
    section: 'Settings',
    order: 40,
    keywords: ['categories', 'buckets', 'expense types', 'cost of sale', 'overheads'],
  },
  {
    key: 'finance.accounting',
    title: 'Accounting',
    module: 'finance',
    icon: Plug,
    component: AccountingSurface,
    singleton: true,
    section: 'Settings',
    order: 41,
    keywords: ['quickbooks', 'sage', 'peachtree', 'xero', 'export', 'import', 'accountant', 'csv'],
  },

  /* ── What you pay sparx ────────────────────────────────────────────────── */
  {
    key: 'finance.subscription',
    title: 'Your sparx bill',
    module: 'finance',
    // Never gated: this is where someone goes to BUY a module.
    requiresModules: [],
    icon: CreditCard,
    component: SubscriptionSurface,
    singleton: true,
    section: 'What you pay sparx',
    // Last in the module. What sparx charges is a footnote next to what the
    // business itself earns and spends, and it used to sort above the spend
    // half purely because it was the only thing here.
    order: 50,
    keywords: ['subscription', 'billing', 'plan', 'invoice from sparx', 'card on file'],
  },
];
