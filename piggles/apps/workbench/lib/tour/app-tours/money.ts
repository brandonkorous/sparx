// The Money apps — Invoices and Money.
//
// The mascot never appears in either of these walks and never will; a cartoon
// beside somebody's takings is the one place warmth reads as not taking it
// seriously (DESIGN.md §7).

import type { Guide } from '../types';

export const INVOICES_GUIDE: Guide = {
  id: 'invoicing',
  offer: 'First time in Invoices? Show me around',
  steps: [
    {
      id: 'invoices.list',
      app: 'invoices',
      anchor: 'nav-invoicing.invoices.list',
      title: 'Everything you have billed',
      body: 'Draft, sent, paid, overdue — the whole lot in one list, newest first. Somebody can pay straight from the one you send them, and it marks itself off when they do.',
    },
    {
      id: 'invoices.templates',
      app: 'invoices',
      anchor: 'nav-invoicing.templates',
      title: 'What yours look like',
      body: 'Your logo, your terms, your wording, your payment details. Set it once here rather than fixing it on every invoice you ever send.',
    },
    {
      id: 'invoices.workflows',
      app: 'invoices',
      anchor: 'nav-invoicing.workflows',
      title: 'Chasing, without doing the chasing',
      body: 'Decide what happens when one goes unpaid — a polite reminder after a week, a firmer one after a fortnight. Piggles sends them, and stops the moment they pay.',
    },
  ],
};

export const MONEY_GUIDE: Guide = {
  id: 'finance',
  offer: 'First time in Money? Show me around',
  steps: [
    {
      id: 'money.payments',
      app: 'money',
      anchor: 'nav-finance.payments.list',
      title: 'What came in',
      body: 'Every payment, however it reached you — a card on your site, a bank transfer against an invoice, cash you put in by hand. This is the money side of what the other apps have been recording.',
    },
    {
      id: 'money.spending',
      app: 'money',
      anchor: 'nav-finance.spending',
      title: 'And what went out',
      body: 'Stock, rent, fuel, subscriptions, the accountant. Put your costs in here and the numbers below stop being turnover and start being what you actually kept.',
    },
    {
      id: 'money.profit',
      app: 'money',
      anchor: 'nav-finance.profit',
      title: 'What you kept',
      body: 'In, minus out, by month and by what you sell. It only tells you the truth once your costs are in — until then it is honest about being incomplete rather than quietly flattering.',
    },
    {
      id: 'money.accounting',
      app: 'money',
      anchor: 'nav-finance.accounting',
      title: 'Handing it to your accountant',
      body: 'Connect the books you already keep and everything here goes across on its own, coded the way you set up once. If you would rather not connect anything, it exports instead.',
    },
  ],
};
