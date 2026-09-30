import type { TradePage } from '../types';

// The deeper half of /for/side-business. Every capability below is one
// content/apps/*.ts already states. `switching` was checked against the console's
// Move in screen (piggles/apps/workbench/surfaces/migration) and the Etsy adapter in
// @wizeworks/migration: listings and sold orders import, the buyer list is rebuilt
// from the orders file, and stock needs a once-over because Etsy counts per listing.
// The site's design does not travel, and the copy says so. `cost` answers the
// honest question first: $99 may be too early for a hobby.

export const SIDE_BUSINESS_DETAIL: Pick<TradePage, 'replaces' | 'inDepth' | 'switching' | 'cost'> =
  {
    replaces: [
      {
        today: 'a free page on somebody else’s address, with a link in your profile',
        instead: 'site',
        why: 'The address people saved is yours from the first day, so nothing breaks the month you outgrow the free version.',
      },
      {
        today: 'a payment app meant for splitting dinner',
        instead: 'sell',
        why: 'A real checkout records what was bought, by whom and where it ships, and the money settles into your own account with the provider you chose.',
      },
      {
        today: 'a website builder with its own monthly fee, and a shop add-on on top',
        instead: 'sell',
        why: 'The shop is part of the same account as the site, the stock and the customer list, so there is no second fee and no second login.',
      },
      {
        today: 'a free mailing-list tool with its own login',
        instead: 'messages',
        why: 'The people on your list are the people who bought from you, so the thank-you and the check-in start by themselves when an order comes in.',
      },
      {
        today: 'posting to each network by hand, when you remember',
        instead: 'get_found',
        why: 'Write it once on a Thursday night and it goes out Saturday morning, cropped and trimmed for each network, while you are busy selling.',
      },
      {
        today: 'orders tracked in direct messages and screenshots',
        instead: 'home',
        why: 'Orders to send and messages to answer are counted in plain sentences, each one tap from the list behind it, so nothing depends on scrolling back through a chat.',
      },
    ],
    inDepth: [
      {
        app: 'site',
        heading: 'A website that looks finished on the first evening.',
        body: 'You do not have a spare weekend to learn a website builder. My Site starts from a finished site for your kind of work, so the first evening is spent swapping in your photos and words, not deciding where the menu goes.',
        points: [
          'Ready-made sites come with real pages and real sections already in them, so you are editing from the start instead of staring at a blank page.',
          'Colors and type are set once and worn by every page, so a change of look takes minutes rather than a night of editing section by section.',
          'Every publish is saved as a version, so you can try something bold on Tuesday and roll it back on Wednesday.',
          'Start on a free Piggles address and point your own domain at it whenever you are ready. The security certificate is issued and renewed on its own.',
          'Every section reflows to fit a phone, which is where most people will land on your site from a link in your profile.',
          'Messages people send through a form on your site are kept and readable, not lost in an inbox you check twice a week.',
        ],
      },
      {
        app: 'sell',
        heading: 'Take real payments from the very first sale.',
        body: 'The line between a hobby and a business is usually the checkout. Sell gives you a proper one from day one, with the money going into your own account, and it keeps working when ten orders a month turn into a hundred.',
        points: [
          'Products can have sizes, colors and options, and you can sell bundles and gift cards, not just a name and a price.',
          'You connect a payment provider you choose, such as Stripe, PayPal or Square, and the money settles into your account on your terms.',
          'Shipping is worked out by zone, weight or basket value, and tax by region, so you are not guessing at the post office counter.',
          'Discount codes and automatic offers follow rules you can predict, so a launch-night code does not quietly stack with everything else.',
          'Baskets people filled and left are listed, so a follow-up goes to somebody who was genuinely about to buy.',
          'Returns end up right: the refund goes out and the stock count goes back up, once, with no fixing afterward.',
        ],
      },
      {
        app: 'home',
        heading: 'Ten minutes before the day job, and you know where things stand.',
        body: 'A side business happens in the gaps. Home is built for the gaps: one screen that says what needs you, in plain sentences, so the ten minutes you have go on doing, not hunting.',
        points: [
          'Orders waiting to go out, chats waiting for a reply and messages sent through your site are counted on one screen, instead of spread across five apps on your phone.',
          'Every line opens the list it counted from, so the sold-out line opens on just the sold-out items, not everything you make.',
          'Things that have sold out or are running low get their own line, so you know what to make more of before the weekend.',
          'When nothing is waiting, one quiet line says so, and a running record of everything that happened sits behind it, newest first.',
          'Your business name, address and details are written once here and used on your invoices and documents from then on.',
          'Two-step sign-in with a code from your phone protects the account that now holds your customers and your money.',
        ],
      },
    ],
    switching: [
      {
        title: 'If you already sell on Etsy.',
        body: 'Download your listings file and your sold-orders file from Etsy, and drop them into Move in. Listings arrive as products with their options and photos, and past orders arrive as orders. Etsy has no customer list to export, so Piggles rebuilds your buyers from the orders file. Etsy counts stock per listing rather than per option, so give the counts a once-over afterward.',
      },
      {
        title: 'If you have a shop or a mailing list somewhere else.',
        body: 'For several of the common shop and website builders, Move in names the exact file to export and where to find it. Anything else comes in as a spreadsheet: say what each column means and see what will happen to every row before anything is saved. Your mailing list comes across the same way, and whether each person agreed to hear from you comes with it. The look of your old site does not travel, so start from a finished site here instead.',
      },
      {
        title: 'Then your address and your money.',
        body: 'Connect the payment provider you already use, so nothing changes about how you get paid. Keep the free Piggles address until the site is ready, then point your own domain at it. The security certificate is sorted out on its own, and the old site can stay up until the moment you switch.',
      },
    ],
    cost: {
      heading: '$99 is real money for an evening project. Here is how to decide.',
      body: 'If you sell a handful of things a month, $99 may be too early, and it is fine to say so. If you already pay separately for a website builder, a shop add-on, an email tool and a post scheduler, add those up first. Piggles is one flat $99 with all sixteen apps, and the 14 days free are there so you can build the whole thing before you decide.',
      points: [
        'Included: your website on your own domain with the certificate, your own sending address, the checkout, stock, your customer list, posting to social networks and your money figures.',
        'There is one plan and no cheaper starter tier, so there is also nothing to outgrow. Products and orders are unlimited.',
        'The domain itself is one you register and own. Pointing it at Piggles, and the certificate that comes with it, cost nothing extra.',
        'Your payment provider’s fees are between you and them, and they are not part of the $99.',
        'The allowances are 10 GB of storage, 5,000 email sends a month, 10,000 customer records and three people with their own sign-ins. Most businesses never come near them, and more of any is one tap to add and one tap to remove.',
        'If it is not the right time, you stop by not carrying on, and nothing is charged.',
      ],
    },
  };
