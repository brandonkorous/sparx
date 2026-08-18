// The Sell apps — Sell, Stock, Partners, and Get Found (which sits in Web but
// is about being found, so it reads better beside the selling walks than beside
// the site-building ones).

import type { Guide } from '../types';

export const SELL_GUIDE: Guide = {
  id: 'commerce',
  offer: 'First time in Sell? Show me around',
  steps: [
    {
      id: 'sell.products',
      app: 'sell',
      anchor: 'nav-commerce.products.list',
      title: 'Start with what you sell',
      body: 'Everything you offer goes in here — a price, some photos, a description. Nothing appears on your site until you have at least one, so this is usually the first stop.',
    },
    {
      id: 'sell.orders',
      app: 'sell',
      anchor: 'nav-commerce.orders.list',
      title: 'And this is where they land',
      body: 'Every order, from the moment it comes in to the moment it goes out the door. Open one and you get the whole story: what they bought, what they paid, where it is going.',
    },
    {
      id: 'sell.pricing',
      app: 'sell',
      anchor: 'nav-commerce.discounts.list',
      title: 'Sales, codes and offers',
      body: 'Money off, a code for a newsletter, free delivery over a certain amount. Set the rule once and it applies itself at the checkout.',
    },
    {
      id: 'sell.returns',
      app: 'sell',
      anchor: 'nav-commerce.returns.list',
      title: 'When something comes back',
      body: 'Returns and refunds have their own screen so they never get lost in with live orders. Approving one puts the stock back and the money out in one go.',
    },
  ],
};

export const STOCK_GUIDE: Guide = {
  id: 'inventory',
  offer: 'First time in Stock? Show me around',
  steps: [
    {
      id: 'stock.levels',
      app: 'stock',
      anchor: 'nav-inventory.stock.list',
      title: 'How much of everything you have',
      body: 'One line per thing, with what is on the shelf and what is already spoken for by orders. This is the number your site uses to stop you selling what you have not got.',
    },
    {
      id: 'stock.counts',
      app: 'stock',
      anchor: 'nav-inventory.counts.list',
      title: 'When the shelf disagrees with the screen',
      body: 'A count is you walking round with a phone and putting the real numbers in. Piggles works out the difference and tells you what it was worth.',
    },
    {
      id: 'stock.reorder',
      app: 'stock',
      anchor: 'nav-inventory.reorder',
      title: 'What to order before you run out',
      body: 'We watch how fast things sell and how long your suppliers take, and tell you what is about to run short. You still decide — this just means nobody has to remember.',
    },
  ],
};

export const PARTNERS_GUIDE: Guide = {
  id: 'partners',
  offer: 'First time in Partners? Show me around',
  steps: [
    {
      id: 'partners.suppliers',
      app: 'partners',
      anchor: 'nav-inventory.suppliers.list',
      title: 'Who you buy from',
      body: 'Each supplier, what they sell you, what they charge and how long they usually take. That last one is what makes the reorder warnings worth trusting.',
    },
    {
      id: 'partners.orders',
      app: 'partners',
      anchor: 'nav-inventory.purchase-orders.list',
      title: 'What you have on order',
      body: 'A purchase order is you telling a supplier what you want. It stays here until it arrives, so "have we ordered more of those?" is a question with an answer.',
    },
    {
      id: 'partners.receiving',
      app: 'partners',
      anchor: 'nav-inventory.receiving.list',
      title: 'And what has turned up',
      body: 'Tick things off as the boxes come in. Whatever you receive goes onto your stock straight away, and anything short of what you ordered stays flagged.',
    },
  ],
};

export const GET_FOUND_GUIDE: Guide = {
  id: 'seo',
  offer: 'First time in Get Found? Show me around',
  steps: [
    {
      id: 'found.performance',
      app: 'get_found',
      anchor: 'nav-seo.performance',
      title: 'How people are finding you',
      body: 'What people typed into a search engine before they landed on you, and which of your pages they got. It is the closest thing there is to hearing what your customers were looking for.',
    },
    {
      id: 'found.audits',
      app: 'get_found',
      anchor: 'nav-seo.audits',
      title: 'What is holding you back',
      body: 'We check your pages for the things search engines quietly mark you down for — a missing description, a slow image, two pages saying the same thing — and list them plainly with what to do.',
    },
    {
      id: 'found.social',
      app: 'get_found',
      anchor: 'nav-social.calendar',
      title: 'Posting, without living in the apps',
      body: 'Write a post once, choose where it goes and when, and Piggles puts it out. You get the replies and the numbers back here, so you are not opening five apps to see how it went.',
    },
  ],
};
