import type { AppChapter } from '../types';

// Partners is built entirely from surfaces the platform keeps inside its
// inventory and dropship modules (see `claims` in @piggles/config): buying it
// in, what it actually cost, the supplier record itself, and the goods you
// never physically touch.
//
// VERIFIED 2026-09-30 against piggles/apps/workbench/surfaces/inventory (the
// purchase order, sign-off, dispatch note, bill, return, consignment, scorecard
// and stock source panes), surfaces/dropship, and @wizeworks/dropship's vendor
// catalog and pricing rule.
//
// DELIBERATELY ABSENT:
//   • Sending an order to a supplier. Placing an order stamps it as placed and
//     locks it; nothing is emailed or transmitted (inventory
//     purchase-order-lifecycle.ts), so the copy says "place", never "send".
//   • Suppliers sending dispatch notices electronically. A notice is recorded by
//     the buyer from the supplier's paperwork.
//   • Markup rules by category or by item. There is one pricing rule per
//     supplier, applied when a product is brought in, and it does not re-price
//     on a later sync, so nothing promises protection from a price rise.

export const PARTNERS_CHAPTERS: AppChapter[] = [
  {
    heading: 'From "we are nearly out" to it being on the shelf.',
    body: 'Buying in is a chain with several places to lose track: the order written, whether anybody approved it, whether the supplier said it had shipped, whether it turned up, and whether what turned up was what was ordered. Each of those is a record here, so "where is that delivery" is a screen rather than a phone call.',
    does: [
      {
        title: 'Written from what is actually running out',
        body: 'Pick lines from the reorder list and they become draft orders, grouped by supplier, sized from how fast things really sell and how long each supplier really takes.',
      },
      {
        title: 'Approved before it is placed',
        body: 'Spending limits by amount, for one supplier, one location or everything, each naming who signs. An order over the line waits under Sign-offs, and nothing can be booked in against it until somebody approves.',
      },
      {
        title: 'Turned down, with a reason',
        body: 'A refused order goes back to a draft with the note from whoever turned it down, ready to change and ask again, so the conversation is on the order rather than in a corridor.',
      },
      {
        title: 'What is on the way',
        body: 'Record what a supplier says they dispatched. It starts filled in with everything still outstanding, so a short shipment is one edit, and the delivery is filled in from it when the van arrives.',
      },
      {
        title: 'A new date when they ring',
        body: 'Record the date a supplier now promises. If that one is missed too, the order is flagged as late again.',
      },
      {
        title: 'Overdue, biggest first',
        body: 'Orders past their due date, the one with the most money still outstanding at the top. Orders nobody gave a date are counted, not quietly left off.',
      },
      {
        title: 'Received against the order',
        body: 'Scan it in. Part-deliveries leave the rest outstanding rather than closing the order and losing the remainder.',
      },
      {
        title: 'And what went back',
        body: 'Goods returned to a supplier, with the credit they owe you as a dollar figure at the top of the list, so it is not something one person remembers until they leave.',
      },
    ],
  },
  {
    heading: 'The price on the invoice is not the price you agreed.',
    body: 'This is where margin leaks: quietly, a few percent at a time, in freight nobody spread across the goods and price rises nobody noticed. Partners keeps what you ordered, what arrived and what you were billed side by side, and spreads the cost of getting goods here across the goods, so an item’s cost is its real cost.',
    does: [
      {
        title: 'Every line of the bill, checked',
        body: 'A supplier’s invoice set against the order and the delivery, line by line, with the verdict in words beside the three numbers it came from.',
      },
      {
        title: 'A difference cannot be waved through',
        body: 'A bill with something unexplained cannot be approved until somebody accepts the difference with a written reason, or queries it with the supplier.',
      },
      {
        title: 'Freight, duty and the broker, spread properly',
        body: 'Freight on the order, and a customs or duty bill that arrives later, shared across what was delivered, so a cheap item shipped expensively stops looking cheap.',
      },
      {
        title: 'What you planned against what you paid',
        body: 'Your expected cost per item against what it actually cost to land, so a price creeping up by cents shows up this quarter rather than in next year’s profit.',
      },
      {
        title: 'Cheaper by the case',
        body: 'What a supplier charges at each quantity, and an order picks up the right price for the amount you are buying.',
      },
      {
        title: 'Several suppliers for one thing',
        body: 'Who else can supply it and at what price, with your go-to marked, so a shortage or a price rise has an alternative you can see.',
      },
      {
        title: 'Stock you have not paid for yet',
        body: 'Goods a supplier lets you hold and pay for only once they sell. What you owe them builds up as it sells, and a period cannot be settled while any of it has no price.',
      },
    ],
  },
  {
    heading: 'Everything you know about a supplier, on one page.',
    body: 'Most businesses keep their suppliers in three places: a phone, an old email, and the head of whoever does the ordering. A supplier here is one record with who to ask for, how you pay them, what you buy from them and at what price, and what they have actually delivered, so the next person to do the ordering starts from what you know rather than from nothing.',
    does: [
      {
        title: 'Who to ask for',
        body: 'The contact name, email, phone, website and address, kept with everything else about them.',
      },
      {
        title: 'How you pay them',
        body: 'Your terms with them, and the days they say an order takes, which is where a due date comes from when you do not type one.',
      },
      {
        title: 'What they say against what they do',
        body: 'The delivery time they quote beside the average they have actually managed on your orders, so you can plan on the real one.',
      },
      {
        title: 'How they rank',
        body: 'On time, in full, at the agreed price and undamaged, worked out from your own orders. A supplier with too little history to judge says so rather than scoring zero.',
      },
      {
        title: 'Every order you have placed with them',
        body: 'The recent ones on their page, each showing what is still to arrive.',
      },
      {
        title: 'Their stock numbers, read for you',
        body: 'If a supplier or a store room keeps its levels in a spreadsheet at a web address, Piggles fetches it on a schedule and keeps your numbers in step.',
      },
      {
        title: 'Retired, not deleted',
        body: 'Stop using a supplier and their history stays, so last year’s orders still say who they were from.',
      },
    ],
  },
  {
    heading: 'Selling things that never come near you.',
    body: 'Having a supplier ship straight to your customer is a genuinely good idea that goes wrong in the arithmetic: it is easy to list their catalog and hard to know what you actually made once they have taken their cut. Here the supplier’s products, your pricing rule and the real cost stay visible together, and the order goes to them without you retyping it.',
    does: [
      {
        title: 'Their catalog, your prices',
        body: 'Bring in a supplier’s products and set one pricing rule for them: a percentage on top, a multiple of the cost, a fixed amount, or the share of each sale you want to keep. Rounded to the cent, the dollar or five dollars.',
      },
      {
        title: 'The order goes straight to them',
        body: 'When a customer buys, the order goes over to the supplier who holds it, and the tracking number comes back onto the customer’s order.',
      },
      {
        title: 'Any supplier with a spreadsheet',
        body: 'For a supplier with nothing to connect to, point Piggles at the product list they publish. Their products come in, and you place those orders with them yourself.',
      },
      {
        title: 'The ones that went wrong',
        body: 'A supplier order that could not be sent is marked as needing attention, rather than waiting quietly while your customer does.',
      },
      {
        title: 'What you actually made',
        body: 'Profit and margin on what suppliers ship for you, by product and by supplier, kept apart from the stock you hold, with the ones losing money marked.',
      },
      {
        title: 'Do they actually ship it',
        body: 'How quickly each supplier gets orders out, beside what they cost you, because a cheap supplier who is always late costs you in refunds.',
      },
      {
        title: 'Sold beside everything else',
        body: 'It is one catalog and one order list. A customer buying something you hold and something a supplier ships is placing one order, not two.',
      },
    ],
    // All four have live adapters in @wizeworks/dropship's VENDOR_CATALOG, which
    // lists only self-serve integrations, and nothing in Piggles hides them. The
    // spreadsheet feed is described above rather than named here.
    connects: ['Printify', 'Printful', 'DSers', 'Spocket'],
  },
];
