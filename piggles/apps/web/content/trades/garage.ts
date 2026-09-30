import type { TradePage } from './types';
import { GARAGE_DETAIL } from './detail/garage';

export const GARAGE: TradePage = {
  slug: 'garage',
  pose: 'garage',
  group: 'web',
  name: 'A garage',
  plural: 'Garages',
  shape:
    'A job is a booking, a pile of parts and an invoice that nobody can write until the work is done. The same car comes back in a year and the history has to still be there.',
  leans: ['bookings', 'invoices', 'customers'],
  ...GARAGE_DETAIL,
  heading: 'The booking, the parts and the bill, all on one job.',
  lede: 'Piggles books the car in, keeps track of the parts on the shelf, turns the approved quote into the invoice and remembers the car when it comes back next year. It is $99 a month with every app included, so the paperwork stops eating your evenings.',
  searchTerms: [
    'auto repair shop software',
    'garage management software',
    'mechanic invoicing software',
    'car repair booking system',
    'auto shop estimate and invoice app',
    'mechanic shop scheduling',
    'vehicle service history software',
    'small garage parts inventory',
  ],
  problems: [
    {
      title: 'The quote and the invoice never match',
      body: 'You quote for brake pads, find a seized caliper, and the invoice gets rewritten from memory at six o’clock. The parts you fitted and the parts you billed slowly drift apart.',
    },
    {
      title: 'The service history is in a filing cabinet',
      body: 'The same car comes back a year later and nobody can find what was done last time, which parts went on, or what the customer was told to keep an eye on.',
    },
    {
      title: 'Two cars booked onto one lift',
      body: 'The calendar on the wall does not know the second bay is out of action, or that your mechanic is off on Thursday. You find out when both customers are standing at the counter.',
    },
    {
      title: 'You cannot tell which jobs make money',
      body: 'Sales look fine. But nobody adds up the parts and the other costs against each job, so the jobs quietly losing money get quoted the same way next time.',
    },
  ],
  turn: 'A job is one record from the moment it is booked to the moment it is paid, and the car keeps its history after.',
  week: [
    {
      when: 'Monday, 7:30am',
      body: 'Home shows the day before the shutter goes up: two bookings to confirm, a message somebody sent through your website over the weekend, an invoice that has gone late, and oil filters running low.',
      app: 'home',
    },
    {
      when: 'Monday, 10am',
      body: 'A customer books a brake check from your website. Bookings only offers times when a bay and a mechanic are both free, so the lift you filled at nine cannot be booked twice.',
      app: 'bookings',
    },
    {
      when: 'Tuesday, 11am',
      body: 'The car on the lift has its own record, linked to its owner, and the owner’s record holds last year’s invoice and the notes, so nobody starts from scratch.',
      app: 'customers',
    },
    {
      when: 'Tuesday, 3pm',
      body: 'You scan the pads off the shelf. Stock knows there were four sets, and which bin the rest are sitting in.',
      app: 'stock',
    },
    {
      when: 'Wednesday, 9am',
      body: 'Oil filters are running low at the rate you actually fit them. Partners suggests the order from real usage and real delivery times, you confirm it, and when the parts arrive you scan them in.',
      app: 'partners',
    },
    {
      when: 'Thursday, 4pm',
      body: 'The customer approved the quote, with the signed copy kept on the record. Now it becomes the invoice without retyping, and you send a link to pay what is owed. Paid through Stripe, it records itself against the right invoice.',
      app: 'invoices',
    },
    {
      when: 'Friday, 5pm',
      body: 'Money lists what each job left after its parts, its fees and the costs you charged to it, worst first. If the clutch jobs are busy but thin, you see it before you quote the next one.',
      app: 'money',
    },
  ],
  firstHour: [
    'Set your opening hours and add your bays and your mechanics, so a booking can only land where there is a lift and a person free.',
    'Add the services you book most often, with how long each one takes.',
    'Create a vehicle record with the fields you care about (make, model, year, plate, mileage) and link it to its owner. It gets its own place in the menu, next to everything else.',
    'Import your customer list and your parts list from a spreadsheet, with a preview before anything is written.',
    'Put your logo, terms and wording on your quote and invoice templates.',
  ],
  questions: [
    {
      q: 'How much does Piggles cost for a garage?',
      a: '$99 a month, flat, with all sixteen apps included: bookings, invoices, parts, your website and the rest. That covers one business, one location, one main website and three people with their own sign-in, so you and two mechanics are covered. More seats, storage, customer records or email can be added in one tap. Try it free for 14 days, no card needed.',
    },
    {
      q: 'Can I keep a full service history for every car?',
      a: 'Yes. You set up a vehicle record with your own fields and link it to its owner, whose record holds every booking, invoice and note. Customers can say which car it is when they book. When the car comes back in a year, the history is where you left it.',
    },
    {
      q: 'What happens when the job changes once the car is apart?',
      a: 'Send a revised quote for the extra work and have the customer accept it, or sign it where that matters. The signed copy stays on the record, and the accepted quote becomes the invoice without anybody retyping it.',
    },
    {
      q: 'Can my mechanics use it without seeing the money?',
      a: 'Yes. Everyone signs in as themselves and sees only the apps you tick for them, so leave Money off a mechanic’s list and it is simply not there. Pay rates, wage costs and commission are for owners and admins only.',
    },
    {
      q: 'Does it do payroll?',
      a: 'No, and it will not. My Team records the hours each person worked and their rates, and hands them to whoever runs your payroll. Once approved, those hours also arrive in Money as wages, so the profit figure counts what your people cost.',
    },
    {
      q: 'Will it work with my accountant?',
      a: 'Yes. Piggles is not accounting software, so your books stay with your accountant. Money hands them a spreadsheet of your spending with every column labeled and their account codes on each line, so they are not retyping a year.',
    },
  ],
};
