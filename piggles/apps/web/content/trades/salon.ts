import type { TradePage } from './types';
import { SALON_DETAIL } from './detail/salon';

export const SALON: TradePage = {
  slug: 'salon',
  pose: 'salon',
  group: 'run',
  name: 'A salon',
  plural: 'Salons',
  shape:
    'Several people are booked at once and not everyone can do everything. The rota and the diary are the same problem, and telling them apart is where the double-bookings come from.',
  leans: ['bookings', 'team', 'customers'],
  ...SALON_DETAIL,
  heading: 'Every chair full, and nobody booked with a stylist who is off.',
  lede: 'Piggles keeps the appointment book and the staff schedule as one thing, so a client can only book someone who is working, free and the right person for the service. Reminders, deposits and the regular who has gone quiet are handled without anybody at the desk remembering.',
  searchTerms: [
    'salon booking software',
    'hair salon appointment app',
    'salon scheduling software',
    'beauty salon client management',
    'salon staff scheduling',
    'online booking for hairdressers',
  ],
  problems: [
    {
      title: 'The appointment book and the staff schedule disagree.',
      body: 'Somebody’s day off was agreed in the group chat. The book still shows them free, a client books them for 3:30, and you find out when she walks in. Two lists for one problem means one of them is always wrong.',
    },
    {
      title: 'A no-show costs you the whole chair.',
      body: 'A long color appointment that does not turn up is two hours nobody can sell. Without a deposit there is no reason to call, and phoning everybody the day before takes an hour you do not have.',
    },
    {
      title: 'A booking app, a spreadsheet and a notebook at the desk.',
      body: 'The booking app does not know who is on this week. The spreadsheet holds the hours for wages. The notebook holds every client’s formula and preferences, and it only works when the person who wrote it is in. You tried to fix one problem three times.',
    },
    {
      title: 'Regulars drift away and nobody notices.',
      body: 'A client who came every six weeks has not been in for five months. Nothing told you, so nothing was sent, and she is now somebody else’s regular.',
    },
  ],
  turn: 'Who is working and who is booked were always one question, so Piggles keeps them as one record: once a day off is approved, nobody can book that stylist into it.',
  week: [
    {
      when: 'Monday, 8am',
      body: 'Publish the week’s schedule in My Team, so everyone sees their shifts without a photo of a whiteboard. Approved time off is written straight into availability, so the book already knows who is away.',
      app: 'team',
    },
    {
      when: 'Tuesday, 11:20am',
      body: 'A client cancels her 2pm cut. Bookings offers the slot to the next person on the waiting list instead of it going quietly empty, and the chair is filled before lunch.',
      app: 'bookings',
    },
    {
      when: 'Wednesday, 9pm',
      body: 'A new client books a long color service online, with the stylist who does color, at a time that stylist is actually free. The deposit is taken up front under the cancellation policy you set, applied the same way for everybody. Her confirmation goes out now and her reminder goes out before the day, with a link to move it herself.',
      app: 'bookings',
    },
    {
      when: 'Thursday, 10:30am',
      body: 'She is in the chair. Her record shows every visit, what she bought and the notes you wrote last time, so whoever is doing her hair today picks up where the last stylist left off.',
      app: 'customers',
    },
    {
      when: 'Friday, 4pm',
      body: 'A bottle of the conditioner she liked and a gift card for her sister, sold at the desk in Sell. The gift card is a real balance, not a code written on the back of a card.',
      app: 'sell',
    },
    {
      when: 'Saturday, 6pm',
      body: 'Close up. Money shows what came in after refunds and discounts, and because approved hours from My Team arrive as wages on their own, the people you pay are in the picture. You see what the week actually left, not just what went through the register.',
      app: 'money',
    },
    {
      when: 'Sunday, 7pm',
      body: 'A short note from your own address to a saved group, say everyone who bought from the color-care range. The group keeps itself current, so next month it is the right people again without you rebuilding the list.',
      app: 'messages',
    },
  ],
  firstHour: [
    'Add your services with how long each takes and what it costs, and say which stylists do which.',
    'Invite your team. Three people are included, each with their own sign-in and only the access their job needs.',
    'Set your opening hours, each stylist’s hours, and your deposit and cancellation policy for the long services.',
    'Read the confirmation and reminder wording and change it until it sounds like your salon.',
    'Bring your client list in from a spreadsheet or your old booking system, with a preview before anything is saved.',
  ],
  questions: [
    {
      q: 'We have five stylists. Does $99 a month cover all of us?',
      a: 'The $99 a month includes every app and three people, each with their own sign-in. For a bigger team you add more people when you need them, in one tap, with the price on the button before you commit, and you can remove them again just as easily. Nothing else changes: every app stays included.',
    },
    {
      q: 'Can clients pick their stylist and book themselves?',
      a: 'Yes. Availability is worked out from your opening hours, who is in, how long the service takes and what is already booked, and a service that needs a particular person or chair cannot be booked into one that is busy. Clients get a confirmation, a reminder and a link to move the appointment themselves.',
    },
    {
      q: 'Will my stylists be able to see the takings?',
      a: 'Only if you let them. In My Team you tick the apps each person works in and the rest are simply not there for them, so a stylist can have the book and her clients without Money. Pay rates, wage costs and commission are for owners and admins only.',
    },
    {
      q: 'Can I manage it from my phone between clients?',
      a: 'Yes. The screens are built for a phone, so checking tomorrow’s book, moving an appointment or answering a message does not mean going to the desk.',
    },
    {
      q: 'We are switching from another booking app. Do we lose our clients?',
      a: 'No. Import clients from a spreadsheet or another system, with what will happen shown row by row before anything is written. Bringing the same file in twice updates what is there rather than doubling it.',
    },
    {
      q: 'What if we open a second salon?',
      a: 'The price includes one location, and more can be added any time. Bookings handles more than one address, each with its own time zone, and every confirmation tells the client where to go and who she is seeing.',
    },
  ],
};
