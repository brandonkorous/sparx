import type { TradePage } from './types';
import { TAILOR_DETAIL } from './detail/tailor';

export const TAILOR: TradePage = {
  slug: 'tailor',
  pose: 'tailor',
  group: 'sell',
  name: 'A tailor',
  plural: 'Tailors',
  shape:
    'Every job is a set of measurements, two fittings and a date somebody is depending on. The work is bespoke; the chasing, the deposit and the reminder are not.',
  leans: ['bookings', 'customers', 'invoices'],
  ...TAILOR_DETAIL,
  heading: 'Keep the measurements, the fittings and the deadline together.',
  lede: 'Piggles keeps every job on the client’s record: the measurements, the quote, the deposit, both fittings and the date it has to be ready. The reminding and the chasing happen on their own, so your hours go to the cloth.',
  searchTerms: [
    'tailor software',
    'tailoring shop management',
    'alterations booking app',
    'bespoke tailor client measurements',
    'dressmaker order tracking',
    'seamstress invoicing app',
  ],
  problems: [
    {
      title: 'The measurements live in a notebook.',
      body: 'A client comes back after two years for a second suit. Her measurements are on a page in a notebook, which is at home, or smudged, or in the one from before last. You measure again and hope nothing changed that you would have wanted to know.',
    },
    {
      title: 'The deadline belongs to somebody’s wedding.',
      body: 'Two fittings and a date that cannot move. One missed fitting pushes everything back, and the first you hear of it is the client asking whether it will still be ready.',
    },
    {
      title: 'The deposit is an awkward conversation every time.',
      body: 'You take it by bank transfer, try to remember who has paid, and write it in the margin. Asking for the balance feels like chasing, so sometimes you do not.',
    },
    {
      title: 'A calendar, an invoice app and the notebook.',
      body: 'That was the fix: one app for fittings, one for bills, and the notebook for everything else. Each holds a piece of the job, and the job itself, with its stage and its date, is in none of them.',
    },
  ],
  turn: 'The garment is bespoke but the job has a shape you repeat every time (measure, quote, deposit, fit, fit, collect), so Piggles keeps the shape and leaves you the part only you can do.',
  week: [
    {
      when: 'Monday, 8:30am',
      body: 'Home shows what needs you today: two fittings to confirm, a message sent through your website and an invoice that has gone late. You know the day before you unlock the door.',
      app: 'home',
    },
    {
      when: 'Monday, 10am',
      body: 'A new client for a three-piece suit. Her measurements go into a record you designed with the fields you actually take, linked to her, and the job goes on your board at the stage you call "measured", with its value and its date.',
      app: 'customers',
    },
    {
      when: 'Monday, 4pm',
      body: 'She accepts the quote. It becomes an invoice without retyping, and you send her a link to pay the deposit. Paid through Stripe, it records itself against the invoice, and the balance stays open as what is still owed.',
      app: 'invoices',
    },
    {
      when: 'Wednesday, 11am',
      body: 'Both fittings go in the book with a buffer after each, so a long fitting never eats into the next one. She gets a confirmation and a reminder beforehand, with a link to move it herself if she needs to.',
      app: 'bookings',
    },
    {
      when: 'Thursday, 2pm',
      body: 'Cutting the jacket. You buy cloth by the roll and use it by the meter, and Stock converts between the two, so you know how much of that navy wool is left before you promise it to the next client.',
      app: 'stock',
    },
    {
      when: 'Friday, 9am',
      body: 'A quote you sent last week has gone quiet. Automations sends the polite follow-up you wrote once, after checking she has not already accepted, so nobody is chased for something they already did.',
      app: 'automations',
    },
    {
      when: 'Saturday, 3pm',
      body: 'The suit is collected. Money shows what the job actually made once the cloth, the lining and any other costs you charged to it are taken off, so you can price the next one like it with real numbers.',
      app: 'money',
    },
  ],
  firstHour: [
    'Set up a measurements record with the fields you actually take, and link it to the client.',
    'Name the stages on your job board the way you work: measured, cutting, first fitting, second fitting, ready.',
    'Add your services, alterations and bespoke, with how long a fitting takes.',
    'Put your logo and terms on your quote and invoice template.',
    'Bring your client list in from a spreadsheet, with a preview before anything is saved.',
  ],
  questions: [
    {
      q: 'What does it cost?',
      a: '$99 a month, flat. Every app is included: bookings, invoices, your client records, your website, email and the rest. It covers one business, one location, one website and three people with their own sign-in. You can try it for 14 days without a card.',
    },
    {
      q: 'My measurements are in notebooks. Do I have to type them all in first?',
      a: 'No. If your client list is already in a spreadsheet, bring it in with a preview first. Measurements from a notebook can go in as each client comes back, which is usually when they need taking again anyway.',
    },
    {
      q: 'Can I take a deposit and then the balance?',
      a: 'Yes. An invoice takes part payments and always shows what is left. Send a link to pay whatever is still owed, and if it is paid through Stripe, the payment records itself against the right invoice. Bookings can also take a deposit up front with a cancellation policy applied the same way for everybody.',
    },
    {
      q: 'I do quick alterations as well as bespoke work. Is that two systems?',
      a: 'No. You can keep a separate board for each kind of work, because a trouser hem and a wedding suit do not move through the same stages. Both sit on the same client records and the same invoices.',
    },
    {
      q: 'I work on my own. Is this too much software?',
      a: 'Every app is included, and you use the ones that fit your week. Three people are included, so if you take on an apprentice later there is nothing to upgrade.',
    },
    {
      q: 'Can I check it from my phone at the bench?',
      a: 'Yes. The screens are built for a phone, so looking up a measurement, moving a fitting or checking who has paid does not mean washing your hands and finding a laptop.',
    },
  ],
};
