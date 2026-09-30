import type { ComparePage } from './types';

// Facts about Wix: piggles/docs/marketing/COMPETITORS-2026-09-30.md §Wix.

export const WIX: ComparePage = {
  slug: 'wix',
  name: 'Wix',
  isA: 'a drag-and-drop website builder with business apps added on top',
  heading: 'Piggles or Wix: a website with extras, or a business with a website?',
  lede: 'Wix gives you more design freedom than almost anything else, and a huge market of add-ons. Piggles starts from the other end: the bookings, quotes, stock, team and customers a business runs on, with the website as one part of it. Here is how to choose.',
  searchTerms: [
    'Piggles vs Wix',
    'Wix alternative',
    'Wix alternative for small business',
    'Wix Bookings alternative',
    'website builder with inventory and invoicing',
  ],
  theyWin: [
    {
      title: 'Total design freedom',
      body: 'Wix lets you drag anything anywhere on the page, from a very large library of templates. Piggles gives you finished sections to arrange and fill in. That is quicker and harder to break, but it is not a blank canvas.',
    },
    {
      title: 'An app market for almost anything',
      body: 'Hundreds of apps plug into a Wix site. Piggles has no app market, so if a feature is not one of its apps, you will not find it.',
    },
    {
      title: 'Text messages and a till',
      body: 'Wix can send text messages through its automations, and it has a till with hardware in the US, Canada and the UK. Piggles sends no text messages and has no card reader.',
    },
    {
      title: 'Several AI helpers',
      body: 'Wix has AI agents that build pages, answer visitors and write marketing. Piggles runs no AI of its own; you connect your own AI account if you want one.',
    },
  ],
  turn: 'Wix started as a website and grew a business around it. Piggles started as the business and gives it a website.',
  weWin: [
    {
      title: 'Stock and suppliers, properly',
      body: 'Counts per location, reorder points worked out from what really sells, barcode scanning, transfers, and orders to suppliers that are written, approved and received. That is a whole app in Piggles, not a setting on a product.',
    },
    {
      title: 'Your team’s hours',
      body: 'People clock in and out, you approve timesheets, publish a schedule and track time off and licenses. Approved hours reach Money as wages.',
    },
    {
      title: 'One price, no tiers',
      body: 'Wix decides what your store and marketing can do by which plan you are on. Piggles has one plan with every app in it, and the bill only moves when you add room: a location, a team member, storage.',
    },
    {
      title: 'Requests that cannot get lost',
      body: 'A customer request has an owner and a time it is expected to be answered by, beside that customer’s orders and bookings. Nothing ages quietly in an inbox.',
    },
  ],
  areas: {
    website: { offer: 'built-in', note: 'Drag-and-drop editor and templates.' },
    store: { offer: 'built-in', note: 'Store features depend on the plan.' },
    'in-person': { offer: 'built-in', note: 'Wix POS, in the US, Canada and the UK.' },
    bookings: { offer: 'built-in', note: 'Wix Bookings, with staff calendars.' },
    invoices: { offer: 'built-in', note: 'Invoices and price quotes.' },
    customers: { offer: 'built-in', note: 'Contacts and a lead pipeline.' },
    'help-desk': { offer: 'partly', note: 'An inbox and live chat. Ticketing not confirmed.' },
    email: { offer: 'built-in', note: 'Email marketing, with more on higher plans.' },
    texts: { offer: 'partly', note: 'Through automations only.' },
    social: { offer: 'built-in', note: 'Social post scheduling.' },
    stock: { offer: 'built-in', note: 'Across locations, on the newer catalog.' },
    'purchase-orders': { offer: 'unconfirmed', note: 'Not found on its help pages.' },
    team: { offer: 'partly', note: 'Staff roles and booking calendars. Time clock not confirmed.' },
    payroll: { offer: 'unconfirmed', note: 'Not found on its help pages.' },
    automations: { offer: 'built-in', note: 'Wix Automations.' },
    ai: { offer: 'built-in', note: 'Several AI agents.' },
    accounting: { offer: 'unconfirmed', note: 'Not found on its help pages.' },
  },
  billShape: [
    'Several plans, and the plan decides which store and marketing features you get.',
    'The number of people who can work on the site is capped by plan.',
    'Apps from the Wix App Market can carry their own charges.',
    'Card readers and till hardware are bought separately.',
  ],
  moving: {
    body: 'Wix lets you download your products, contacts and orders as spreadsheets. Drop them into “Move in from somewhere else” in your console. Piggles recognizes Wix’s files and shows what will happen to every row before anything is written.',
    comesAcross: [
      'Products with their options and images',
      'Contacts, with email subscription status kept as it was',
      'Past orders',
    ],
    staysBehind: [
      'Your pages and blog posts: Move in does not read them from Wix, so you rebuild pages from Piggles sections and copy posts across',
      'Your design: Wix templates do not carry over',
      'Bookings already made: add upcoming ones by hand, or run both for a week',
    ],
  },
  pickThem: [
    'The look of your site matters more than anything else, and you want to place every pixel.',
    'You need a specific app from the Wix App Market.',
    'You want text messages or a Wix till in the same place as your site.',
  ],
  pickUs: [
    'You carry stock, buy from suppliers, or have people whose hours you track.',
    'You would rather arrange finished sections than design a page from scratch.',
    'You want one plan with everything in it rather than choosing a tier.',
    'You want quotes, invoices, bookings and customer requests to share one customer record.',
  ],
  questions: [
    {
      q: 'Is Piggles a good Wix alternative?',
      a: 'If your website is one part of a business with stock, a team, bookings and invoices, yes. If the website itself is the product and total design freedom is the point, Wix is the better tool.',
    },
    {
      q: 'Can I move my Wix website to Piggles?',
      a: 'Your products, contacts and past orders come across from Wix’s own exports. Your pages and blog posts do not: Move in does not read them from Wix. You rebuild pages from Piggles’ ready-made sections and copy your posts across.',
    },
    {
      q: 'Can I use my own domain?',
      a: 'Yes. Your site runs on your own domain with its security certificate included. Until then it has a free Piggles address.',
    },
    {
      q: 'Does Piggles have templates?',
      a: 'It has finished sections: headers, galleries, price lists, contact forms, product grids and more. You arrange and fill them in, and the preview is the real page.',
    },
    {
      q: 'Does Piggles send text messages?',
      a: 'No. Messages sends email and runs live chat on your site. If text reminders are essential to you, that is a real gap to weigh.',
    },
  ],
  sources: [
    { label: 'Wix: business software', href: 'https://www.wix.com/business-software' },
    { label: 'Wix: plans', href: 'https://www.wix.com/plans' },
    {
      label: 'Wix Help: invoices and price quotes',
      href: 'https://support.wix.com/en/ascend-by-wix/wix-invoices-price-quotes',
    },
    {
      label: 'Wix Help: Wix POS',
      href: 'https://support.wix.com/en/article/wix-pos-register-about-wix-pos-for-your-brick-and-mortar-business',
    },
    {
      label: 'Wix Help: exporting contacts',
      href: 'https://support.wix.com/en/article/exporting-your-contacts',
    },
  ],
  leans: ['stock', 'team', 'site', 'customers'],
};
