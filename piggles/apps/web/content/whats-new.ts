import type { PigglesAppId } from '@piggles/config';

// /whats-new: what changed in Piggles, newest first, in the owner's words.
//
// Every entry is a change that is in the product, traced to its commit. It is
// written from what the change does for somebody running a business, never from
// the commit message, and never a thing that is planned. A changelog with a
// "coming soon" in it is a roadmap wearing a changelog's clothes.
//
// Add the entry in the same change that ships the thing, not before.

export interface Change {
  /** ISO date the change shipped. */
  date: string;
  app: PigglesAppId;
  title: string;
  body: string;
}

export const CHANGES: Change[] = [
  {
    date: '2026-09-30',
    app: 'connections',
    title: 'Take your records with you, from every list',
    body: 'Customers, products, orders (and each line on them), invoices, bookings and articles now each have an Export button on their list. You get a spreadsheet any other software can open.',
  },
  {
    date: '2026-09-30',
    app: 'campaigns',
    title: 'Campaigns keep themselves up to date',
    body: 'A campaign now moves people along its steps on its own: a basket left behind, a form sent, a quote accepted, an order paid. It finishes them when they reach the goal and records what that was worth. Customers who have gone quiet are picked up once a day.',
  },
  {
    date: '2026-09-30',
    app: 'home',
    title: 'Every count on Home opens the right list',
    body: 'Tap “3 invoices overdue” and you get those three, not every invoice you have ever sent. All seven counts on Home now open a list already narrowed to what they counted.',
  },
  {
    date: '2026-09-30',
    app: 'home',
    title: 'Moving in brings more across',
    body: 'Trade accounts, companies and discount codes now import in full, along with fields that used to be dropped from ten other kinds of record. Supplier orders import with their reference numbers.',
  },
  {
    date: '2026-09-18',
    app: 'stock',
    title: 'Preorders',
    body: 'You can now start a preorder, so a customer can order something that has not arrived yet.',
  },
  {
    date: '2026-09-18',
    app: 'site',
    title: 'Home tells you when your live site is behind',
    body: 'If you saved changes to your site and have not published them, Home says so and gives you the button to publish.',
  },
  {
    date: '2026-09-18',
    app: 'home',
    title: 'Search finds what you own',
    body: 'The search box now reads far more of the records a business keeps, so what you type finds what you meant.',
  },
  {
    date: '2026-09-16',
    app: 'sell',
    title: 'Returns that match their sale',
    body: 'A return now stays tied to the sale it came from, and fixes to freight and to what customers owe you make those figures agree across screens.',
  },
  {
    date: '2026-08-28',
    app: 'campaigns',
    title: 'Free tools can start a campaign',
    body: 'Somebody who uses one of the free tools on your site can join a campaign, and you choose which form is the way in.',
  },
  {
    date: '2026-08-26',
    app: 'campaigns',
    title: 'Campaigns arrive',
    body: 'Lay out a promotion as the steps somebody takes, from landing on your page to buying, and see how many people reached each step and where the rest stopped.',
  },
  {
    date: '2026-08-26',
    app: 'sell',
    title: 'Returns and exchanges',
    body: 'Start a return from the order, and close an even exchange without sending any money back.',
  },
  {
    date: '2026-08-26',
    app: 'sell',
    title: 'Customers can leave reviews',
    body: 'Reviews on your products carry the name of the customer who wrote them, and you approve each one before it shows.',
  },
  {
    date: '2026-08-24',
    app: 'sell',
    title: 'Made-to-order products',
    body: 'A cake that needs five days’ notice and a deposit is now a product: set the notice, take the deposit, and the counter takes it the same way the website does.',
  },
  {
    date: '2026-08-24',
    app: 'home',
    title: 'Select many, act once',
    body: 'Every list can now select several rows and act on them together from one bar.',
  },
  {
    date: '2026-08-24',
    app: 'connections',
    title: 'Your own address for AI assistants',
    body: 'Claude, ChatGPT and Copilot connect to Piggles at Piggles’ own address, and only see what you allow.',
  },
  {
    date: '2026-08-23',
    app: 'bookings',
    title: 'A customer’s record shows their appointments',
    body: 'Past and upcoming bookings sit on the customer they belong to, beside their orders.',
  },
  {
    date: '2026-08-23',
    app: 'sell',
    title: 'Product options and kinds',
    body: 'Sizes, colors and other options, and kinds of product with their own fields, with price entry that says what the customer will pay.',
  },
  {
    date: '2026-08-16',
    app: 'home',
    title: 'One door for your account',
    body: 'Signing up, signing in, inviting your team and consent all happen in one place, and the console opens already signed in.',
  },
  {
    date: '2026-08-15',
    app: 'site',
    title: 'Pick a look, land on a working site',
    body: 'Choose a design while you sign up, and your site is live on a Piggles address with your business name on it by the time the console opens.',
  },
  {
    date: '2026-08-15',
    app: 'home',
    title: 'Piggles opens',
    body: 'The website, the sign-up and the console, as three parts of one product, with every app included in one price.',
  },
];
