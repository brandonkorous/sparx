import type { TradePage } from './types';
import { SIDE_BUSINESS_DETAIL } from './detail/side-business';

export const SIDE_BUSINESS: TradePage = {
  slug: 'side-business',
  pose: 'shed',
  group: 'run',
  name: 'A shed',
  plural: 'Side businesses',
  shape:
    'It is you, evenings, and it might be a business by Christmas. What you need is somewhere to start that will not have to be replaced when it works.',
  leans: ['site', 'sell', 'home'],
  ...SIDE_BUSINESS_DETAIL,
  heading: 'Start the evening project on something you will not have to replace.',
  lede: 'It is you, after work and on weekends, and it might be a real business by Christmas. Piggles gives you the website, the checkout and the list of people who bought from day one, and if it works, the same account is still the right one. Nothing to rebuild, nothing to move.',
  searchTerms: [
    'website for a side business',
    'side hustle website builder',
    'sell handmade products online',
    'start an online shop from home',
    'website builder with online store',
    'sell on Etsy and my own website',
    'all in one small business software',
  ],
  problems: [
    {
      title: 'You have one free hour, and setup eats it.',
      body: 'Tuesday night, the house is quiet, and the hour goes on choosing a template, working out which add-on takes payments, and reading about domain settings. By eleven the site still does not exist and nothing has been sold.',
    },
    {
      title: 'The free version works until it suddenly does not.',
      body: 'A free page with somebody else’s name on it, a link in your profile, a payment app meant for splitting dinner. It holds at ten orders. At fifty you are rebuilding it, copying customers across by hand, and losing the address people saved.',
    },
    {
      title: 'The business is scattered across your phone.',
      body: 'Orders in direct messages, payments in another app, who bought what in a screenshot. You cannot say what you made this month, and neither can whoever does your taxes.',
    },
    {
      title: 'You added a tool for every problem.',
      body: 'A site builder, a shop add-on, an email tool, a post scheduler. Each has its own login and its own monthly fee, and the fees add up well before the sales do.',
    },
  ],
  turn: 'Start on the thing you would move to if it worked, and there is nothing to move when it does.',
  week: [
    {
      when: 'Tuesday, 9pm',
      body: 'You start from a finished site for your kind of work, with real pages already in it, swap in your photos and your words, and publish in one click on a free Piggles address. Your own domain can wait until you are ready, and the security certificate takes care of itself when it arrives.',
      app: 'site',
    },
    {
      when: 'Wednesday, lunch break',
      body: 'You add six prints with sizes and frame options and connect the payment provider you already use. The money settles into your account, on your terms, and the checkout works on the phone your customers will buy from.',
      app: 'sell',
    },
    {
      when: 'Thursday, 10pm',
      body: 'One post, written once, goes to Instagram and your Facebook page, trimmed and cropped for each. It is scheduled for Saturday morning, when your customers are actually awake and you will be at the farmers market.',
      app: 'get_found',
    },
    {
      when: 'Saturday, 7am',
      body: 'Home counts what piled up while you were at the day job: two orders to send, and a message somebody left through the contact form on your site. Each line opens the list behind it.',
      app: 'home',
    },
    {
      when: 'Saturday, noon',
      body: 'The last large print sells at the farmers market table. You ring it up in Sell, it comes off the same stock number your site works from, and your site stops offering it, so nobody pays for something you no longer have.',
      app: 'stock',
    },
    {
      when: 'Sunday, 7pm',
      body: 'Everyone who bought for the first time gets a thank-you from your own email address, then a check-in two weeks later. It started because they ordered, and it stops if they buy again first.',
      app: 'messages',
    },
    {
      when: 'Sunday, 8pm',
      body: 'Money shows what you kept this month: sales, less refunds and what the materials cost you. It is the number that tells you whether this is a hobby that pays for itself or a business starting to happen.',
      app: 'money',
    },
  ],
  firstHour: [
    'Tell Piggles what you make. Your trade sets sensible defaults across every app, so a print shop does not start out looking like a salon.',
    'Look around the practice records. The account arrives with sample products, customers and orders, so you learn on something that looks real.',
    'Pick a finished site for your kind of work, change the words and photos, and publish it on your free Piggles address.',
    'Add the first three things you actually have for sale, with photos, prices and options, and connect your payment provider.',
    'Press the one button that clears the practice records. It removes every sample and touches none of yours.',
  ],
  questions: [
    {
      q: 'Is $99 a month too much before this is a real business?',
      a: 'It might be, and it is fair to ask. If you sell a handful of things a month, $99 is a real number next to that. What it pays for is the website on your own domain, your own sending address, the checkout, stock, your customer list, posting to social networks and your money figures, in one place rather than a separate monthly fee for each. The first 14 days are free with no card, so you can build the whole thing before deciding. If it is not the right time, you stop by not carrying on, and nothing is charged.',
    },
    {
      q: 'Is there a smaller, cheaper plan to start on?',
      a: 'No. There is one plan, at $99 a month, with all sixteen apps included. There is nothing to upgrade to, so you never find out six months in that the feature you need lives on a more expensive tier. There is no yearly discount yet. If one arrives, it will be a straight reduction, not a different plan with different limits.',
    },
    {
      q: 'Will I outgrow it if this takes off?',
      a: 'The things that grow when a business works are unlimited: products, orders, bookings and invoices. What is measured is room: 10 GB of storage, 5,000 email sends a month (order and booking emails do not count), 10,000 customer records and three people with their own sign-ins. If you need more of any of those, you add it in one tap and can take it away again. Nothing switches off when you reach a limit. The plan itself never changes.',
    },
    {
      q: 'I only have evenings. How much setup is there?',
      a: 'As little as possible. You start from a finished site for your trade rather than a blank page, and a setup checklist knows what you have already done, so each evening starts where the last one stopped instead of at step one.',
    },
    {
      q: 'I already sell on Etsy. Do I have to stop?',
      a: 'No, you can keep your Etsy shop. Piggles does not connect to Etsy today, so Etsy orders and Etsy stock are handled on Etsy. Your own website, your market table and your invoices run from Piggles. To get started, drop your Etsy listings file and sold-orders file into Move in: your products arrive with their photos and options, and your past buyers come across from the orders.',
    },
    {
      q: 'Can I run it from my phone?',
      a: 'The parts customers see are built for a phone: your site reflows to fit a small screen, and the checkout works on one. Behind the scenes, counting and receiving stock work from a barcode on a phone too, with a stripped-back screen meant for one free hand.',
    },
  ],
};
