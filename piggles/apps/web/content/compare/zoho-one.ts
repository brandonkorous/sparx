import { APP_COUNT_WORD } from '@piggles/config';
import type { ComparePage } from './types';

// Facts about Zoho One: piggles/docs/marketing/COMPETITORS-2026-09-30.md §Zoho One.

export const ZOHO_ONE: ComparePage = {
  slug: 'zoho-one',
  name: 'Zoho One',
  isA: 'a suite of more than forty business apps under one sign-in',
  heading: `Piggles or Zoho One: more than forty apps, or ${APP_COUNT_WORD} that fit together?`,
  lede: `Zoho One is one of the broadest suites a small business can buy, with real accounting, payroll in some countries and an app for almost every department. Piggles is smaller on purpose: ${APP_COUNT_WORD} apps that share one customer, one catalog and one screen. Here is which one suits you.`,
  searchTerms: [
    'Piggles vs Zoho One',
    'Zoho One alternative',
    'Zoho alternative for small business',
    'simpler alternative to Zoho',
    'all-in-one business software',
  ],
  theyWin: [
    {
      title: 'Real accounting',
      body: 'Zoho One includes Zoho Books, a full accounting app. Piggles is not accounting software: Money shows what came in and went out, and your accountant still needs their own tool.',
    },
    {
      title: 'HR and payroll',
      body: 'Zoho One includes HR, recruiting and, in some countries, payroll. Piggles records hours and hands them to whoever runs your payroll.',
    },
    {
      title: 'Sheer breadth',
      body: 'Projects, a help desk, team chat, company email, file storage and more. If a department exists, Zoho probably has an app for it.',
    },
  ],
  turn: 'Zoho One gives every department its own app. Piggles gives a small business one place where every app already knows the customer.',
  weWin: [
    {
      title: 'Built for an owner and a small team',
      body: 'More than forty apps is a lot of setup for a florist. Piggles arrives set up from two questions at signup, and each app opens on real screens rather than a configuration project.',
    },
    {
      title: 'One record, not one per app',
      body: 'In Piggles a customer’s orders, bookings, invoices, emails and requests are on one record, because they are one product. Across a suite of separate apps, that joining up is something you set up.',
    },
    {
      title: 'A price that does not count every employee',
      body: 'Zoho One is priced per employee, and you license every employee. Piggles includes three team members in one flat price; add a person only when they need to sign in.',
    },
    {
      title: 'A website and shop that feel like one thing',
      body: 'The site, the checkout, the stock and the customer list are the same product, so a sale on the site is already in Stock, Customers and Money.',
    },
  ],
  areas: {
    website: { offer: 'built-in', note: 'Zoho Sites.' },
    store: { offer: 'built-in', note: 'Zoho Commerce.' },
    'in-person': { offer: 'unconfirmed', note: 'Not found on the Zoho One page.' },
    bookings: { offer: 'built-in', note: 'Zoho Bookings.' },
    invoices: { offer: 'built-in', note: 'Zoho Invoice and Zoho Books.' },
    customers: { offer: 'built-in', note: 'Zoho CRM and Bigin.' },
    'help-desk': { offer: 'built-in', note: 'Zoho Desk.' },
    email: { offer: 'built-in', note: 'Zoho Campaigns.' },
    texts: { offer: 'unconfirmed', note: 'Not found on the Zoho One page.' },
    social: { offer: 'built-in', note: 'Zoho Social.' },
    stock: { offer: 'built-in', note: 'Zoho Inventory.' },
    'purchase-orders': { offer: 'built-in', note: 'Zoho Inventory.' },
    team: { offer: 'built-in', note: 'Zoho People.' },
    payroll: { offer: 'partly', note: 'Zoho Payroll, in some countries only.' },
    automations: { offer: 'unconfirmed', note: 'Not confirmed on the Zoho One page.' },
    ai: { offer: 'unconfirmed', note: 'Not confirmed on the Zoho One page.' },
    accounting: { offer: 'built-in', note: 'Zoho Books.' },
  },
  billShape: [
    'Priced per employee.',
    'You license every employee in the business, not only the ones who sign in.',
    'Payroll is included only in some countries.',
    'Each app is set up separately, even though they share one sign-in.',
  ],
  moving: {
    body: 'Move in has no Zoho-specific reader, so this is the spreadsheet route. Export customers, products or orders from each Zoho app as a spreadsheet and drop it into “Move in from somewhere else”. Piggles guesses what each column means, lets you correct it, and counts the rows that will import before anything is written.',
    comesAcross: [
      'Customers and companies, from a spreadsheet',
      'Products and stock counts, from a spreadsheet',
      'Past orders, from a spreadsheet',
    ],
    staysBehind: [
      'Your accounting: keep Zoho Books or move to another accounting tool with your accountant',
      'Payroll and HR records: Piggles does not keep them',
      'Anything in Projects, Desk or the other apps you do not export',
    ],
  },
  pickThem: [
    'You want accounting, payroll and HR from the same company as everything else.',
    'You have several departments, each needing its own specialist app.',
    'You have someone with time to set up and join together many apps.',
  ],
  pickUs: [
    'You are a small business and want to be working the same day, not configuring.',
    'You want every app to share one customer record without setting that up.',
    'You would rather not pay for every employee, only for the people who sign in.',
    'You already have an accountant with their own software.',
  ],
  questions: [
    {
      q: 'Is Piggles a good Zoho One alternative?',
      a: 'For a small business that wants its site, shop, bookings, customers and stock working together from day one, yes. For a business that wants accounting, payroll and HR from the same company, Zoho One covers more.',
    },
    {
      q: 'Does Piggles do accounting like Zoho Books?',
      a: 'No. Money shows what came in, what went out and what you kept, by job and by where you sold. It is not a ledger, it does not prepare tax returns and it does not match bank lines, so keep your accountant’s own software for that.',
    },
    {
      q: 'Can I move from Zoho to Piggles?',
      a: 'Yes, by spreadsheet. Export customers, products and orders from each Zoho app, and Move in maps the columns with you before anything is written.',
    },
    {
      q: 'Do I pay for every employee?',
      a: 'No. Three people who sign in are included, and each one after that is a small fixed extra.',
    },
  ],
  sources: [
    { label: 'Zoho One', href: 'https://www.zoho.com/one/' },
    {
      label: 'Zoho Community: payroll in Zoho One',
      href: 'https://help.zoho.com/portal/en/community/topic/zoho-payrolls-usa-and-ksa-editions-are-available-in-zoho-one',
    },
    {
      label: 'Zoho CRM Help: exporting data',
      href: 'https://help.zoho.com/portal/en/kb/crm/data-administration/export-data/articles/export-crm-data',
    },
  ],
  leans: ['customers', 'site', 'sell', 'money'],
};
