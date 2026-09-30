import type { AppMarketing } from './types';
import { CONNECTIONS_CHAPTERS } from './chapters/connections';

// Bullets corrected 2026-09-30 (see chapters/connections.ts for what was
// checked). Accounting and marketplace connections are not switched on for
// anybody yet, so "the usual suspects ... connected by signing in" named two
// categories nobody can connect, and payments, delivery and AI accounts all
// connect by pasting details rather than by signing in. The "tell other
// software" events are order paid, form filled in, content and stock, not
// "a booking is made". And there is no full-account export: the downloads that
// exist are named instead.

export const CONNECTIONS: AppMarketing = {
  heading: 'Piggles and the other things you already use.',
  lede: 'Connections links Piggles to the software you are not giving up (the payment provider, the delivery service, the AI you already pay for) and lets the AI assistant you already use work with your business records, under your control.',
  alsoKnownAs: ['integrations', 'API', 'webhooks', 'MCP', 'AI assistant'],
  does: [
    {
      title: 'The services you already pay for',
      body: 'Payments through Stripe, PayPal, Square and others, delivery prices and labels through Shippo, and your own AI account, each set up with directions for every box.',
    },
    {
      title: 'Tell other software what happened',
      body: 'Send word to another tool the moment an order is paid, a form is filled in or stock runs low, and see whether it arrived.',
    },
    {
      title: 'Work with an AI assistant',
      body: 'Connect the assistant you already use and ask it about your own business: what sold, what is low, who has not paid.',
    },
    {
      title: 'Your key, your choice',
      body: 'AI features run on an account you connect, so nothing is sent anywhere you did not agree to. Piggles never quietly uses your data to run somebody else’s model.',
    },
    {
      title: 'Bring your history with you',
      body: 'Import products, customers and past orders from a spreadsheet or another system, with a preview before anything is written.',
    },
    {
      title: 'Take your records with you',
      body: 'Customers, products, orders, invoices, bookings and more download as spreadsheets, and a key lets your own tools reach only what you allow.',
    },
  ],
  chapters: CONNECTIONS_CHAPTERS,
  worksWith: ['money', 'sell', 'team'],
};
