// The People apps — Customers, Messages and Bookings.

import type { Guide } from '../types';

export const CUSTOMERS_GUIDE: Guide = {
  id: 'crm',
  offer: 'First time in Customers? Show me around',
  steps: [
    {
      id: 'customers.list',
      app: 'customers',
      anchor: 'nav-crm.customers.list',
      title: 'Everyone you deal with',
      body: 'One page per person or company, with everything that has ever happened between you on it — orders, invoices, bookings, emails, notes. Nobody has to remember what was agreed.',
    },
    {
      id: 'customers.deals',
      app: 'customers',
      anchor: 'nav-crm.deals.list',
      title: 'Work you are trying to win',
      body: 'A quote out, a job being discussed, a big order not yet placed. Move it along a board as it progresses so nothing quietly goes cold.',
    },
    {
      id: 'customers.tasks',
      app: 'customers',
      anchor: 'nav-crm.tasks.list',
      title: 'The things you said you would do',
      body: 'Ring them back, send the quote, chase the deposit. Tasks hang off the customer they are about, so opening someone tells you what you owe them.',
    },
    {
      id: 'customers.segments',
      app: 'customers',
      anchor: 'nav-crm.segments.list',
      title: 'Groups that keep themselves up to date',
      body: '"Bought in the last ninety days", "never ordered", "spent over £500". Describe the group once and people join and leave it on their own — which is what makes a mailout worth sending.',
    },
  ],
};

export const MESSAGES_GUIDE: Guide = {
  id: 'email',
  offer: 'First time in Messages? Show me around',
  steps: [
    {
      id: 'messages.broadcasts',
      app: 'messages',
      anchor: 'nav-email.broadcasts.list',
      title: 'One message, everybody at once',
      body: 'A newsletter, an offer, an "we are closed next Monday". Pick who it goes to from your customer groups, and see afterwards how many opened it.',
    },
    {
      id: 'messages.sequences',
      app: 'messages',
      anchor: 'nav-email.sequences.list',
      title: 'Messages that send themselves',
      body: 'A welcome a day after someone first orders, a nudge to anyone who left something in their basket. Set it up once and it keeps going without you.',
    },
    {
      id: 'messages.domains',
      app: 'messages',
      anchor: 'nav-email.domains.list',
      title: 'Send from your own address',
      body: 'Until you set this up, mail goes out from a Piggles address. Connecting yours takes a few minutes and means it arrives looking like it came from you — which is most of whether it arrives at all.',
    },
  ],
};

export const BOOKINGS_GUIDE: Guide = {
  id: 'scheduling',
  offer: 'First time in Bookings? Show me around',
  steps: [
    {
      id: 'bookings.calendar',
      app: 'bookings',
      anchor: 'nav-scheduling.calendar',
      title: 'Your diary',
      body: 'Everything booked, by day or by week. Drag one to move it and the customer gets told — you never have to send that message yourself.',
    },
    {
      id: 'bookings.services',
      app: 'bookings',
      anchor: 'nav-scheduling.services.list',
      title: 'What people can book',
      body: 'Each thing you offer, how long it takes and what it costs. This is what someone sees on your site, so it is worth writing them the way you would say them out loud.',
    },
    {
      id: 'bookings.availability',
      app: 'bookings',
      anchor: 'nav-scheduling.availability',
      title: 'When you are open to it',
      body: 'Your hours, your days off, how much notice you want and how far ahead people can book. Get this right and the diary stops filling up with times that never suited you.',
    },
  ],
};
