import type { TradePage } from './types';
import { MARKET_STALL_DETAIL } from './detail/market-stall';

export const MARKET_STALL: TradePage = {
  slug: 'market-stall',
  pose: 'market-stall',
  group: 'money',
  name: 'A market stall',
  plural: 'Market stalls',
  shape:
    'You trade three days a week from a folding table with no counter and no back office. Everything has to work on a phone, standing up, with one hand.',
  leans: ['sell', 'money', 'stock'],
  ...MARKET_STALL_DETAIL,
  heading: 'Run the whole stall from the phone in your pocket.',
  lede: 'Piggles puts the sale, the stock count and the day’s takings on one phone screen. Saturday ends with a number you trust, instead of a tin of cash, a card app, a notebook tally and a guess.',
  searchTerms: [
    'market stall software',
    'farmers market vendor app',
    'craft fair point of sale',
    'market trader stock tracking',
    'pop up shop inventory app',
    'mobile vendor sales tracking',
  ],
  problems: [
    {
      title: 'The takings never match the tin.',
      body: 'Cash in the tin, cards in one app, a tally in a notebook. By the time you add them up on Sunday night you cannot tell whether the gap is a miscount, a card fee or a jar somebody walked off with.',
    },
    {
      title: 'You find out you have sold out when somebody asks for it.',
      body: 'The stock count lives in your head and in whatever is left in the crates. Your best seller runs out at eleven on the busiest morning of the month, and you only learn how much you could have sold when people start walking away.',
    },
    {
      title: 'Three tools and a spreadsheet that never talk.',
      body: 'A card app for payments, a spreadsheet for stock, a notes app for the regular who wants a dozen on Friday. Each one is fine on its own. Together they are a second job you do at the kitchen table after a twelve-hour day on your feet.',
    },
    {
      title: 'Your regulars disappear when you pack up.',
      body: 'People ask whether you sell online and which market you are at next week. Without a website you keep yourself, and without a way to tell them, the answer is a business card that ends up in a coat pocket.',
    },
  ],
  turn: 'A folding table does not need less software. It needs one place where the sale, the stock and the money are already the same record, and it has to fit in one hand.',
  week: [
    {
      when: 'Thursday, 8pm',
      body: 'Count what came back from the last market. Stock shows the difference from what it expected before anything is saved, then lists what is about to run out at the rate it actually sells. Friday’s making or buying starts from a list instead of a feeling.',
      app: 'stock',
    },
    {
      when: 'Friday, 9am',
      body: 'Partners suggests an order for the supplier who is short, based on real sales and how long they actually take to deliver. Confirm it, place it and pass it on to the supplier, and when their invoice arrives, a price that does not match what you agreed is flagged for you to look at.',
      app: 'partners',
    },
    {
      when: 'Saturday, 6:45am',
      body: 'Before you unfold the table, Home shows what is waiting on you: two website orders to get out and a message somebody sent through your site asking whether you will be there today. Each line opens the list behind it.',
      app: 'home',
    },
    {
      when: 'Saturday, 10:15am',
      body: 'A sale at the table is recorded in Sell on your phone. The payment goes through the provider you already use and settles in your own account. It lands in the same order list as your website orders and comes off the same stock count, so the last one is never sold twice.',
      app: 'sell',
    },
    {
      when: 'Saturday, 4:30pm',
      body: 'Packing up. Money shows what came in after refunds and what the goods cost you. Record the pitch fee as a cost, and you know whether today was worth the early start while you can still remember the day.',
      app: 'money',
    },
    {
      when: 'Sunday, 7pm',
      body: 'Write one post with a photo of next week’s table and the markets you are at. Get Found crops the picture for each network and publishes to Instagram, Facebook and the rest at the times you chose.',
      app: 'get_found',
    },
    {
      when: 'Monday, 10am',
      body: 'A short email from your own address to everybody who has ordered from your website, with this month’s markets and what is new. Messages shows who opened it, so next month you know whether it was worth writing.',
      app: 'messages',
    },
  ],
  firstHour: [
    'Look around the practice records Piggles starts you with, so you see a working week before you type anything.',
    'Add the ten things you sell most, with their sizes, options and prices. The rest can wait for a quiet evening.',
    'Connect the payment provider you already take cards with, so the money keeps landing in your own account.',
    'Put in rough counts for what you have right now. The first real count after a market corrects them.',
    'Clear the practice records with one button. It removes every sample and touches nothing of yours.',
  ],
  questions: [
    {
      q: 'Is $99 a month worth it for a stall that trades three days a week?',
      a: 'It is $99 a month, flat, with every app included: selling, stock, money, your website, email and the rest. If you are already paying separately for a card app, a website and a spreadsheet you never finish, and losing Sunday evenings to adding up, the comparison is easy to make. You can try it for 14 days without a card and decide on your own numbers.',
    },
    {
      q: 'Can I really run it from my phone, standing at the table?',
      a: 'Yes. The screens are built to work on a phone, the checkout on your website works on a phone, and counting or receiving stock has a stripped-back mode for a phone with one hand free: scan, confirm, next.',
    },
    {
      q: 'I already take cards. Do I have to change payment provider?',
      a: 'No. You connect the one you already use (Stripe, PayPal, Square, Authorize.net or 1stPayGateway) and the money settles into your account on your terms. Piggles never sits in the middle of it.',
    },
    {
      q: 'I sell at markets and online. Will I sell something I no longer have?',
      a: 'Not between the table and your website: a sale at either one comes off the same stock number, and that single number is what stops you selling the last one twice. Piggles does not connect to marketplaces such as Etsy or eBay today, so anything you also list there keeps its own count on that marketplace.',
    },
    {
      q: 'What happens if the stall turns into a shop?',
      a: 'Nothing needs upgrading, because every app is already included. The price includes one business, one location, one website and three people with their own sign-in. More locations, more people, more storage or more email can be added any time, with the price shown before you commit.',
    },
    {
      q: 'How do I get my current product list in?',
      a: 'From a spreadsheet or another system. Piggles shows you what will happen, row by row, before anything is written, so a mistake is caught before it becomes a hundred wrong products.',
    },
  ],
};
