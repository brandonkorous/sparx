import type { ComparePage } from './types';

// Facts about Shopify: piggles/docs/marketing/COMPETITORS-2026-09-30.md §Shopify.

export const SHOPIFY: ComparePage = {
  slug: 'shopify',
  name: 'Shopify',
  isA: 'an online-store platform for businesses that sell products first',
  heading: 'Piggles or Shopify: a shop, or the whole business?',
  lede: 'Shopify is the strongest name in selling products online, and if your business is a shop that wants to be everywhere, it is hard to beat. Piggles is for the business that sells and also books, quotes, invoices and answers customers. Here is where each one is the better choice.',
  searchTerms: [
    'Piggles vs Shopify',
    'Shopify alternative',
    'Shopify alternative for service business',
    'Shopify alternative with bookings',
    'Shopify without apps',
  ],
  theyWin: [
    {
      title: 'Selling in many places at once',
      body: 'Shopify connects your catalog to marketplaces, social shops and even AI chat assistants. Piggles sells on your own site, over the counter and on trade accounts, and does not list your products on marketplaces.',
    },
    {
      title: 'The biggest app store in the business',
      body: 'If you can describe a feature, somebody has probably built a Shopify app for it. Piggles has no app store: what it does is what is in the box.',
    },
    {
      title: 'Checkout and shipping at scale',
      body: 'Shopify’s checkout is used by a huge number of stores, and it comes with shipping labels and a deep set of sales reports. For a store shipping hundreds of parcels a day, that maturity counts.',
    },
    {
      title: 'A till with its own hardware',
      body: 'Shopify sells its own card readers for selling in person, with a more advanced till as a paid add-on. Piggles has no card reader.',
    },
  ],
  turn: 'Shopify is built around a product being bought. Piggles is built around a customer being looked after, whether they buy a product, book a time or ask for a quote.',
  weWin: [
    {
      title: 'Bookings without an extra app',
      body: 'On Shopify, appointments come from another company’s app, with its own account and its own bill. In Piggles, Bookings is included, and a booking sits on the same customer record as their orders.',
    },
    {
      title: 'Quotes, jobs and invoices',
      body: 'Work that starts as a price somebody has to agree to, becomes a job, and then becomes a bill. Piggles keeps each step, numbered the way you choose, with a payment link on the invoice.',
    },
    {
      title: 'No fee for choosing your own payment company',
      body: 'Shopify charges a transaction fee on every plan unless you use Shopify Payments. Piggles adds no fee to a sale, whichever of the payment companies you connect.',
    },
    {
      title: 'The people side of the business',
      body: 'Staff clock in and out, a schedule you publish, customer requests with an owner and a deadline, and live chat. Each of these is its own app, included in the one price.',
    },
  ],
  areas: {
    website: { offer: 'built-in', note: 'Themes and an online store editor.' },
    store: { offer: 'built-in', note: 'Its core product.' },
    'in-person': { offer: 'built-in', note: 'Shopify POS. The advanced version is a paid add-on.' },
    bookings: { offer: 'other-app', note: 'From apps in the Shopify App Store.' },
    invoices: { offer: 'partly', note: 'Invoices from draft orders.' },
    customers: { offer: 'built-in', note: 'A customer list.' },
    'help-desk': { offer: 'partly', note: 'A chat inbox. Ticketing comes from other apps.' },
    email: { offer: 'built-in', note: 'Shopify Messaging, billed past a free allowance.' },
    texts: { offer: 'built-in', note: 'Shopify Messaging, billed past a free allowance.' },
    social: { offer: 'unconfirmed', note: 'Posting is usually done through other apps.' },
    stock: { offer: 'built-in', note: 'Across locations, capped by plan.' },
    'purchase-orders': { offer: 'built-in', note: 'Purchase orders and transfers.' },
    team: {
      offer: 'other-app',
      note: 'Staff accounts by plan. Shifts and time clocks come from apps.',
    },
    payroll: { offer: 'other-app', note: 'From other apps.' },
    automations: { offer: 'built-in', note: 'Shopify Flow.' },
    ai: { offer: 'built-in', note: 'Sidekick.' },
    accounting: { offer: 'other-app', note: 'From other apps.' },
  },
  billShape: [
    'Four plans, each with its own limits on staff accounts and reports.',
    'A transaction fee on every sale unless you use Shopify Payments.',
    'Apps from the App Store are usually billed separately by the company that makes them.',
    'The advanced till is a paid add-on, and card readers are bought separately.',
    'Emails and texts past the monthly allowance are billed by use.',
  ],
  moving: {
    body: 'Shopify is the platform Move in knows best. Drop in Shopify’s own export files, or paste one read-only key and Piggles reads your store for you. You see what will happen to every row before anything is written, and nothing about the key is kept afterward.',
    comesAcross: [
      'Products with their options, variants and images',
      'Stock for each of your locations',
      'Customers, with notes and email consent kept as they were',
      'Past orders',
      'Discount codes',
      'URL redirects, so old links still land somewhere',
      'Collections, pages and blog posts, through the read-only key',
    ],
    staysBehind: [
      'Your theme: you rebuild the look from ready-made Piggles sections',
      'Shopify apps and what they stored: each one has its own export, if it has one',
      'Gift card balances: note them before you switch and issue them again',
    ],
  },
  pickThem: [
    'You sell products only, and want to sell them on marketplaces and social shops too.',
    'You rely on a specific Shopify app that does something no one else does.',
    'You ship at a volume where checkout and shipping tools are the whole job.',
  ],
  pickUs: [
    'You sell products and also book appointments, quote jobs or send invoices.',
    'You are tired of paying separate apps for bookings, reviews, forms and staff hours.',
    'You want to use the payment company you choose without a fee for choosing it.',
    'You want one price that covers every part of the business.',
  ],
  questions: [
    {
      q: 'Is Piggles a good Shopify alternative?',
      a: 'For a business that sells and also books, quotes or invoices, yes, because those are included rather than added as apps. For a store that needs marketplaces, a large app store or high-volume shipping tools, Shopify is still the better choice.',
    },
    {
      q: 'Can I bring my Shopify store over?',
      a: 'Yes. Products, variants, images, stock, customers, past orders, discount codes and redirects come across from Shopify’s own exports. With a read-only key, collections, pages and blog posts come too. Your theme does not: you rebuild the look from ready-made sections.',
    },
    {
      q: 'Does Piggles sell on Amazon, eBay or Etsy?',
      a: 'No. Piggles sells on your own website, over the counter and on trade accounts. If marketplaces bring in a large share of your sales, Shopify is the better fit today.',
    },
    {
      q: 'Does Piggles charge a transaction fee?',
      a: 'No. Piggles adds nothing to a sale. The payment company you connect (Stripe, PayPal, Square, Authorize.net or 1stPayGateway) charges its own card fee.',
    },
    {
      q: 'Do I need apps to take bookings in Piggles?',
      a: 'No. Bookings is one of the apps included in the price, with services, staff calendars, email reminders and booking online.',
    },
  ],
  sources: [
    { label: 'Shopify: pricing and plans', href: 'https://www.shopify.com/pricing' },
    {
      label: 'Shopify App Store: appointment booking apps',
      href: 'https://apps.shopify.com/collections/appointment-booking-apps',
    },
    {
      label: 'Shopify Help: purchase orders',
      href: 'https://help.shopify.com/en/manual/products/inventory/purchase-orders',
    },
    {
      label: 'Shopify Help: Shopify Messaging',
      href: 'https://help.shopify.com/en/manual/promoting-marketing/create-marketing/shopify-messaging',
    },
    {
      label: 'Shopify Help: CSV files',
      href: 'https://help.shopify.com/en/manual/shopify-admin/productivity-tools/csv-files',
    },
  ],
  leans: ['sell', 'bookings', 'invoices', 'team'],
};
