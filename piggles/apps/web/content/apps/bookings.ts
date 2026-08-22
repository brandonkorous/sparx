import type { AppMarketing } from './types';

export const BOOKINGS: AppMarketing = {
  heading: 'Let people book you without the back-and-forth.',
  lede: 'Bookings publishes real availability, takes the appointment, and keeps your calendar honest — including the parts that are hard: two staff, one room, a deposit, a cancellation and somebody who did not turn up.',
  alsoKnownAs: ['scheduling', 'appointment booking', 'calendar software', 'reservations'],
  does: [
    {
      title: 'Availability that is actually true',
      body: 'Worked out from opening hours, who is in, how long the job takes and what is already booked — not a calendar you keep in step by hand.',
    },
    {
      title: 'Rooms, equipment and more than one address',
      body: 'If a service needs a chair, a bay, a particular person or a particular branch, it cannot be double-booked into one that is already busy.',
    },
    {
      title: 'The awkward cases',
      body: 'Repeating appointments, buffers between jobs, holidays and one-off closures, and different hours on a Saturday.',
    },
    {
      title: 'Reminders that reduce no-shows',
      body: 'Automatic confirmations and reminders before the appointment, and a link the customer can use to move it themselves.',
    },
    {
      title: 'Deposits and cancellation rules',
      body: 'Take money up front where it matters, with a stated policy that is applied the same way for everybody.',
    },
    {
      title: 'A waiting list that works',
      body: 'When somebody cancels, the next person is offered the slot instead of it silently going empty.',
    },
  ],
  worksWith: ['customers', 'messages', 'team'],
  photo: { src: '/photos/barber.jpg', alt: 'A barber finishing a client’s cut' },
};
