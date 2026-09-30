import type { TradePage } from './types';
import { BAKERY_DETAIL } from './detail/bakery';

export const BAKERY: TradePage = {
  slug: 'bakery',
  pose: 'bakery',
  group: 'sell',
  name: 'A bakery',
  plural: 'Bakeries',
  shape:
    'You sell the same forty things every morning and they are gone by two. What matters is what is left, what sold out early, and never having to write the list twice.',
  leans: ['sell', 'stock', 'money'],
  ...BAKERY_DETAIL,
  heading: 'Know what sold out by ten, and bake more of it tomorrow.',
  lede: 'Piggles puts the counter, the preorders, the cafés that buy on account and the numbers at the end of the week in one place. It is $99 a month with every app included, so the list you write at five in the morning is the only list you write.',
  searchTerms: [
    'bakery software',
    'bakery POS software',
    'bakery ordering system',
    'bakery preorder software',
    'bakery inventory app',
    'wholesale bakery invoicing',
    'bakery website builder',
    'small bakery management software',
  ],
  problems: [
    {
      title: 'The list lives in three places',
      body: 'The bake list is on the whiteboard, the preorders are in a notebook by the phone, and the café that takes twenty baguettes a day is a text thread. Every morning somebody copies one into the other, and one morning they miss a line.',
    },
    {
      title: 'You find out what sold out by being asked for it',
      body: 'The Saturday sourdough was gone by ten and nobody wrote that down, so next Saturday you bake the same number again. The spreadsheet you started to keep track lasted two weeks.',
    },
    {
      title: 'Your best seller might be your worst earner',
      body: 'The croissants fly out, but butter went up in the spring and the price did not. Without the cost of what goes into each thing, busy and profitable look exactly the same.',
    },
    {
      title: 'Wholesale is a second business run from a shoebox',
      body: 'The cafés pay monthly, at their own price, and the invoices get written by hand on a Sunday night. Somebody is always a month behind, and nobody is quite sure who.',
    },
  ],
  turn: 'The counter, the preorders, the cafés and the numbers are one day of work, so they belong in one place.',
  week: [
    {
      when: 'Monday, 5am',
      body: 'Before the ovens are hot, Home counts what is waiting on you in plain sentences: website orders to get out, a café invoice that has gone late, and butter running low. Tap a line and the list behind it opens.',
      app: 'home',
    },
    {
      when: 'Monday, 9am',
      body: 'Flour, butter and cake boxes each have a reorder point worked out from how fast you really use them. Stock lists what is about to run out, and a recipe tells you how many loaves the flour on the shelf will actually make.',
      app: 'stock',
    },
    {
      when: 'Tuesday, 2pm',
      body: 'The mill bills you more per sack than the price you agreed. Partners flags the difference for you to look at, instead of it quietly becoming the new cost of every loaf.',
      app: 'partners',
    },
    {
      when: 'Wednesday, 8pm',
      body: 'Somebody orders a birthday cake for Saturday on your site, choosing the size, the sponge and the message. It lands in the same list as the counter sales and the café orders, held as a preorder so it gets baked, not forgotten.',
      app: 'sell',
    },
    {
      when: 'Thursday, 4pm',
      body: 'The three cafés you supply get their own agreed prices without anybody remembering them, and their invoices go out on their terms. Invoices shows who is late and by how long, and sends a polite reminder you did not have to write.',
      app: 'invoices',
    },
    {
      when: 'Friday, 7pm',
      body: "You write one post about tomorrow's cardamom buns, tick Instagram and Facebook, and schedule it for Saturday at 7am. It goes out while your hands are in the dough.",
      app: 'get_found',
    },
    {
      when: 'Sunday, 6pm',
      body: 'Money shows the week: what came in, less refunds, what the ingredients cost and the running costs. Every order is listed with what it made after its costs, worst first, so you find out which orders are carrying the rest.',
      app: 'money',
    },
  ],
  firstHour: [
    'Tell Piggles you run a bakery. You start with practice products, customers and orders shaped like a bakery, so you can click around something that looks real, then clear them all out with one button.',
    'Add the things you bake, with prices, sizes and anything you sell by weight. If they are already in a spreadsheet, bring it in and see a preview before anything is written.',
    'Connect the payment provider you already use, so card money keeps landing in your own account on the terms you have today.',
    'Pick a ready-made site, swap in your photos and opening hours, and publish. It runs on a free Piggles address until you point your own domain at it.',
    'Add the cafés you supply as trade customers with their agreed prices, so the right price is applied every time without anybody having to remember it.',
  ],
  questions: [
    {
      q: 'How much does Piggles cost for a bakery?',
      a: '$99 a month, flat. All sixteen apps are included: selling, stock, invoices, your website, your numbers and the rest. That covers one business, one location, one main website and three people with their own sign-in. Products, orders and invoices are unlimited. Try it free for 14 days, no card needed.',
    },
    {
      q: 'I already take cards at the counter. Do I have to change providers?',
      a: 'No. Piggles connects to the payment provider you already use, including Stripe, PayPal and Square. The money settles into your own account on the terms you already have, and Piggles never sits in the middle of it.',
    },
    {
      q: 'Can it handle preorders and custom cakes?',
      a: 'Yes. Preorders are held as real commitments, so they are not lost when the counter gets busy. Products can have options, and the ones a customer specifies rather than picks (size, flavor, the message on top) can be set up so they choose it themselves when they order.',
    },
    {
      q: 'Can I sell to cafés and restaurants on account?',
      a: 'Yes, without a second system. Each trade customer can have their own agreed prices, a credit limit and payment terms. Orders go out before the money comes in, within the limit you set, and Invoices chases the late ones politely for you.',
    },
    {
      q: 'Will it help with things that go out of date?',
      a: 'For anything you track with a date, like jars, packaged goods or ingredients, Stock shows what is about to expire while there is still time to discount it, rather than after it has to go in the bin.',
    },
    {
      q: 'What happens when the bakery gets busier?',
      a: 'Nothing switches off. If you need more room (more people on the team, more storage, more customer records, more email going out) you add it in one tap with the price on the button, and remove it the same way. Selling more is never a reason to change plans, because there is only one.',
    },
  ],
};
