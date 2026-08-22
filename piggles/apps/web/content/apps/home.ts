import type { AppMarketing } from './types';

// Home is the dashboard AND the place the business itself is set up — it fronts
// the whole platform module, so its panel holds your business details, your
// sites, your domains, notifications, sign-in security, guided setup, practice
// data and the background-job feed.
//
// This page described only the dashboard. Twelve of Home's sixteen screens had
// no sentence anywhere on the site, which made the app look like a widget board
// and left a reader wondering where the settings for their actual business were.

export const HOME: AppMarketing = {
  heading: 'Start the day knowing what actually needs you.',
  lede: 'Home is the first screen you see and usually the only one you need before the doors open. It gathers what changed overnight, what is waiting on you, and what is about to go wrong while there is still time to do something about it.',
  alsoKnownAs: ['dashboard', 'business intelligence', 'KPI reporting'],
  does: [
    {
      title: 'What happened while you were closed',
      body: 'Orders, bookings, messages and payments since you last looked — in one list, newest first, not five badges on five tabs.',
    },
    {
      title: 'What is waiting on you',
      body: 'The things that stop until a person decides: an order held for approval, a return to inspect, a review to answer, a quote about to expire.',
    },
    {
      title: 'Early warning, not a post-mortem',
      body: 'Stock about to run out at the rate it is actually selling, invoices about to go late, a booking with nobody assigned to it.',
    },
    {
      title: 'The numbers that matter this week',
      body: 'What came in, what it cost you, and how that compares to the same stretch last month — without building a report to find out.',
    },
    {
      title: 'Pick up where you left off',
      body: 'The things you had open yesterday are still open today, arranged the way you left them.',
    },
    {
      title: 'Made yours',
      body: 'Everything on Home can be moved or removed. A workshop and a bakery do not start the day looking at the same thing.',
    },
  ],
  chapters: [
    {
      heading: 'And the settings that are about your business, not your website.',
      body: 'Every product has a settings screen nobody can find. Home is where yours are, because they are not really settings — they are facts about your business that everything else reads. Your name and address on an invoice, which trade you are in, where you are told about things, and who is allowed in.',
      does: [
        {
          title: 'Your business details, used everywhere',
          body: 'Name, address, contact, registration and tax details. Written once, and from then on they are what appears on the invoice, the receipt, the email footer and the website.',
        },
        {
          title: 'What kind of business you are',
          body: 'Your trade, which decides the sensible defaults across every app — what a product looks like for a bakery is not what it looks like for a garage.',
        },
        {
          title: 'Every site you run',
          body: 'One list of the sites this business owns, each with its own name, look and web address, and which one is the main one.',
        },
        {
          title: 'Web addresses, connected and kept working',
          body: 'Point a domain you own at your site and the security certificate is issued and renewed on its own. Nothing expires at midnight on a bank holiday.',
        },
        {
          title: 'Told about the right things',
          body: 'Which events reach you, and how. The point of a notification setting is to stop the ones you do not want without losing the one that mattered.',
        },
        {
          title: 'Signing in, and who is signed in',
          body: 'Your password, two-step sign-in with a code from your phone, backup codes, and every device currently signed in — with the ability to throw one off.',
        },
      ],
    },
    {
      heading: 'The first hour, and what is happening when you are not looking.',
      body: 'Two things almost nothing does well: the beginning, and the middle of a long job. A new account arrives already furnished so you can see what a working business looks like before you have typed anything — and every import, export and bulk job runs somewhere you can watch it, rather than behind a spinner that may or may not still be alive.',
      does: [
        {
          title: 'Set up in the order that makes sense',
          body: 'A checklist that knows what you have already done, so it is a short list of what is genuinely left rather than the same ten steps every time you open it.',
        },
        {
          title: 'A shop that already has things in it',
          body: 'Practice records for your trade — products, customers, orders, bookings — so you are learning the software on something that looks real.',
        },
        {
          title: 'And one button to clear them out',
          body: 'Removing the practice data deletes every sample record and touches none of your own. It tells you exactly what went: ten products, ten orders, seven customers and the rest.',
        },
        {
          title: 'Bring your old business with you',
          body: 'Move in from a spreadsheet or another system, with what will happen shown before anything is written.',
        },
        {
          title: 'What has been happening',
          body: 'Imports, exports and long jobs listed while they run, with what finished, what failed and why. A job that fails silently is how a day of work goes missing.',
        },
        {
          title: 'What you told us',
          body: 'Report a problem or ask for something from inside the console, and see what happened to it afterwards.',
        },
      ],
    },
  ],
  worksWith: ['money', 'stock', 'bookings'],
};
