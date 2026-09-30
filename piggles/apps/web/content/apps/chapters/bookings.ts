import type { AppChapter } from '../types';

// Bookings fronts eleven screens in the console: the calendar, bookings,
// repeating bookings, the waiting list, services, people and equipment, places,
// availability, booking rules, reports, and linked calendars. The chapters are
// the order a business meets them in: the diary, what can be booked, when you
// are open, what happens around the booking, and how it is going.
//
// VERIFIED 2026-09-30 against piggles/apps/workbench/surfaces/scheduling,
// wizeworks/packages/scheduling and api-rest /v1/public/scheduling*.
// DELIBERATELY ABSENT: text-message reminders (the ledger has an SMS channel,
// but no SMS provider is confirmed connectable for Piggles), and any named
// calendar provider in `connects` (linking a calendar needs a setting switched
// on at our end, so no logo). Deposits name no gateway for the same reason Sell
// does not repeat itself: it is whichever payment provider is connected.

export const BOOKINGS_CHAPTERS: AppChapter[] = [
  {
    heading: 'The diary, with everyone in it.',
    body: 'The calendar is where the day actually happens. See a day or a week, the whole team at once or one person, room or machine on its own, with the hours nobody is working shaded out so a closed afternoon never passes for a free one.',
    does: [
      {
        title: 'A day or a week',
        body: 'Step through the diary a day or a week at a time, for everybody, or narrowed to one person, one room or one piece of equipment.',
      },
      {
        title: 'Closed looks closed',
        body: 'Hours somebody is not working are shaded, and a day nobody works says so, rather than looking like a quiet one.',
      },
      {
        title: 'Take a booking over the phone',
        body: 'Add one while the customer is still on the line: the service, the time and who it is with. It lands on that customer’s record.',
      },
      {
        title: 'Move it, cancel it, say how it went',
        body: 'Reschedule, cancel, mark it finished or mark a no-show. Every change is kept in the booking’s own history.',
      },
      {
        title: 'Their other calendar counts too',
        body: 'Link a person’s outside calendar using the private calendar link their calendar app gives them, and the times they are busy there are blocked here.',
      },
      {
        title: 'You hear when somebody books',
        body: 'When a customer books online, the person taking the booking is emailed, or your main inbox if nobody is assigned yet.',
      },
    ],
  },
  {
    heading: 'Every kind of booking, not only appointments.',
    body: 'A haircut, a yoga class, a table for six and a kayak for the afternoon are four different problems. Each service says which one it is, how long it takes, what it costs and what it ties up, and the times a customer is offered come out of all of that at once.',
    does: [
      {
        title: 'Four kinds of booking',
        body: 'One-to-one appointments, classes with a set number of places, reservations for a party of a given size, and hire of something for a stretch of time.',
      },
      {
        title: 'How long, and how often it starts',
        body: 'Set the length, how often a start time is offered, and a gap before and after for setting up, clearing down or getting there.',
      },
      {
        title: 'Who or what it uses up',
        body: 'A person, a room, a table, a machine or the thing being hired, and how many. Two bookings can never claim the same one at the same time.',
      },
      {
        title: 'Only the people who can do it',
        body: 'Note who has which skills, and a service that needs a color specialist is only offered with the people who do color.',
      },
      {
        title: 'Who takes the booking',
        body: 'Whoever is free, the work shared evenly across the team, everyone listed at the same time, or the customer picks the person they want.',
      },
      {
        title: 'Their own thing, named at booking',
        body: 'For work on a customer’s own bike, car or instrument, they say which one when they book.',
      },
      {
        title: 'Notice, and how far ahead',
        body: 'Set the least notice you need and the furthest into the future anybody can book.',
      },
      {
        title: 'Approve first, if you prefer',
        body: 'Let bookings arrive as requests you accept, rather than being confirmed on the spot.',
      },
    ],
  },
  {
    heading: 'Open when you are open. Closed when you are not.',
    body: 'Availability is worked out, not typed in. Weekly hours, the places you work from, the days you are shut and the bookings already taken all feed one answer, so a customer is never offered a time you cannot keep.',
    does: [
      {
        title: 'Weekly hours, with the seasons',
        body: 'Hours for each day of the week, and a different set for summer or winter if your trade changes with the season.',
      },
      {
        title: 'Closures and special hours',
        body: 'Public holidays, a one-off closure or a late opening, for the whole business or only the people it affects.',
      },
      {
        title: 'More than one place',
        body: 'Each address keeps its own time zone, and the customer’s confirmation tells them where to go and who they are seeing.',
      },
      {
        title: 'Checked again at the last moment',
        body: 'A time is checked once more as it is booked, so two people reaching for the last slot cannot both get it.',
      },
      {
        title: 'Bookings that repeat',
        body: 'Every day, every week or every month, on the days you choose, until a date or for a set number of times, with every booking it made listed in one place.',
      },
    ],
  },
  {
    heading: 'Deposits, clear rules, and fewer empty chairs.',
    body: 'A no-show costs the most when nobody said in advance what happens next. Booking rules put it in writing: what is paid at booking, how much notice a free cancellation needs, what a late cancellation or a missed booking costs, and when the customer is reminded. Customers see the terms before they book, and the same rules apply to everybody.',
    does: [
      {
        title: 'Four ways to handle money up front',
        body: 'Nothing, a card held on file, a deposit as a set amount or a share of the price, or the full price at the time of booking.',
      },
      {
        title: 'The money follows what happened',
        body: 'Cancel in good time and the deposit is refunded. Cancel late or do not turn up, and it is kept, or the fee is taken from the card on file.',
      },
      {
        title: 'Terms they actually agreed to',
        body: 'Your cancellation terms in your own words, shown at booking and kept as a record of what the customer accepted.',
      },
      {
        title: 'Reminders on your timing',
        body: 'A week, two days, a day, two hours or an hour before, in any combination, plus a confirmation when they book and a note if it moves or is canceled.',
      },
      {
        title: 'Change it without calling you',
        body: 'Every confirmation carries a link to move or cancel, with no account to create. Your rules decide whether it can still be moved.',
      },
      {
        title: 'Straight into their calendar',
        body: 'The confirmation offers to add the booking to the customer’s own calendar, with the address and who it is with.',
      },
      {
        title: 'A waiting list that fills the gap',
        body: 'When a slot frees up, the next person waiting for that service in that window is emailed the offer, and it lapses if they do not take it.',
      },
    ],
  },
  {
    heading: 'How the diary is really going.',
    body: 'A busy week and a full week are not the same thing. Reports answer the questions a booking business actually asks, across all of your bookings for the period you pick rather than whichever ones happen to be on screen.',
    does: [
      {
        title: 'How full it ran',
        body: 'How much of the time you had open was actually booked.',
      },
      {
        title: 'How bookings turned out',
        body: 'Finished, still to come, waiting for you to confirm, canceled, and did not turn up, counted side by side.',
      },
      {
        title: 'Your busiest days and hours',
        body: 'Which days and times fill first, so you know when to add hands and when to run an offer.',
      },
      {
        title: 'What people book you for',
        body: 'Your services ranked by how often they are booked.',
      },
    ],
  },
];
