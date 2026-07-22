// Finance — money in, and the one bill that goes out.
//
// The split between the two sections is deliberate and stays: what your
// customers pay YOU is a different question from what you pay sparx, and
// mixing them in one list is how an owner ends up misreading their own numbers.

import { Banknote, CreditCard, ReceiptText, Store, Wallet } from 'lucide-react';
import type { SurfaceDefinition } from '../registry';
import { PaymentsListSurface } from '../../../surfaces/finance/payments-list';
import { PayoutsListSurface } from '../../../surfaces/finance/payouts-list';
import { PayoutDetailSurface } from '../../../surfaces/finance/payout-detail';
import { ReceivablesSurface } from '../../../surfaces/finance/receivables';
import { ChannelsSurface } from '../../../surfaces/finance/channels';
import { SubscriptionSurface } from '../../../surfaces/finance/subscription';

export const FINANCE_SURFACES: SurfaceDefinition[] = [
  {
    key: 'finance.payments.list',
    title: 'Payments',
    module: 'finance',
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
    icon: Store,
    component: ChannelsSurface,
    section: 'Money coming in',
    order: 12,
    keywords: ['channels', 'sources', 'breakdown'],
  },

  /* ── What you pay sparx ────────────────────────────────────────────────── */
  {
    key: 'finance.subscription',
    title: 'Your sparx bill',
    module: 'finance',
    icon: CreditCard,
    component: SubscriptionSurface,
    singleton: true,
    section: 'What you pay sparx',
    order: 20,
    keywords: ['subscription', 'billing', 'plan', 'invoice from sparx', 'card on file'],
  },
];
