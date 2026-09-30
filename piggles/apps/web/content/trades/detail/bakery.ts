import type { TradePage } from '../types';

export const BAKERY_DETAIL: Pick<TradePage, 'replaces' | 'inDepth' | 'switching' | 'cost'> = {
  replaces: [
    {
      today: 'a whiteboard bake list and a notebook of preorders by the phone',
      instead: 'sell',
      why: 'Counter sales, website orders, café orders and preorders land in one list. A preorder is held as a real commitment, so the Saturday birthday cake cannot slide off the bottom of a page.',
    },
    {
      today: 'a separate till app for the counter',
      instead: 'sell',
      why: 'The counter rings up into the same order list as everything else, and the money goes through the payment provider you already use, straight into your own account.',
    },
    {
      today: 'a spreadsheet of which café owes what',
      instead: 'invoices',
      why: 'Each café on agreed terms gets a due date counted from the day it receives the bill, part payments are recorded as they arrive, and the overdue list says who is late and by how long without you working it out.',
    },
    {
      today: 'a clipboard on the storeroom door for flour, butter and boxes',
      instead: 'stock',
      why: 'Reorder points come from how fast you really use each thing and how long the supplier really takes, so you order rye before the last sack, not after it.',
    },
    {
      today: 'an evening with a calculator working out whether the croissants pay',
      instead: 'money',
      why: 'Sales, refunds and the cost of what went into each order are already in one place, so what each order made is a screen you open, not a sum you do.',
    },
  ],
  inDepth: [
    {
      app: 'sell',
      heading: 'Every way a loaf leaves the building, in one order list.',
      body: 'A bakery sells four ways before lunch: across the counter, on the website, to a café on account and as a preorder for Saturday. Sell treats every one of them as an order from the same catalog, so the bake list for tomorrow is one list, not four.',
      points: [
        'A single loaf, a box of six and a whole tray can each be an option on one product, and anything sold by weight is priced by weight instead of rounded to the nearest bag.',
        'Gift cards are kept as a real balance, so a card bought in December is still worth the right amount when somebody brings it back in March.',
        'When a new café asks what twenty baguettes a day would cost, you send a quote, and once they accept it becomes their order without anybody retyping a line.',
        'The household that takes a sourdough every Friday can be set up as a repeat order, paused for their vacation, skipped for a week or changed to two loaves.',
        'Discounts follow rules you can predict: a quantity break for a baker’s dozen, or a code for the first week of a new menu, with dates and limits set in advance.',
        'Sales by product and by day answer the question the whiteboard never kept, which is which days the rye flies and which days it drags.',
      ],
    },
    {
      app: 'stock',
      heading: 'Run out of the right things less, and throw away less.',
      body: 'Flour, butter, eggs, boxes and jars all move at different speeds. Stock keeps an honest count of each one, tells you what is about to run out at the rate you really use it, and keeps what is promised apart from what is free to sell.',
      points: [
        'What is on the shelf, what is already promised to a preorder and what is free to sell are kept apart, so the last box of macarons is not sold at the counter to somebody who did not order it.',
        'Flour bought in fifty-pound sacks and used by the pound, or butter bought by the case and used by the block, converts on its own, because buying and using do not have to share a unit.',
        'The storeroom can be broken down into shelves with printed labels, so "we have two sacks of rye" also tells the new starter where to find them.',
        'Jams, granola and anything else you pack in batches carry their batch and expiry date, including which batch went to which café.',
        'A few lines are counted each week on a schedule, and the difference is shown before it is saved, so the stocktake stops eating a whole Sunday.',
        'The specialty sugar that has sat there since spring shows up as not moving, along with what it is costing you to keep it.',
      ],
    },
    {
      app: 'money',
      heading: 'See what the week left you, not just what it took.',
      body: 'The till total is the cheerful number. Money reads the sales, the refunds, the ingredients and the standing costs that are already in Piggles, and states what the bakery actually kept, in words rather than accountant columns.',
      points: [
        'Rent, the oven lease, insurance and the delivery van are entered once as repeating costs, so they are in every month’s picture without being typed twelve times.',
        'Bills from the mill and the dairy show when they fall due, so they get paid on time instead of discovered in a pile of envelopes.',
        'Money the cafés owe is listed by how old it is, so chasing starts with the account that has been sitting longest rather than the one you happened to remember.',
        'Takings are split by where the sale happened, with what was sold, refunded and still unpaid side by side, so you can see whether the cafés, the counter or the website carried the week.',
        'This month’s takings and what you kept sit beside last month’s, so a slow January reads as slow against December, not as a feeling.',
        'Hand your bookkeeper a spreadsheet of your spending with every column labeled and their account codes on each line, instead of a shoebox of receipts.',
      ],
    },
  ],
  switching: [
    {
      title: 'Bring over what is already written down',
      body: 'Open Move in and pick the system you are leaving, or drop in your own spreadsheet of products, customers or the cafés you supply. Piggles guesses what each column means, you correct anything it got wrong, and you see exactly what will be created before anything is saved.',
    },
    {
      title: 'Fix the rows it could not read',
      body: 'Anything that could not come across is listed with its row number from your own file. Download that list, fix it next to your data, and drop the file in again. Every past move is kept, so you can always see what came over and when.',
    },
    {
      title: 'Type in what lives on paper',
      body: 'Open café invoices and the preorders in the notebook do not come across from a file today, so you add those by hand. For most bakeries that is a short list, and after it is in, it lives in one place.',
    },
  ],
  cost: {
    heading: 'One price for the counter, the cafés and the numbers.',
    body: '$99 a month covers selling, stock, invoices, your numbers and every other app, sixteen in all. Taking preorders or selling to cafés never costs extra. What can change the bill is room, not features.',
    points: [
      'One business, one location, one main website and three people with their own sign-in are included, so you, a counter assistant and a second baker are covered.',
      'Products, orders and invoices are unlimited, so a busy December costs the same as a quiet February.',
      'Order emails do not count toward the 5,000 emails a month included for your own announcements, like the note about Saturday’s new bun.',
      '10,000 customer records and 10 GB for photos and files are included. More room, more people or a second shop is added in one tap with the price on the button, and removed the same way.',
      'Card fees are between you and the payment provider you already use. Piggles never sits in the middle of the money.',
      'Fourteen days free with no card needed. If you do not carry on, nothing is charged.',
    ],
  },
};
