import type { PigglesAppId } from '@piggles/config';
import type { AreaCell, AreaId } from './types';

// The Piggles column of every comparison table, written ONCE so six pages cannot
// describe the same product six ways. Each line was checked against the code on
// 2026-09-30 (piggles/docs/marketing/HANDOFF-2026-09-30.md §3). The two "no"
// rows and the "partly" rows are the ones a rival's customer will test first,
// so they are the ones that must never drift toward optimism.

export const AREA_LABELS: Record<AreaId, string> = {
  website: 'A website',
  store: 'An online shop',
  'in-person': 'Selling in person',
  bookings: 'Appointments',
  invoices: 'Quotes and invoices',
  customers: 'A customer list',
  'help-desk': 'Customer requests',
  email: 'Email to your customers',
  texts: 'Text messages',
  social: 'Posting to social media',
  stock: 'Stock in more than one place',
  'purchase-orders': 'Ordering from suppliers',
  team: 'Staff hours and shifts',
  payroll: 'Payroll',
  automations: 'Automations',
  ai: 'An AI assistant',
  accounting: 'Accounting and tax returns',
};

/** The app a row belongs to, so the Piggles cell links to the page that explains it. */
export const AREA_APP: Partial<Record<AreaId, PigglesAppId>> = {
  website: 'site',
  store: 'sell',
  'in-person': 'sell',
  bookings: 'bookings',
  invoices: 'invoices',
  customers: 'customers',
  'help-desk': 'customers',
  email: 'messages',
  social: 'get_found',
  stock: 'stock',
  'purchase-orders': 'partners',
  team: 'team',
  automations: 'automations',
  ai: 'connections',
  accounting: 'money',
};

export const PIGGLES_AREAS: Record<AreaId, AreaCell> = {
  website: {
    offer: 'built-in',
    note: 'Finished sections you arrange, on your own domain.',
  },
  store: {
    offer: 'built-in',
    note: 'Products, services, checkout and trade accounts.',
  },
  'in-person': {
    offer: 'partly',
    note: 'A counter sale is recorded as an order. There is no card reader or till app.',
  },
  bookings: {
    offer: 'built-in',
    note: 'Services, staff calendars, email reminders and booking online.',
  },
  invoices: {
    offer: 'built-in',
    note: 'Quotes that become jobs, then invoices, with a payment link.',
  },
  customers: {
    offer: 'built-in',
    note: 'One record per customer with orders, bookings and messages.',
  },
  'help-desk': {
    offer: 'built-in',
    note: 'Requests with an owner and a time to answer by.',
  },
  email: {
    offer: 'built-in',
    note: 'Emails to a list, from your own address.',
  },
  texts: {
    offer: 'no',
    note: 'Piggles does not send text messages.',
  },
  social: {
    offer: 'built-in',
    note: 'Facebook, Instagram, LinkedIn, Google, TikTok, YouTube and Threads.',
  },
  stock: {
    offer: 'built-in',
    note: 'Counts per location, reorder points and transfers. One location included.',
  },
  'purchase-orders': {
    offer: 'partly',
    note: 'Write, approve and receive orders. You print or send them yourself.',
  },
  team: {
    offer: 'built-in',
    note: 'Clock in and out, timesheets, a published schedule and time off.',
  },
  payroll: {
    offer: 'no',
    note: 'Approved hours download as a file for whoever runs your payroll.',
  },
  automations: {
    offer: 'built-in',
    note: 'Routine steps that run on their own when something happens.',
  },
  ai: {
    offer: 'partly',
    note: 'Bring your own Anthropic or OpenAI account, or connect Claude or ChatGPT.',
  },
  accounting: {
    offer: 'no',
    note: 'Money shows what came in and went out. It is not accounting software.',
  },
};
