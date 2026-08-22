import type { AppMarketing } from './types';

// Stock fronts more screens than any other app — 53 — and had six bullets, the
// same as Invoices with three. The chapters below are the shape of the job
// rather than the shape of the software: where it is, how it is counted, how it
// leaves, what it is worth, and what you should be worrying about next.
//
// DELIBERATELY ABSENT: suppliers, purchase orders and receiving. Those screens
// live in the platform's inventory module, and Piggles advertises them as
// Partners (see `claims` in @piggles/config). Describing them here would give a
// reader two doors into one room and make the Partners page look like a
// duplicate of this one.

export const STOCK: AppMarketing = {
  heading: 'Know what you have, where it is, and when to order more.',
  lede: 'Stock is the honest count. It tracks what came in, what went out, what is on a shelf versus promised to somebody, and tells you what to reorder before you find out by selling something you do not have.',
  alsoKnownAs: ['inventory management', 'warehouse management', 'stock control', 'WMS'],
  does: [
    {
      title: 'One number you can trust',
      body: 'What is physically there, what is already spoken for, and what is genuinely available to sell — kept apart, because treating them as one number is how you oversell.',
    },
    {
      title: 'More than one place',
      body: 'A shop, a back room, a van and a unit across town. Move things between them and keep the count right in both.',
    },
    {
      title: 'Down to the shelf',
      body: 'Bins and locations, so "we have four" also answers "where". Barcode scanning for receiving, picking, packing and counting.',
    },
    {
      title: 'Counting without closing',
      body: 'Rolling counts on a schedule, or a full stocktake. Enter what you found, see what it differs from, and approve the correction.',
    },
    {
      title: 'Reorder before you run out',
      body: 'Reorder points worked out from what actually sells and how long a supplier actually takes — not a number somebody guessed in the first month.',
    },
    {
      title: 'What it really cost',
      body: 'Landed cost including freight and duty, batch and serial tracking for the things that need it, and a valuation you can hand to an accountant.',
    },
  ],
  chapters: [
    {
      heading: 'Four is not an answer. Four, on the second shelf, is.',
      body: 'Most stock software will tell you a number. The number is only useful if somebody can walk to the thing, which means knowing which building, which aisle and which shelf — and knowing that when it moves, the record moved with it. Stock goes down to the shelf, and everything that changes a count leaves a trace with a name on it.',
      does: [
        {
          title: 'As many places as you actually have',
          body: 'A shop floor, a back room, a lock-up, a van. Each holds its own count, and the total is the sum rather than a figure kept separately.',
        },
        {
          title: 'Shelves, aisles and bins',
          body: 'Break a location down as far as is useful, and print the labels for it. "Where is it" stops being a question you ask the one person who knows.',
        },
        {
          title: 'Moving it between them',
          body: 'Raise a transfer, send it, receive it. It is in transit in between rather than missing from one place and not yet in the other.',
        },
        {
          title: 'Every change, with a reason and a name',
          body: 'Sold, returned, damaged, counted, moved, built. The history is why a discrepancy is a question with an answer instead of an argument.',
        },
        {
          title: 'Batches and serial numbers',
          body: 'For the things that need it: which batch went to which customer, when it expires, and which exact unit somebody is holding a warranty claim on.',
        },
        {
          title: 'Stock that is not yours',
          body: 'Consignment and customer-owned goods held separately, so your valuation is what you own rather than what is in the building.',
        },
      ],
    },
    {
      heading: 'A scanner beats a clipboard, and it beats memory entirely.',
      body: 'Typing product codes is where stock records go wrong — not dramatically, but a digit at a time, until the number on the screen and the number on the shelf have quietly diverged and nobody knows when it started. Scanning removes the typing. Receiving, putting away, picking, packing, counting and transferring all work from a barcode, on a phone.',
      does: [
        {
          title: 'Every code a thing already has',
          body: 'The manufacturer’s barcode, your own, the one the supplier prints. All of them find the same product, because in real life a thing has more than one code.',
        },
        {
          title: 'Warehouse mode',
          body: 'A stripped-back screen for a phone in a cold room with one hand free. Scan, confirm, next — not a desktop layout squeezed onto a handset.',
        },
        {
          title: 'When two things share a code',
          body: 'Duplicate barcodes are found and listed rather than silently resolving to whichever record was created first.',
        },
        {
          title: 'Labels you can actually print',
          body: 'Product and shelf labels, in the sizes real label printers use.',
        },
      ],
    },
    {
      heading: 'Counting it without shutting for the day.',
      body: 'A full stocktake is a day of trading lost, so it happens once a year and the records drift for the other 364. Rolling counts fix that: a handful of lines a week, chosen by what matters and what moves, entered as what was actually found — with the difference shown before anything is committed, and the correction approved by a person.',
      does: [
        {
          title: 'Count a corner, not the building',
          body: 'Counts scoped to a location, a shelf or a group of products, on a repeating schedule so everything comes round without anybody planning it.',
        },
        {
          title: 'What you found versus what was expected',
          body: 'The variance is shown before you commit, so a miscount is caught as a miscount rather than posted as a loss.',
        },
        {
          title: 'Approved, then posted',
          body: 'A correction is a decision with a name on it. Nothing rewrites a count silently.',
        },
        {
          title: 'Bulk changes without a hundred clicks',
          body: 'Edit levels in a grid, or import from a spreadsheet with a preview of what will change before anything is written.',
        },
        {
          title: 'Does it agree with the books',
          body: 'Stock value reconciled against what your accounts say it should be, with the differences listed rather than left as one number that is out.',
        },
        {
          title: 'Checks on the records themselves',
          body: 'Negative levels, orphaned movements, quantities that could not have happened. Found and reported instead of sitting there being wrong.',
        },
      ],
    },
    {
      heading: 'Getting it out of the door, in the right order.',
      body: 'Picking is where a good stock record turns into a shipped parcel or a wasted twenty minutes. Walks are ordered by where things physically are rather than by the order the customer typed them, packing is checked as it happens, and the things you could not fill are held as a promise to somebody instead of quietly disappearing.',
      does: [
        {
          title: 'Picks ordered by the building',
          body: 'A route through the shelves rather than a list in basket order, so one walk collects several orders without doubling back.',
        },
        {
          title: 'Packed against the order',
          body: 'Scan as it goes in the box. The wrong item is caught at the bench rather than by the customer.',
        },
        {
          title: 'What you could not fill',
          body: 'Backorders and preorders held as real commitments, allocated first when stock arrives, so the person who waited longest is not last.',
        },
        {
          title: 'How fast it is actually going',
          body: 'Picking and packing throughput, so a bad week is visible as a bad week rather than as a general feeling that things are behind.',
        },
      ],
    },
    {
      heading: 'The reorder point nobody guessed.',
      body: 'Most reorder levels were typed in during the first month and never revisited, which is why businesses run out of the thing that sells and hold a year of the thing that does not. These are worked out from what this business actually sold and how long its suppliers actually took — and the screens are arranged around the question you have, which is usually "what should I be worried about".',
      does: [
        {
          title: 'What is about to run out',
          body: 'Ranked by how soon, at the rate it is genuinely selling, against how long it genuinely takes to arrive.',
        },
        {
          title: 'What actually matters',
          body: 'The small number of lines that make most of the money, separated from the long tail — so effort goes where it changes something.',
        },
        {
          title: 'What is not moving',
          body: 'Stock that has not sold, what it is costing you to keep it there, and what it is worth writing down.',
        },
        {
          title: 'What is about to go out of date',
          body: 'Expiry dates surfaced while there is still time to discount it rather than after it has to be thrown away.',
        },
        {
          title: 'Buffers you set deliberately',
          body: 'Safety stock and lead-time assumptions you can state and change, rather than a black box producing a number you have to trust.',
        },
        {
          title: 'The reports, sent to you',
          body: 'The ones you check weekly, scheduled and emailed, so a routine question stops being a thing you have to remember to ask.',
        },
      ],
    },
    {
      heading: 'What it is worth, and what you built from it.',
      body: 'Two things a spreadsheet cannot really do: value the stock consistently enough to hand to an accountant, and cope with a product that is made out of other products. Both are here — the valuation method is a stated choice rather than an accident, and a thing you assemble knows what it is made of and what that means for the parts.',
      does: [
        {
          title: 'Valued a way you chose',
          body: 'The costing method is set deliberately and applied consistently, with a valuation you can produce as at a date rather than only as at today.',
        },
        {
          title: 'What it cost to get here',
          body: 'Freight, duty and handling spread across the delivery, so an item’s cost includes getting it to your shelf.',
        },
        {
          title: 'Things made of other things',
          body: 'Recipes for what goes into an assembly, how many you could build from what is on hand, and runs that consume the parts and produce the result.',
        },
        {
          title: 'Sold by the metre, bought by the roll',
          body: 'Units of measure that convert, so buying and selling do not have to use the same one.',
        },
        {
          title: 'Your own columns',
          body: 'The fields your trade needs and nobody else does, on the stock record, searchable like everything else.',
        },
      ],
    },
  ],
  worksWith: ['sell', 'partners', 'money'],
  photo: {
    src: '/photos/garage.jpg',
    alt: 'A car on a lift above a working bench of tools and a toolbox',
  },
};
