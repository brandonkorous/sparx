import type { TradePage } from '../types';

// The deeper half of /for/supplier. Every capability below is one content/apps/*.ts
// already states (sell.ts for price tiers, agreed prices, credit and sign-off;
// partners.ts for buying in). `switching` was checked against the console's Move in
// screen (piggles/apps/workbench/surfaces/migration): customers, companies,
// products, stock by location, suppliers and past orders import from a file. Price
// tiers, agreed prices, terms, credit limits and invoices already sent are set up
// by hand, and the copy says so.

export const SUPPLIER_DETAIL: Pick<TradePage, 'replaces' | 'inDepth' | 'switching' | 'cost'> = {
  replaces: [
    {
      today: 'a spreadsheet of which account pays which price',
      instead: 'sell',
      why: 'Somebody has to look it up on every order, and every look-up is a chance to get it wrong. Here the agreed price is on the account and applies itself at checkout.',
    },
    {
      today: 'invoices written in a word processor, and chased when somebody remembers',
      instead: 'invoices',
      why: 'Terms only work if somebody is watching the balance. Invoices counts each due date from the day the bill is sent, shows what is owed and how late, and chases the late ones on its own.',
    },
    {
      today: 'a contact list in one person’s phone, with notes on who orders for which company',
      instead: 'customers',
      why: 'When that person is on vacation, so is the relationship. A company record with its buyers linked underneath is there for whoever picks up the phone.',
    },
    {
      today: 'a clipboard and a printed pick list',
      instead: 'stock',
      why: 'A route ordered by where things sit on the shelves, checked by scanning as each box is packed, catches the wrong case at the bench instead of at the customer’s door.',
    },
    {
      today: 'purchase orders to your own suppliers sent from a personal inbox',
      instead: 'partners',
      why: 'An order in somebody’s sent folder cannot tell you it is overdue. In Partners it is received against, part-received and flagged when late.',
    },
    {
      today: 'a separate newsletter tool for price-change notices',
      instead: 'messages',
      why: 'The list in there was out of date the day you made it. Your wholesale group here keeps itself current, and the email goes out from your own address.',
    },
  ],
  inDepth: [
    {
      app: 'sell',
      heading: 'Every account sees its own price, from the same catalog.',
      body: 'Trade customers expect the price you agreed, the ability to order on account and a person on their side who signs off. Sell does all of that on the catalog you already keep for everybody else, so there is no second system to update when a price changes.',
      points: [
        'Price tiers cover groups of customers and agreed prices cover individual accounts, and both apply at checkout without anybody looking them up.',
        'Quantity breaks and bulk offers follow rules stated plainly, so a buyer ordering forty cases can predict what forty cases will cost.',
        'A buyer can accept a quote and have it become an order without retyping, and the link between the two is kept for the day somebody asks why the price was different.',
        'Orders over a value, or outside an agreement, wait in a queue for whoever signs off on the buyer’s side instead of going out and being disputed later.',
        'Each account orders against a credit limit and payment terms you set, with a running balance, so extending credit is a decision rather than an accident.',
        'Wholesale invoices are raised against the account, chased when they are late and settled against its balance, so the money for a trade order sits on the same record as the order.',
      ],
    },
    {
      app: 'customers',
      heading: 'A company is one relationship, however many people order for it.',
      body: 'A trade account is rarely one person. It is a buyer, somebody who approves, somebody in accounts and a new hire who does not know your name yet. Customers keeps them together under the company, with orders, invoices, emails and notes on their records rather than in somebody’s head.',
      points: [
        'People are linked to the company they order for, so a chain with six buyers is one account with six names rather than six strangers.',
        'Winning new accounts gets a board of its own, separate from any other kind of work, with what each is worth and the next step on a named person.',
        'Tasks carry a date and an owner, so “I will call them after the trade show” is something that exists instead of an intention.',
        'Questions and complaints are assigned to a person with a time they should be answered by, and the reply you send from the request lands on that buyer’s record as well.',
        'Connect your mailbox and emails from buyers land on their records every few minutes, and a call made from a record is kept with who, when and how long, not typed up afterward.',
        'Groups that keep themselves current, like every account that has not ordered in ninety days, are ready to write to without anybody rebuilding a list.',
      ],
    },
    {
      app: 'invoices',
      heading: 'Month end, without the spreadsheet of who owes what.',
      body: 'Wholesale is paid on terms, so the invoice is only the start. Invoices counts the due date from the day the bill goes out, records part payments and chases the late ones, and the balance on each account is always the real one.',
      points: [
        'Wholesale invoices are raised against the account and settled against its balance, so the figure on the account is what that customer actually owes.',
        'What you are owed and how much of it is late sit above the list, counted across every open invoice, and the late-only view, biggest first, can be saved for Monday mornings.',
        'Part payments land on the right invoice, and whatever is left stays open rather than disappearing into a note.',
        'When a buyer approves a price, an exact copy is kept, so the version they agreed to still prints the way it stood if anybody asks later.',
        'Overdue accounts are listed by how late they are, with a reminder that is firm and polite without anybody drafting it.',
        'An agreement that needs a signature goes out from here, and the signed copy stays attached to the record.',
      ],
    },
  ],
  switching: [
    {
      title: 'Bring the customer list and the catalog across.',
      body: 'Open Move in. For several of the common online shop and website builders, it names the exact file to export and the menu it hides in. Anything else comes in as a spreadsheet: say what each column means and see what happens to every row before a thing is saved. Customers, companies, products, stock by location, your own suppliers with their lead times and costs, and past orders all come across this way.',
    },
    {
      title: 'Set up each trade account by hand.',
      body: 'Price tiers, each account’s agreed prices, payment terms and credit limits are typed in on Piggles, account by account. It is the slow step and the one worth doing carefully, because it decides what every future order costs. Finish it before your first trade customer orders on the new site, then place a test order as one of them and check the price that comes up.',
    },
    {
      title: 'Start the balances clean.',
      body: 'Invoices already sent from your old system are not brought across. Let them be paid where they are, and raise every new invoice from Piggles from the day you switch, so balances here start clean. For the first month, check the old system for anything still owed before you give an account more credit.',
    },
  ],
  cost: {
    heading: 'The wholesale side is in the price, not on top of it.',
    body: 'Piggles is $99 a month, flat. That covers trade pricing, credit, sign-off and wholesale invoices, the retail side on the same catalog, and the other fifteen apps. Selling more is never the reason the bill changes. Needing more room is.',
    points: [
      'The $99 covers one business, one location, one website on your own domain, and three people with their own sign-ins.',
      'Products, orders and invoices are unlimited, so a heavy month end or a catalog of two thousand lines costs the same as a quiet one.',
      'Room for 10,000 customer records, which counts the people and the companies you deal with, and 10 GB of storage for product photos, spec sheets and documents.',
      '5,000 email sends a month for things like price-change notices. Order and booking emails do not count toward them.',
      'A warehouse on top of your shop is an added location, and a fourth person packing orders is an added seat. Each is one tap with the price on the button, and removable the same way.',
      'The first 14 days are free with no card, long enough to set up your price tiers and place a test order as a real account.',
    ],
  },
};
