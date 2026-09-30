import type { TradePage } from './types';
import { SUPPLIER_DETAIL } from './detail/supplier';

export const SUPPLIER: TradePage = {
  slug: 'supplier',
  pose: 'supplier',
  group: 'money',
  name: 'A supplier',
  plural: 'Suppliers',
  shape:
    'You sell to other businesses, on account, at prices that are not the ones on the website. Terms, purchase orders and who owes what are the whole relationship.',
  leans: ['sell', 'customers', 'invoices'],
  ...SUPPLIER_DETAIL,
  heading: 'Sell to businesses at their price, on their terms, without a second system.',
  lede: 'Your customers do not browse and pay by card. They expect their own price, order against an account, need somebody on their side to sign off, and pay at the end of the month. Piggles runs all of that on the same catalog as everything else, so the price lists, the balances and who owes what are one set of records instead of four.',
  searchTerms: [
    'wholesale ordering software',
    'B2B ordering portal',
    'wholesale invoicing software',
    'customer specific pricing software',
    'net 30 invoicing software',
    'small distributor software',
    'wholesale order management',
    'B2B ecommerce for small business',
  ],
  problems: [
    {
      title: 'Every account has its own price, and it lives in a spreadsheet.',
      body: 'The garden center gets one price, the café group another, and the new account is on whatever you agreed in an email last spring. Every order means looking it up, and every look-up is a chance to charge the wrong one.',
    },
    {
      title: 'Orders arrive by email, phone and text message.',
      body: 'Somebody retypes them. Somebody else asks whether that buyer was allowed to order that much. Then the quote they accepted last week has to be dug out so the order matches it.',
    },
    {
      title: 'Who owes what is a feeling, not a figure.',
      body: 'Terms are thirty days, except for the accounts where they are not. Reminders go out when somebody remembers, and the account that is already over its limit keeps getting deliveries because nobody was watching the balance.',
    },
    {
      title: 'You bolted a wholesale add-on onto a shop and ran the rest by hand.',
      body: 'The website sells to the public, a separate app handles trade pricing, invoices happen in accounting software, and the stock figure is whichever one was updated last. Four systems, and you are the thing holding them together.',
    },
  ],
  turn: 'A trade account is a relationship, not a basket, so its price, its credit, its sign-off and its balance should all live on the account itself.',
  week: [
    {
      when: 'Monday, 7am',
      body: 'Home lists what is waiting on you before the phones start: orders waiting to go out, two invoices that have gone late, and a line that is running low. Each one opens the list behind it.',
      app: 'home',
    },
    {
      when: 'Monday, 9am',
      body: 'Three trade accounts ordered on your site over the weekend, each at their own agreed price, applied at checkout without anybody looking it up. One is over the value their side needs to approve, so it waits in a queue for their buyer instead of going out and being argued about later.',
      app: 'sell',
    },
    {
      when: 'Tuesday, 10am',
      body: 'Picking starts. The walk through the shelves is ordered by where things are, not by the order they were typed, and each box is scanned as it is packed. The two cases you could not fill are held as a backorder and allocated first when stock arrives, so the customer who waited longest is not last.',
      app: 'stock',
    },
    {
      when: 'Wednesday, 2pm',
      body: 'Your own supplier’s bill comes in. The price on it is not the price you agreed, and Partners flags it for a person to look at instead of absorbing it into your cost. The freight is spread across what was in the delivery, so the cost of each line is what it took to land it.',
      app: 'partners',
    },
    {
      when: 'Thursday, 9am',
      body: 'A regional chain is close to opening an account. It sits on the board you keep for winning wholesale business, with what it is worth and the next step on a named person. Their company is one record, with the four people who will order for it linked underneath.',
      app: 'customers',
    },
    {
      when: 'Friday, 3pm',
      body: 'Month end. Wholesale invoices are raised against each account, each due date counted from the day the account receives the bill, and the overdue ones get a reminder that is firm and polite without you writing it. Payments settle against the balance, part payments included.',
      app: 'invoices',
    },
    {
      when: 'Friday, 4pm',
      body: 'Next month’s price changes go to your wholesale list, a group that keeps itself current, from your own email address. You can see who opened it before anyone calls to ask.',
      app: 'messages',
    },
  ],
  firstHour: [
    'Enter your business name, address and tax details once. They appear on your invoices and documents from then on.',
    'Bring your trade customers in from a spreadsheet, with a preview before anything is written, and link each buyer to the company they order for.',
    'Set up price tiers for your groups of customers, then the agreed prices for the accounts that have their own.',
    'Give each account its payment terms and a credit limit.',
    'Place a test order as one of those accounts and check that their price is the one that comes up at checkout.',
  ],
  questions: [
    {
      q: 'What does it cost, and is the wholesale side extra?',
      a: 'Piggles is $99 a month, flat, and the wholesale side is part of Sell, which is one of the sixteen apps included. There is no trade module to add. The price covers one business, one location, one website and three people with their own sign-ins. More storage, email, customer records or people can be added when you need them. The first 14 days are free and you do not enter a card.',
    },
    {
      q: 'Can I sell to the public and to trade customers from the same catalog?',
      a: 'Yes, and that is the point. It is one catalog and one order list. Price tiers for groups and agreed prices for individual accounts apply automatically at checkout, so a trade account gets its price and a retail customer gets the shelf price, from the same product record.',
    },
    {
      q: 'Can I control who buys on credit, and how much?',
      a: 'Each account has payment terms, a credit limit and a running balance, so an order can go out before the money comes in, deliberately and within a limit you set. You can also set rules for what needs approving on their side (over a value, or outside an agreement) and those orders wait in a queue for whoever signs off.',
    },
    {
      q: 'We already have customers, products and an accountant. What happens to all that?',
      a: 'Customers, products, stock and past orders come in from a spreadsheet or another system, with what will happen shown row by row before anything is written. Your accountant stays, and so do your books: Money hands them a spreadsheet of your spending with every column labeled and their account codes on each line.',
    },
    {
      q: 'Does any of this work away from a desk?',
      a: 'The warehouse parts do. Receiving, picking, packing, counting and moving stock between places all work from a barcode on a phone, with a stripped-back screen meant for one free hand. Customers who order on your site get a checkout that works on a phone too.',
    },
    {
      q: 'What happens when we add people or a second warehouse?',
      a: 'Three people are included, each with their own sign-in. Access follows the job: the warehouse role never sees what anything cost, and pay rates and wage costs are for owners and admins only. More people and more locations are added as you need them, and Stock keeps a count per place with transfers between them. Orders and invoices are unlimited, so selling more is never a reason to change plan.',
    },
  ],
};
