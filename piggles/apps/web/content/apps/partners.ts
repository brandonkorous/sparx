import type { AppMarketing } from './types';
import { PARTNERS_CHAPTERS } from './chapters/partners';

// Partners is built entirely from surfaces the platform keeps inside its
// inventory and dropship modules and Piggles advertises as their own app (see
// `claims` in @piggles/config), 18 of them against six bullets. The chapters
// live in ./chapters/partners.ts, with what was verified and left out.
//
// Corrected 2026-09-30: "Purchase orders: raise, send..." said an order is sent
// to the supplier. Placing one locks it and marks it placed; nothing leaves
// Piggles, so the bullet now says "place".

export const PARTNERS: AppMarketing = {
  heading: 'The suppliers and people you work alongside.',
  lede: 'Partners is the other side of your business: who you buy from, what they charge, how long they actually take, and the orders that keep the shelves full.',
  alsoKnownAs: [
    'supplier management',
    'purchasing',
    'procurement',
    'vendor management',
    'purchase orders',
    'dropshipping',
  ],
  does: [
    {
      title: 'Who supplies what',
      body: 'Suppliers, the items they provide, their codes for them and their prices, including when more than one can supply the same thing.',
    },
    {
      title: 'Orders to your suppliers',
      body: 'Write the order, place it, and book deliveries in against it as they arrive, part by part. What arrived and what is still to come stays clear.',
    },
    {
      title: 'What they really cost you',
      body: 'Freight, duty and handling spread across the delivery, so the cost of an item is the cost of getting it here.',
    },
    {
      title: 'How long they actually take',
      body: 'Measured from your own orders, not from what they told you, and shown beside what they told you.',
    },
    {
      title: 'Bills checked before they are paid',
      body: 'When a supplier’s invoice does not match what you ordered or what arrived, it is flagged rather than absorbed.',
    },
    {
      title: 'Receiving with a scanner',
      body: 'Scan the delivery in and stock updates as you go, instead of a paper note typed up later.',
    },
  ],
  chapters: PARTNERS_CHAPTERS,
  worksWith: ['stock', 'money', 'sell'],
  photo: { src: '/photos/carpenter.jpg', alt: 'A joiner marking a length of timber' },
};
