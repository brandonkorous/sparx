import type { ComparePage } from './types';

// Facts about HubSpot: piggles/docs/marketing/COMPETITORS-2026-09-30.md §HubSpot.

export const HUBSPOT: ComparePage = {
  slug: 'hubspot',
  name: 'HubSpot',
  isA: 'a customer-relationship platform for marketing, sales and service teams',
  heading: 'Piggles or HubSpot: a sales machine, or the whole small business?',
  lede: 'HubSpot is one of the deepest customer-relationship tools there is, and for a team that lives in its pipeline and its marketing, it earns its reputation. Piggles is for the business that also has a shop, a calendar, stock and a team to pay. Here is the honest comparison.',
  searchTerms: [
    'Piggles vs HubSpot',
    'HubSpot alternative',
    'HubSpot alternative for small business',
    'CRM with invoicing and booking',
    'HubSpot Starter alternative',
  ],
  theyWin: [
    {
      title: 'Depth in sales and marketing',
      body: 'Lead scoring, sequences, reporting, attribution and years of refinement for teams whose job is the pipeline. Piggles has a pipeline, lead scoring and email lists, but HubSpot goes much further for a dedicated sales or marketing team.',
    },
    {
      title: 'A free place to start',
      body: 'HubSpot’s free tools cover a small team’s customer list, forms and email at no cost. Piggles has a free trial, not a free plan.',
    },
    {
      title: 'Text messages',
      body: 'HubSpot can send text messages from the same place as its email. Piggles does not send text messages.',
    },
  ],
  turn: 'HubSpot is built around winning the customer. Piggles is built around serving them once they have said yes.',
  weWin: [
    {
      title: 'Selling, with no extra hub',
      body: 'An online shop, counter sales, stock, suppliers and trade accounts are part of Piggles. HubSpot does not list an online store or stock control.',
    },
    {
      title: 'Appointments, not just meeting links',
      body: 'Bookings handles services, staff calendars, reminders, moving and canceling, and no-shows. HubSpot books meetings through links, which suits a sales call more than a haircut.',
    },
    {
      title: 'A price that does not count seats',
      body: 'HubSpot’s paid tools are priced per seat. Piggles includes three team members in one flat price, and each person after that is a small, fixed extra.',
    },
    {
      title: 'Quotes and invoices included',
      body: 'On HubSpot, full quotes and invoices come with a separate subscription. In Piggles, quotes that become jobs and then invoices are one of the apps in the price.',
    },
  ],
  areas: {
    website: { offer: 'built-in', note: 'Website, landing pages and blog, in Content Hub.' },
    store: { offer: 'unconfirmed', note: 'Not found on its product pages.' },
    'in-person': { offer: 'unconfirmed', note: 'Not found on its product pages.' },
    bookings: { offer: 'partly', note: 'Meeting links for booking calls.' },
    invoices: { offer: 'add-on', note: 'Full quotes and invoices come with Revenue Hub.' },
    customers: { offer: 'built-in', note: 'Its core product, the Smart CRM.' },
    'help-desk': { offer: 'built-in', note: 'Tickets and a shared inbox.' },
    email: { offer: 'built-in', note: 'Email marketing and sequences.' },
    texts: { offer: 'built-in', note: 'Text messages.' },
    social: { offer: 'built-in', note: 'Social posting.' },
    stock: { offer: 'unconfirmed', note: 'Not found on its product pages.' },
    'purchase-orders': { offer: 'unconfirmed', note: 'Not found on its product pages.' },
    team: { offer: 'unconfirmed', note: 'Not found on its product pages.' },
    payroll: { offer: 'unconfirmed', note: 'Not found on its product pages.' },
    automations: { offer: 'built-in', note: 'Workflows.' },
    ai: { offer: 'built-in', note: 'Its Breeze assistant.' },
    accounting: { offer: 'unconfirmed', note: 'Not found on its product pages.' },
  },
  billShape: [
    'Free tools for up to two users.',
    'Paid tools are priced per seat. View-only seats are free.',
    'Tools are grouped into Hubs, and each Hub has its own tiers.',
    'Full quotes and invoicing come with Revenue Hub, its own subscription.',
  ],
  moving: {
    body: 'HubSpot’s exports and Piggles’ Move in understand each other well. Drop in HubSpot’s own export files, or paste one read-only key and Piggles reads your account for you. You see what will happen to every row before anything is written.',
    comesAcross: [
      'Contacts, with their notes, and anyone marked as a non-marketing contact kept off your mailing lists',
      'Companies, with their address, website and phone',
      'Deals, with their stage and value',
      'Tickets, as customer requests',
    ],
    staysBehind: [
      'The dates and status of old tickets: they arrive as open requests, so close the finished ones',
      'Workflows and sequences: build the ones you still need as Automations',
      'Your HubSpot website pages: rebuild them from Piggles sections',
    ],
  },
  pickThem: [
    'You have a sales or marketing team whose whole job is the pipeline.',
    'You need advanced marketing reporting, attribution or sequences.',
    'Text messages to customers are part of how you sell.',
  ],
  pickUs: [
    'You sell products or services as well as winning customers.',
    'You take appointments, carry stock or schedule a team.',
    'You want quotes and invoices without buying another subscription.',
    'You want one flat price rather than one per person.',
  ],
  questions: [
    {
      q: 'Is Piggles a good HubSpot alternative?',
      a: 'For a small business that needs a customer list plus a shop, bookings, invoices and a team, yes. For a business with a dedicated sales or marketing team, HubSpot’s depth is hard to match.',
    },
    {
      q: 'Can I bring my HubSpot contacts, companies and deals?',
      a: 'Yes. Contacts, companies, deals and tickets come across from HubSpot’s exports or through a read-only key. Old tickets arrive as open requests without their original dates, so close the finished ones after the move.',
    },
    {
      q: 'Does Piggles have a sales pipeline?',
      a: 'Yes. Customers includes deals in stages, lead scoring you can adjust, and requests with an owner and a time to answer by. It is built for a small business rather than a sales floor.',
    },
    {
      q: 'Is there a free plan?',
      a: 'No. There is a fourteen-day free trial with no card, then one monthly price with every app included.',
    },
  ],
  sources: [
    {
      label: 'HubSpot: Starter Customer Platform',
      href: 'https://www.hubspot.com/products/crm/starter',
    },
    {
      label: 'HubSpot Knowledge Base: seats',
      href: 'https://knowledge.hubspot.com/account-management/manage-seats',
    },
    { label: 'HubSpot: quotes', href: 'https://www.hubspot.com/products/revenue/quotes' },
    {
      label: 'HubSpot Knowledge Base: exporting records',
      href: 'https://knowledge.hubspot.com/import-and-export/export-records',
    },
  ],
  leans: ['customers', 'sell', 'bookings', 'invoices'],
};
