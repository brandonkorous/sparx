import type { AppMarketing } from './types';

// Sell is the largest app on the rail — 43 screens, drawn from three platform
// modules — and it had the same six bullets as Invoices, which fronts three.
// The chapters are the four genuinely different ways a business takes money
// through it, so a reader recognises their own shape rather than reading one
// long list that is mostly about somebody else's.
//
// NOTE what is absent and must stay absent: sparx.market and sparx Pay. They are
// another product's marketplace and another product's gateway, and a Piggles
// customer cannot sign up for either (piggles/CLAUDE.md, "A sparx PRODUCT is not
// a Piggles capability"). The console hides both; this file simply never had
// them.

export const SELL: AppMarketing = {
  heading: 'Take money for whatever it is you sell.',
  lede: 'Sell covers products, services, one-offs and repeats — over the counter, on your site, on a marketplace, or on account to businesses that pay you at the end of the month. Same catalogue, same orders, however the sale happens.',
  alsoKnownAs: ['ecommerce', 'online store', 'point of sale', 'B2B commerce', 'dropshipping'],
  does: [
    {
      title: 'A catalogue that copes with real products',
      body: 'Sizes, colors, options, bundles, gift cards and things sold by weight or length — not just a name and a price.',
    },
    {
      title: 'Orders from anywhere, in one list',
      body: 'The website, the counter, the phone, a marketplace. One place to see what has been ordered and what has gone out.',
    },
    {
      title: 'Discounts that do what you meant',
      body: 'Codes, automatic offers, bulk breaks and limits — with the rules stated plainly enough that you can predict the result.',
    },
    {
      title: 'Trade customers pay differently',
      body: 'Per-customer pricing, agreed price lists, credit limits, quotes, approvals and payment on terms. The wholesale side does not need a second system.',
    },
    {
      title: 'Sell things you never touch',
      body: 'Connect a supplier, set your margin, and orders go straight to them — with the markup rules and the real cost still visible to you.',
    },
    {
      title: 'Returns, honestly',
      body: 'Request, inspect, restock, refund. The stock figure and the money both end up right without a manual correction.',
    },
  ],
  chapters: [
    {
      heading: 'Your own shop, taking your own money.',
      body: 'The ordinary case, and the one most software makes hardest: a catalogue that survives contact with real products, a checkout that works on a phone, and the money arriving in your account rather than being held by whoever built the software. You bring your own payment provider, so the terms are between you and them.',
      does: [
        {
          title: 'Products that are not just a name and a price',
          body: 'Options and variants, bundles, gift cards, things sold by length or weight, and a configurator for the ones a customer specifies rather than picks.',
        },
        {
          title: 'Organised how customers actually look',
          body: 'Categories for the structure, and hand-picked or self-updating groups for the ones you want to feature. A "what fits what" lookup for parts and compatible goods.',
        },
        {
          title: 'Pricing that holds together',
          body: 'Sale prices, codes, automatic offers, quantity breaks and per-customer agreed prices — with limits, dates and stacking rules you can predict the outcome of.',
        },
        {
          title: 'Your payment provider, your account',
          body: 'Connect the one you already use. The money settles into your account on your terms, and Piggles never sits in the middle of it.',
        },
        {
          title: 'Shipping worked out, not guessed',
          body: 'Rates by zone, weight or basket value, with different rules for the things that need them — and tax by region with exemptions for the customers who hold them.',
        },
        {
          title: 'The baskets nobody finished',
          body: 'What people put in and left, and what they were part-way through paying for, so a follow-up is aimed at somebody who was genuinely about to buy.',
        },
        {
          title: 'What sold, and when',
          body: 'Sales by product, by day, by category — the ordinary questions, answered here rather than by exporting everything and building a spreadsheet.',
        },
      ],
      // Every gateway a Piggles tenant can connect. sparx Pay is excluded on
      // purpose — see the file header.
      connects: ['Stripe', 'PayPal', 'Square', 'Authorize.net', '1stPayGateway'],
    },
    {
      heading: 'And on the places people are already shopping.',
      body: 'Your own site is where the margin is, and a marketplace is where the people are. Listing on both means keeping one catalogue rather than four, and having every order arrive in the same list whichever shopfront it came through — so the stock figure stays right and nobody sells the last one twice.',
      does: [
        {
          title: 'One catalogue, several shopfronts',
          body: 'Choose which products go where. The description, the pictures and the price come from the record you already maintain.',
        },
        {
          title: 'Orders land in the same place',
          body: 'A marketplace order is an order. Same list, same picking, same returns, same figures at the end of the month.',
        },
        {
          title: 'Stock stays honest across all of them',
          body: 'What is available is a single number, and every channel is working from it — which is what stops an oversell you have to apologise for.',
        },
        {
          title: 'Worth it, or not',
          body: 'What each channel actually brought in and what it cost in fees, so "should we still be on there" has an answer.',
        },
      ],
      connects: [
        'Amazon',
        'eBay',
        'Etsy',
        'Faire',
        'Walmart Marketplace',
        'Google Shopping',
        'Meta (Instagram & Facebook)',
        'TikTok Shop',
        'Pinterest',
      ],
    },
    {
      heading: 'Selling to businesses is a different sport.',
      body: 'A trade customer does not put things in a basket and pay with a card. They ask for a price, expect it to be their price, order against an account, and pay at the end of the month — and somebody on their side has to approve it. All of that is here, on the same catalogue as the retail side, so you are not running two systems and reconciling them.',
      does: [
        {
          title: 'Their price, not the shelf price',
          body: 'Price tiers for groups of customers and agreed prices for individual accounts, applied automatically at checkout without anybody having to remember.',
        },
        {
          title: 'Quote, then order',
          body: 'Send a quote, let them accept it, and turn it into an order without retyping — with the link between the two kept.',
        },
        {
          title: 'Buying on account',
          body: 'Credit limits, payment terms and a running balance, so an order can go out before the money comes in — deliberately, and within a limit you set.',
        },
        {
          title: 'Sign-off on their side',
          body: 'Rules for what needs approving before it becomes an order — over a value, outside an agreement — with a queue for whoever approves it.',
        },
        {
          title: 'Their invoices, on their cycle',
          body: 'Wholesale invoices raised against the account, chased when late, and settled against the balance.',
        },
      ],
    },
    {
      heading: 'What happens after the sale is most of the relationship.',
      body: 'The sale is the short part. Returns, questions, reviews and repeat orders are where a customer decides whether there is a second one — and they are what gets bolted on last, badly, in most systems. Here they are the same records, so a refund corrects the stock and the money together and nobody does a manual adjustment to make the two agree.',
      does: [
        {
          title: 'Returns that end up right',
          body: 'Requested, approved, inspected, restocked or written off, refunded. The stock figure and the money both move, once, without a correction afterwards.',
        },
        {
          title: 'Reviews and questions, moderated',
          body: 'What customers said, held for approval where you want it, answered in public where a question deserves a public answer.',
        },
        {
          title: 'Repeat orders that run themselves',
          body: 'Subscriptions for the things people buy on a cycle — paused, skipped, restarted, or changed to a different quantity, by them or by you.',
        },
        {
          title: 'Money you owe them, without a refund',
          body: 'Account credit and gift cards, tracked as a real balance rather than a code somebody wrote on a card.',
        },
        {
          title: 'Saved for later',
          body: 'What people put on a wishlist — which is a list of things somebody has told you they want.',
        },
      ],
    },
  ],
  worksWith: ['stock', 'customers', 'invoices'],
  photo: { src: '/photos/market.jpg', alt: 'Punnets of tomatoes and corn on a market stall' },
};
