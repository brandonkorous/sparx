// Finance — money in, and the one bill that goes out.
//
// The split between the two sections is deliberate and stays: what your
// customers pay YOU is a different question from what you pay sparx, and
// mixing them in one list is how an owner ends up misreading their own numbers.

import { Banknote, CreditCard, ReceiptText, Store, Wallet } from 'lucide-react';
import type { SurfaceDefinition } from '../registry';
import { stub } from './stub';

export const FINANCE_SURFACES: SurfaceDefinition[] = [
  stub({
    key: 'finance.payments.list',
    title: 'Payments',
    module: 'finance',
    icon: Wallet,
    order: 1,
    keywords: ['takings', 'transactions', 'card', 'refunds'],
    body: 'Every payment your customers have made, including the ones that failed or were refunded.',
  }),

  /* ── Money coming in ───────────────────────────────────────────────────── */
  stub({
    key: 'finance.payouts.list',
    title: 'Payouts',
    module: 'finance',
    icon: Banknote,
    section: 'Money coming in',
    order: 10,
    keywords: ['bank', 'deposits', 'settlement', 'transfer'],
    body: 'The money actually landing in your bank account, and which sales each deposit is made up of.',
  }),
  stub({
    key: 'finance.receivables',
    title: 'Owed to you',
    module: 'finance',
    icon: ReceiptText,
    section: 'Money coming in',
    order: 11,
    keywords: ['receivables', 'unpaid', 'overdue', 'chasing', 'debtors'],
    body: 'What has been invoiced but not yet paid, and how late each one is.',
  }),
  stub({
    key: 'finance.channels',
    title: 'Where money comes from',
    module: 'finance',
    icon: Store,
    section: 'Money coming in',
    order: 12,
    keywords: ['channels', 'sources', 'breakdown'],
    body: 'Your takings split by where the sale happened — your site, a marketplace, in person.',
  }),

  /* ── What you pay sparx ────────────────────────────────────────────────── */
  stub({
    key: 'finance.subscription',
    title: 'Your sparx bill',
    module: 'finance',
    icon: CreditCard,
    section: 'What you pay sparx',
    order: 20,
    keywords: ['subscription', 'billing', 'plan', 'invoice from sparx', 'card on file'],
    body: 'What sparx charges you, which modules make up that amount, and the card it comes off.',
  }),
];
