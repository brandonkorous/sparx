import type { ComparePage } from './types';

// Facts about Square: piggles/docs/marketing/COMPETITORS-2026-09-30.md §Square.

export const SQUARE: ComparePage = {
  slug: 'square',
  name: 'Square',
  isA: 'a payments and point-of-sale company built around its own card readers',
  heading: 'Piggles or Square: which one fits the way you work?',
  lede: 'Square is the best-known name in taking a card over the counter, and for a lot of shops that is the right place to start. Piggles is built for the rest of the week: the website, the bookings, the quotes, the stock and the customers, on one bill. Here is the honest version of which to choose.',
  searchTerms: [
    'Piggles vs Square',
    'Square alternative',
    'Square alternative for small business',
    'Square Appointments alternative',
    'Square Online alternative',
  ],
  theyWin: [
    {
      title: 'Taking a card in person',
      body: 'Square makes its own card readers, terminals and stands, and tap to pay on a phone. If most of your money arrives across a counter, nothing on this page beats that. Piggles has no card reader of its own.',
    },
    {
      title: 'Restaurants and busy tills',
      body: 'Kitchen screens, kiosks, table service and a till built for a queue. Square has spent years on the counter itself, and it shows.',
    },
    {
      title: 'Banking beside the payments',
      body: 'Square offers business checking, savings and loans next to the money it takes for you. Piggles does not hold or lend money.',
    },
    {
      title: 'Payroll, if you pay it',
      body: 'Square sells payroll as its own paid product. Piggles records hours and hands them to whoever runs your payroll, and stops there.',
    },
  ],
  turn: 'Square is built around the moment somebody pays. Piggles is built around everything that happens before and after it.',
  weWin: [
    {
      title: 'The work that is not a sale',
      body: 'A quote that turns into a job and then an invoice, a request that needs an answer by Friday, a supplier order waiting to arrive. Piggles keeps each of these as its own record, attached to the customer it belongs to.',
    },
    {
      title: 'A website that is a real website',
      body: 'Pages, a blog, forms that land somewhere useful, search settings and social posting, not only a page to order from. It is on your own domain and it is part of the same bill.',
    },
    {
      title: 'One price that does not grow with the till',
      body: 'Every app is included in one monthly price. Adding a location or a team member costs extra; switching on bookings, email or stock never does.',
    },
    {
      title: 'Your choice of who takes the payment',
      body: 'Connect Stripe, PayPal, Square, Authorize.net or 1stPayGateway. Piggles adds no fee of its own to a sale, so you can move to a cheaper payment company without moving your business.',
    },
  ],
  areas: {
    website: { offer: 'built-in', note: 'Square Online.' },
    store: { offer: 'built-in', note: 'Square Online.' },
    'in-person': { offer: 'built-in', note: 'Its own card readers and tills, sold separately.' },
    bookings: { offer: 'built-in', note: 'In the plans, and still sold as Square Appointments.' },
    invoices: { offer: 'built-in', note: 'Invoices and estimates.' },
    customers: { offer: 'built-in', note: 'A customer directory.' },
    'help-desk': { offer: 'unconfirmed', note: 'Not listed on its software page.' },
    email: { offer: 'built-in', note: 'Email marketing.' },
    texts: { offer: 'built-in', note: 'Text marketing, billed per text past an allowance.' },
    social: { offer: 'unconfirmed', note: 'Not listed on its software page.' },
    stock: { offer: 'built-in', note: 'Across locations, in Square for Retail.' },
    'purchase-orders': {
      offer: 'built-in',
      note: 'Vendors and purchase orders, in Square for Retail.',
    },
    team: { offer: 'built-in', note: 'Shifts and timecards.' },
    payroll: { offer: 'add-on', note: 'Square Payroll is a separate paid product.' },
    automations: { offer: 'partly', note: 'Its assistant automates some routine tasks.' },
    ai: { offer: 'built-in', note: 'Square AI and its manager assistant.' },
    accounting: {
      offer: 'other-app',
      note: 'Connects to accounting software from other companies.',
    },
  },
  billShape: [
    'Plans are priced per location.',
    'Card readers, terminals and stands are bought separately.',
    'Payroll is its own paid product.',
    'Some devices, such as kitchen screens and kiosks, carry their own monthly fee.',
    'Payments go through Square, at Square’s card rates.',
  ],
  moving: {
    body: 'Square lets you download your item library and your customer directory. Drop those files into “Move in from somewhere else” in your Piggles console. It recognizes Square’s files, shows you what will happen to every row, and only then writes anything.',
    comesAcross: [
      'Your item library: names, prices, variations and codes',
      'Stock counts for each of your locations',
      'Your customer directory, with notes and email consent kept as they were',
    ],
    staysBehind: [
      'Past sales: Square’s item and customer files do not carry them',
      'Your card reader: it keeps working with Square, and you can keep Square as the way you take payment',
      'Appointments already booked: add upcoming ones by hand, or run both for a week',
    ],
  },
  pickThem: [
    'Most of your money comes over a counter, from a queue, on a card.',
    'You run a restaurant, café or bar and need kitchen screens or table service.',
    'You want payroll and banking from the same company that takes your payments.',
  ],
  pickUs: [
    'You quote, book or invoice more than you ring things up.',
    'You want the website, bookings, stock and customers in one place and one price.',
    'You want to choose, and change, who takes your payments.',
    'Selling in person is a few sales a week you are happy to record by hand, or through a Square reader you keep.',
  ],
  questions: [
    {
      q: 'Can I keep my Square card reader and use Piggles?',
      a: 'Yes. Square is one of the payment companies Piggles connects to, for payments online and on invoices. Your reader keeps working with Square for in-person sales. Piggles does not read those sales back automatically, so a counter sale you want in your Piggles figures is recorded as an order.',
    },
    {
      q: 'Is Piggles a good Square alternative?',
      a: 'For a business that books, quotes, invoices and sells online, yes: it covers the website, bookings, customers, stock, email and invoices on one bill. For a business that lives on a busy till, no. Piggles has no card reader, and Square’s is very good.',
    },
    {
      q: 'Does Piggles take a cut of my sales?',
      a: 'No. Piggles adds no fee to a sale. The payment company you connect charges its own card fee, the same as it would anywhere.',
    },
    {
      q: 'Does Piggles do payroll like Square does?',
      a: 'No. My Team records clock-ins, timesheets and time off, and a period’s approved hours download as a file for whoever runs your payroll. The approved hours also arrive in Money as wages.',
    },
    {
      q: 'Will my customers notice the move?',
      a: 'Only if you want them to. Your customer list comes across with each person’s email consent as it was, so nobody is subscribed to anything they had not agreed to.',
    },
  ],
  sources: [
    {
      label: 'Square: the new subscription plans',
      href: 'https://squareup.com/help/us/en/article/8569-switch-to-the-new-square-subscription-plans',
    },
    { label: 'Square: software', href: 'https://squareup.com/us/en/software' },
    {
      label: 'Square: purchase orders in Square for Retail',
      href: 'https://squareup.com/help/us/en/article/8258-create-purchase-orders-with-square-for-retail',
    },
    { label: 'Square: pricing', href: 'https://squareup.com/us/en/pricing' },
  ],
  leans: ['sell', 'bookings', 'invoices', 'site'],
};
