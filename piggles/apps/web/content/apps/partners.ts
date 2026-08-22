import type { AppMarketing } from './types';

// Partners is built entirely from surfaces the platform keeps inside its
// inventory and dropship modules and Piggles advertises as their own app (see
// `claims` in @piggles/config) — 18 of them, against six bullets. The chapters
// follow that split: buying it in, what it actually cost, and the goods you
// never physically touch.

export const PARTNERS: AppMarketing = {
  heading: 'The suppliers and people you work alongside.',
  lede: 'Partners is the other side of your business: who you buy from, what they charge, how long they actually take, and the purchase orders that keep the shelves full.',
  alsoKnownAs: ['supplier management', 'purchasing', 'procurement', 'vendor management'],
  does: [
    {
      title: 'Who supplies what',
      body: 'Suppliers, the items they provide, their codes for them and their prices — including when more than one can supply the same thing.',
    },
    {
      title: 'Purchase orders',
      body: 'Raise, send, receive against, and part-receive. What arrived and what is still outstanding stays clear.',
    },
    {
      title: 'What they really cost you',
      body: 'Freight, duty and handling spread across the delivery, so the cost of an item is the cost of getting it here.',
    },
    {
      title: 'How long they actually take',
      body: 'Measured from your own orders, not from what they told you — which is what reorder timing should be based on.',
    },
    {
      title: 'Price changes caught',
      body: 'When an invoice does not match the agreed price, it is flagged rather than absorbed.',
    },
    {
      title: 'Receiving with a scanner',
      body: 'Scan the delivery in and stock updates as you go, instead of a paper note typed up later.',
    },
  ],
  chapters: [
    {
      heading: 'From "we are nearly out" to it being on the shelf.',
      body: 'Buying in is a chain with several places to lose track: the order raised, whether anybody approved it, whether the supplier acknowledged it, whether it turned up, and whether what turned up was what was ordered. Each of those is a record here, so "where is that delivery" is a screen rather than a phone call.',
      does: [
        {
          title: 'Raised from what is actually running out',
          body: 'Suggested orders come from real sales rates and real lead times, so the order is a decision you confirm rather than a list you compile.',
        },
        {
          title: 'Approved before it is sent',
          body: 'Spending limits by value or by person, with a queue for whoever signs off. An order over the line waits rather than going out and being discovered later.',
        },
        {
          title: 'What is on the way',
          body: 'Advance notices from suppliers who send them, so you know what is coming and when before the van appears.',
        },
        {
          title: 'Overdue, flagged as overdue',
          body: 'Deliveries past their promised date, listed. The supplier who is always two weeks late becomes a fact rather than an impression.',
        },
        {
          title: 'Received against the order',
          body: 'Scan it in. Part-deliveries leave the rest outstanding rather than closing the order and losing the remainder.',
        },
        {
          title: 'And what went back',
          body: 'Returns to a supplier tracked to their credit, so goods sent back are not quietly written off as your loss.',
        },
      ],
    },
    {
      heading: 'The price on the invoice is not the price you agreed.',
      body: 'This is where margin leaks — quietly, a few percent at a time, in freight nobody apportioned and price rises nobody noticed. Partners keeps what you agreed, compares it with what you were actually charged, and spreads the cost of getting goods here across the goods, so an item’s cost is its real cost.',
      does: [
        {
          title: 'Agreed price versus charged price',
          body: 'A mismatch is flagged for a person to look at rather than absorbed into the cost and forgotten.',
        },
        {
          title: 'Freight and duty, spread properly',
          body: 'The cost of getting a delivery here is apportioned across what was in it, so a cheap item shipped expensively stops looking cheap.',
        },
        {
          title: 'Several suppliers for one thing',
          body: 'Who else can supply it and at what price, so a shortage or a price rise has an alternative you can see rather than one you have to go and find.',
        },
        {
          title: 'How they actually perform',
          body: 'Scored on your own orders: on time, in full, at the agreed price. Not on the lead time printed in their catalogue.',
        },
        {
          title: 'Their bills, matched to the delivery',
          body: 'What a supplier has invoiced you against what you actually received, so a bill is checked before it is paid.',
        },
        {
          title: 'Stock you have not paid for yet',
          body: 'Consignment goods held and settled when they sell, kept apart from stock you own outright.',
        },
      ],
    },
    {
      heading: 'Selling things that never come near you.',
      body: 'Dropshipping is a genuinely good idea that goes wrong in the accounting: it is easy to list a supplier’s catalogue and hard to know what you actually made on it once their price moved. Here the supplier’s products, your markup rules and the real cost stay visible together, and the order goes to them without you rekeying it.',
      does: [
        {
          title: 'Their catalogue, your prices',
          body: 'Bring in a supplier’s products and apply markup rules — by margin, by category, by item — so a price rise on their side does not silently become your loss.',
        },
        {
          title: 'The order goes straight to them',
          body: 'A sale becomes a supplier order without anybody retyping it, and its progress stays attached to the customer’s order.',
        },
        {
          title: 'What you actually made',
          body: 'Margin on dropshipped lines separately from the stock you hold, because they behave completely differently and averaging them hides both.',
        },
        {
          title: 'Sold beside everything else',
          body: 'It is one catalogue and one order list. A customer buying a held item and a dropshipped one is placing one order, not two.',
        },
      ],
    },
  ],
  worksWith: ['stock', 'money', 'sell'],
  photo: { src: '/photos/carpenter.jpg', alt: 'A joiner marking a length of timber' },
};
