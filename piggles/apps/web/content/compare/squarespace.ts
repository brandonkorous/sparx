import type { ComparePage } from './types';

// Facts about Squarespace: piggles/docs/marketing/COMPETITORS-2026-09-30.md §Squarespace.

export const SQUARESPACE: ComparePage = {
  slug: 'squarespace',
  name: 'Squarespace',
  isA: 'a design-led website builder for creative and service businesses',
  heading: 'Piggles or Squarespace: a beautiful site, or the business behind it?',
  lede: 'Squarespace makes some of the most polished websites a small business can get, and for a portfolio or a studio that often matters most. Piggles puts the site beside the bookings, email, stock, team and customers, on one bill, with nothing sold separately. Here is the fair comparison.',
  searchTerms: [
    'Piggles vs Squarespace',
    'Squarespace alternative',
    'Squarespace alternative with booking',
    'Acuity alternative',
    'Squarespace alternative for small business',
  ],
  theyWin: [
    {
      title: 'Design polish',
      body: 'Squarespace templates are known for looking good out of the box, and its design tools can build a whole site from a few answers. If the site is your shop window and your portfolio, that polish is worth a lot.',
    },
    {
      title: 'Members and paid content',
      body: 'Squarespace has member areas and paid digital content built in. Piggles does not sell memberships or gate content behind a login.',
    },
    {
      title: 'A well-known scheduling tool',
      body: 'Acuity, the scheduling product Squarespace owns, is widely used and has deep options. It is sold separately from the website.',
    },
  ],
  turn: 'Squarespace sells a website, and then sells scheduling and email next to it. Piggles is one product where those were never separate.',
  weWin: [
    {
      title: 'Bookings and email are not extra products',
      body: 'On Squarespace, scheduling and email campaigns are separate products with their own billing. In Piggles, Bookings and Messages are included, and they share one customer list with your orders.',
    },
    {
      title: 'Stock in more than one place',
      body: 'Counts per location, transfers between them, reorder points and orders to suppliers. For a business that makes or buys what it sells, that is the part a website builder does not reach.',
    },
    {
      title: 'Your team',
      body: 'Clock-ins, timesheets you approve, a published schedule, time off, and licenses that warn you before they lapse. Squarespace does not list staff scheduling.',
    },
    {
      title: 'No fee on your sales',
      body: 'Squarespace’s entry plan charges a transaction fee on online sales, and every plan charges one on digital content. Piggles adds no fee to any sale.',
    },
  ],
  areas: {
    website: { offer: 'built-in', note: 'Templates known for their design.' },
    store: { offer: 'built-in', note: 'Online store. A sales fee applies on the entry plan.' },
    'in-person': {
      offer: 'partly',
      note: 'Through its app, in the US only, with a Square account and reader.',
    },
    bookings: { offer: 'add-on', note: 'Acuity Scheduling, a separate product.' },
    invoices: { offer: 'built-in', note: 'Invoices and proposals.' },
    customers: { offer: 'built-in', note: 'Contacts and customer lists.' },
    'help-desk': { offer: 'no', note: 'Not on its feature list.' },
    email: { offer: 'add-on', note: 'Email Campaigns, billed separately.' },
    texts: { offer: 'partly', note: 'Appointment reminders through Acuity.' },
    social: { offer: 'unconfirmed', note: 'Not found on its feature list.' },
    stock: { offer: 'partly', note: 'One stock count. More locations not confirmed.' },
    'purchase-orders': { offer: 'no', note: 'Not on its feature list.' },
    team: { offer: 'no', note: 'Not on its feature list.' },
    payroll: { offer: 'no', note: 'Not on its feature list.' },
    automations: { offer: 'built-in', note: 'Automations are listed.' },
    ai: { offer: 'built-in', note: 'AI site and content tools.' },
    accounting: { offer: 'other-app', note: 'Through finance extensions from other companies.' },
  },
  billShape: [
    'Several plans. The entry plan charges a transaction fee on online sales.',
    'Every plan charges a transaction fee on digital content and memberships.',
    'Acuity Scheduling and Email Campaigns are separate products, each with its own billing.',
    'Selling in person needs a Square account and reader.',
  ],
  moving: {
    body: 'Squarespace lets you export your products, orders and contacts, and your pages and blog posts as a WordPress-style file. Drop them into “Move in from somewhere else” and Piggles shows what will happen to every row before anything is written.',
    comesAcross: [
      'Products with their images',
      'Past orders',
      'Contacts, with email subscription status kept as it was',
      'Pages and blog posts, from Squarespace’s WordPress export file',
    ],
    staysBehind: [
      'Your template design: you set the look again with Piggles sections, colors and fonts',
      'Acuity bookings: add upcoming ones by hand, or run both for a week',
      'Member areas and paid content: Piggles does not offer these',
    ],
  },
  pickThem: [
    'The site is the business: a portfolio, a studio, a gallery.',
    'You sell memberships or paid content behind a login.',
    'You are happy paying for scheduling and email as separate products.',
  ],
  pickUs: [
    'You want bookings, email and the website included in one price.',
    'You carry stock, buy from suppliers or have a team to schedule.',
    'You want quotes, invoices and customer requests alongside the site.',
    'You want no fee taken from your sales.',
  ],
  questions: [
    {
      q: 'Is Piggles a good Squarespace alternative?',
      a: 'If you have been adding Acuity and Email Campaigns to your Squarespace site, Piggles puts both of those, plus stock, a team and invoices, into one price. If design polish is the whole point and the rest is small, Squarespace is still a very good choice.',
    },
    {
      q: 'Will my Squarespace blog come across?',
      a: 'Yes. Export your site from Squarespace as a WordPress file and Move in reads your pages and blog posts from it. Your design does not come across; you set the look again with Piggles sections, colors and fonts.',
    },
    {
      q: 'Can I replace Acuity with Piggles?',
      a: 'For most service businesses, yes. Bookings covers services, staff calendars, email reminders, online booking, and moving or canceling from a link in the confirmation. It does not send text reminders.',
    },
    {
      q: 'Does Piggles take a fee on sales?',
      a: 'No. Piggles adds no fee to a sale. The payment company you connect charges its own card fee.',
    },
  ],
  sources: [
    { label: 'Squarespace: pricing', href: 'https://www.squarespace.com/pricing' },
    { label: 'Squarespace: feature index', href: 'https://www.squarespace.com/feature-index' },
    {
      label: 'Squarespace Help: Email Campaigns billing',
      href: 'https://support.squarespace.com/hc/en-us/articles/360002123507-Email-Campaigns-pricing-billing-and-invoices',
    },
    {
      label: 'Squarespace Help: selling in person',
      href: 'https://support.squarespace.com/hc/en-us/articles/360035711431-Selling-in-person-with-Squarespace',
    },
    {
      label: 'Squarespace Help: exporting orders',
      href: 'https://support.squarespace.com/hc/en-us/articles/206540677-Export-Commerce-orders',
    },
  ],
  leans: ['bookings', 'messages', 'stock', 'site'],
};
