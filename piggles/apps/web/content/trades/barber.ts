import type { TradePage } from './types';
import { BARBER_DETAIL } from './detail/barber';

export const BARBER: TradePage = {
  slug: 'barber',
  pose: 'barber',
  group: 'people',
  name: 'A barber',
  plural: 'Barbers',
  shape:
    'You are not selling a thing, you are selling Tuesday at half past three. The diary is the business, and an empty chair is the only stock that never comes back.',
  leans: ['bookings', 'customers', 'messages'],
  ...BARBER_DETAIL,
  heading: 'Keep the chair full without picking up the phone mid-cut.',
  lede: 'Piggles takes the booking, sends the reminder, holds the deposit and remembers how every regular likes it cut. It is $99 a month with every app included, so the schedule, your regulars and the follow-ups all live in the one place you check between clients.',
  searchTerms: [
    'barber booking app',
    'barbershop software',
    'barber appointment scheduling',
    'online booking for barbers',
    'barber no-show deposits',
    'barber client management app',
    'barbershop website builder',
  ],
  problems: [
    {
      title: 'The phone rings in the middle of a fade',
      body: 'Half your bookings arrive while your hands are full. You either stop the cut to answer, or call back an hour later and find out they booked somewhere else.',
    },
    {
      title: 'A no-show costs you the slot twice',
      body: 'An empty 3:30 is gone for good, and the person who would have taken it never heard it came free. A reminder sent by hand, when you remember to send it, does not fix that.',
    },
    {
      title: 'Your regulars live in your head',
      body: 'Number two on the sides, scissors on top, asks about the kids. It is all in your memory or a notes app on your own phone, which is no help to the barber on the next chair.',
    },
    {
      title: 'Three tools and three monthly bills',
      body: 'One app for bookings, another for payments, and a spreadsheet for who has not been back in a while. None of them talk to each other, and each one wants its own fee.',
    },
  ],
  turn: 'The schedule is the business, so everything else should hang off it.',
  week: [
    {
      when: 'Monday, 11am',
      body: 'Your second barber asks for Friday off. You approve it in My Team and it blocks their schedule straight away, so nobody can book a fade with somebody who is at the beach.',
      app: 'team',
    },
    {
      when: 'Tuesday, 3:30',
      body: 'A regular moves his 3:30 using the link in his reminder. The next person on the waiting list is offered the slot, and the deposit rule you set once applies the same way it always does.',
      app: 'bookings',
    },
    {
      when: 'Wednesday, 1pm',
      body: 'Before your one o’clock sits down, his record shows his last four visits, the note that says "number two, scissors on top, no product," and the beard oil he bought last month.',
      app: 'customers',
    },
    {
      when: 'Thursday, 9pm',
      body: 'After close, the chat on your site shows your away message and your hours instead of leaving somebody typing into an empty room. Next morning a visitor asks whether you do kids’ cuts, and you answer with a quick reply you saved once.',
      app: 'messages',
    },
    {
      when: 'Friday, 10am',
      body: 'Three weeks after a cut, a short note goes out inviting that client back, but only if they have not already booked. Automations waits, checks, and then sends, so nobody gets chased for something they already did.',
      app: 'automations',
    },
    {
      when: 'Saturday, 2pm',
      body: 'Between cuts you answer an Instagram comment and a message on your Google Business listing from one inbox, right beside that person’s orders and emails.',
      app: 'get_found',
    },
    {
      when: 'Sunday, 6pm',
      body: 'Money shows the week: cuts, product sales and gift cards, less what the products cost and the running costs. With approved hours from My Team feeding in as wages, the number you see is what the week actually left you.',
      app: 'money',
    },
  ],
  firstHour: [
    'Set your opening hours, including the late Thursday and the short Saturday, and add the services you offer with how long each one takes and what it costs.',
    'Add each barber and each chair, so two clients can never be booked into the same seat at the same time, and leave a few minutes between appointments to sweep up.',
    'Decide your deposit and cancellation rule once. It applies the same way to everybody, so it is never an argument at the counter.',
    'Bring your client list in from a spreadsheet, with a preview before a single record is written.',
    'Put booking on your site, or send your regulars a link that shows your real open times.',
  ],
  questions: [
    {
      q: 'How much does Piggles cost for a barbershop?',
      a: '$99 a month, flat, with all sixteen apps included. That covers one business, one location, one main website and three people with their own sign-in, so you and two barbers are covered. A fourth barber is one extra seat, added in one tap with the price on the button. Bookings are unlimited. Try it free for 14 days, no card needed.',
    },
    {
      q: 'Will my clients need to download an app to book?',
      a: 'No. They book from your website or from a link you send them, on whatever phone they already have. They see your real open times, pick one, and get a confirmation and a reminder before the appointment.',
    },
    {
      q: 'Will it actually cut down on no-shows?',
      a: 'It attacks them from three sides. Reminders go out automatically before each appointment, with a link to move it rather than just not turning up. You can take a deposit up front with a cancellation rule applied the same way for everybody. And when somebody does cancel, the next person on the waiting list is offered the slot instead of it sitting empty.',
    },
    {
      q: 'What about walk-ins?',
      a: 'Add them to the schedule as they come through the door. Open times are worked out from what is already booked, so a walk-in in the chair is a slot nobody can book online on top of them.',
    },
    {
      q: 'Can I sell products and gift cards too?',
      a: 'Yes. Pomade, beard oil and anything else on the shelf go in the same place as your services. Gift cards are tracked as a real balance, not a code somebody wrote on a card, and reminder and booking emails do not count toward your monthly email allowance.',
    },
    {
      q: 'I use another booking app now. Is switching painful?',
      a: 'Export your client list from it as a spreadsheet and bring it in here, with a preview of exactly what will be created before anything is written. Every new account also starts with practice data, so you can try the whole thing on pretend clients first and clear it out with one button.',
    },
  ],
};
