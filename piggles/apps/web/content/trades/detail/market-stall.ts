import type { TradePage } from '../types';

// Market stall depth: what it replaces, the three leaned-on apps, moving over, and
// cost. No card reader, tap-to-pay or offline claims: content/apps makes none.

export const MARKET_STALL_DETAIL: Pick<TradePage, 'replaces' | 'inDepth' | 'switching' | 'cost'> = {
  replaces: [
    {
      today: 'a notebook tally of what sold',
      instead: 'sell',
      why: 'Every sale recorded in Sell lands in one order list beside your website orders and comes off the stock count, so the tally keeps itself while you serve.',
    },
    {
      today: 'a stock spreadsheet you update on Sunday night',
      instead: 'stock',
      why: 'Stock changes as things sell, wherever they sell, so Sunday night is for counting what came back rather than rebuilding a spreadsheet from memory.',
    },
    {
      today: 'a shoebox of receipts for pitch fees and supplies',
      instead: 'money',
      why: 'Each cost is recorded to a category you named, the day you pay it, so the profit figure has the pitch fee taken off instead of a shoebox waiting for April.',
    },
    {
      today: 'a notes app full of regulars and their usual orders',
      instead: 'customers',
      why: 'Each regular has one record with what they bought and what you promised them, and a group like “bought in the last 90 days” stays current on its own.',
    },
    {
      today: 'a website a friend set up that you cannot change',
      instead: 'site',
      why: 'You update this month’s markets yourself in My Site from your phone, and the site reads properly on the phone your customers will open it on.',
    },
    {
      today: 'posting to each social app by hand',
      instead: 'get_found',
      why: 'Fill your standing posting times for the month in one sitting, and the markets you are at go out on every network without you opening each app.',
    },
  ],
  inDepth: [
    {
      app: 'sell',
      heading: 'Every sale counts, at the table or online at midnight.',
      body: 'A stall usually ends up selling in more than one place: the table on Saturday, a website for the regulars, a café that takes a standing order. Sell keeps one catalog and one order list for all of them, so a sale is a sale wherever it happened.',
      points: [
        'Products can carry sizes, flavors and options, be sold by weight, or come as a bundle, so a mixed box is one product rather than a note on a card.',
        'Quantity breaks, like a lower price per jar when somebody takes six, are set once as a rule, so the price is right whoever is serving.',
        'Your website’s checkout works on a phone, so somebody who missed you on Saturday can still order that evening.',
        'A café or shop that buys from you regularly can have its own agreed prices and order on account, from the same catalog as the table.',
        'A return goes back into stock and the refund shows in the money, once, with no correction afterwards.',
        'Sales by product and by day show which market your best seller actually moves at.',
      ],
    },
    {
      app: 'money',
      heading: 'Know whether Saturday was worth the 5am start.',
      body: 'Takings tell you how busy you were. Money tells you what was left once refunds, what the goods cost you and the costs you recorded come off, which is the number that decides whether a market is worth going back to.',
      points: [
        'The result is one figure: what sold, less refunds, the cost of the goods and the costs you recorded, in green when you kept money and red when you lost it.',
        'Takings are split by where the sale happened, so the table and the website each show what they brought in.',
        'Pitch fees, fuel and packaging are recorded to categories you name yourself, so the report reads like your stall.',
        'Repeating costs such as insurance or a storage unit are entered once and counted every month without retyping.',
        'Card takings are grouped into the deposit they should arrive in, with the sales inside each one, so you know what to look for on your bank statement.',
        'At tax time, hand your accountant a spreadsheet of your spending with every column labeled and their account codes on each line.',
      ],
    },
    {
      app: 'stock',
      heading: 'Pack the van knowing exactly what is in it.',
      body: 'Stall stock lives in crates, in the van and in the spare room, and it moves every weekend. Stock keeps a count you can trust without a clipboard, and it works on a phone in a cold car park.',
      points: [
        'The van, the spare room and a storage unit each keep their own count, and moving crates between them shows as in transit rather than missing.',
        'Scan the barcodes your goods already carry, or print your own labels in the sizes real label printers use.',
        'Count one crate or one shelf at a time on a repeating schedule, so everything gets counted without losing a whole day to it.',
        'Anything with a use-by date shows up while there is still time to discount it rather than throw it away.',
        'If you make what you sell, a recipe records what goes into it and how many you could make from what is on hand.',
        'Stock that has not sold in months is listed with what it is costing you to keep, so you can decide what to clear.',
      ],
    },
  ],
  switching: [
    {
      title: 'Bring in your product list.',
      body: 'Open “Move in from somewhere else” in your console and drop in your own spreadsheet, or the export from the online shop or card app you use now. Piggles guesses which column is the name, the price, the cost and the barcode, and shows what will happen to every row before anything is saved. Anything it cannot take is listed by row number, in a file you can open next to your spreadsheet and fix.',
    },
    {
      title: 'Set the counts you have today.',
      body: 'Quantities can come in with the products, or you can walk the crates with your phone and type in what you find. Either way, the first proper count after a market sets the numbers straight.',
    },
    {
      title: 'Connect payments, then your regulars.',
      body: 'Connect the payment provider you already use, so money keeps landing in your own account. An email list of regulars comes across the same way as the products, including whether each person agreed to hear from you. Anyone who only lives in your notebook is typed in as you next see them.',
    },
  ],
  cost: {
    heading: 'One price, whether you trade once a month or four days a week.',
    body: '$99 a month, flat, with every app included. Orders are unlimited, so the busiest weekend of the year never changes the bill. Try it free for 14 days without a card.',
    points: [
      'Unlimited products, so adding the new season’s range never triggers a bigger plan. There is no bigger plan.',
      'One website on your own address is included, with the security certificate handled for you.',
      'Up to 5,000 marketing emails a month are included, and order confirmations do not count toward that.',
      'Three people are included, so a partner and a Saturday helper each get their own sign-in.',
      'One location is included, and more can be added any time if the stall grows into a shop.',
      'Your payment provider charges its own card fees under your agreement with them. Money says plainly that those fees are not taken off its figures, so check them on your provider’s statement.',
    ],
  },
};
