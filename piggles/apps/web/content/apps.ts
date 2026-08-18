import type { PigglesAppId } from '@piggles/config';

// Marketing copy for the fifteen app pages.
//
// SEPARATE FROM `@piggles/config` ON PURPOSE. That package is a product adapter
// the console imports; this is prose the marketing site renders. An app's `label`
// and `purpose` are product structure and live there. A headline is not.
//
// ── `alsoKnownAs` is the load-bearing field ──────────────────────────────────
//
// It lists what the rest of the industry calls this app. Two jobs:
//
//   1. Search. Somebody who already knows they need "inventory management
//      software" types exactly that. The page has to contain the phrase to be
//      findable at all, and these are the terms the satellite domains
//      (pigglescms.com and friends) are pointed at.
//   2. The argument. Printing the jargon and then not using it again for the
//      rest of the page IS the product's central claim, demonstrated instead of
//      asserted. Delete this field and the page becomes a feature list.
//
// It is the ONE sanctioned place on a Piggles surface where a technical term is
// allowed to appear (piggles/CLAUDE.md RULE #3 bans them "outside an explicitly
// advanced context" — a page whose subject is the translation is that context).
// Do not let the vocabulary leak from here into `does[]`.
//
// ── Accuracy ────────────────────────────────────────────────────────────────
//
// Every line in `does[]` describes something the shared platform genuinely
// implements today. This site sells a real product to people who will hold us to
// it, so a capability that is planned but not built does not get a bullet. When
// in doubt, check the module's surfaces before writing the sentence.

export interface AppMarketing {
  /** The page h1. A claim in the customer's words — never the app's own name
   *  restated, which tells a visitor nothing they did not know from the link. */
  heading: string;
  /** One paragraph under the heading. */
  lede: string;
  /** What everyone else calls it. See the note above — this field is the point. */
  alsoKnownAs: string[];
  /** What it does, in plain language. Six each, so the pages stay comparable. */
  does: { title: string; body: string }[];
  /** Apps this one is routinely used with. Rendered as real links, because the
   *  claim "it all works together" is only credible if the site itself does. */
  worksWith: PigglesAppId[];
  /** Optional photograph. Only where a real picture adds something a diagram of
   *  the software would not — see public/photos/README.md. */
  photo?: { src: string; alt: string };
}

export const APP_MARKETING: Record<PigglesAppId, AppMarketing> = {
  home: {
    heading: 'Start the day knowing what actually needs you.',
    lede: 'Home is the first screen you see and usually the only one you need before the doors open. It gathers what changed overnight, what is waiting on you, and what is about to go wrong while there is still time to do something about it.',
    alsoKnownAs: ['dashboard', 'business intelligence', 'KPI reporting'],
    does: [
      {
        title: 'What happened while you were closed',
        body: 'Orders, bookings, messages and payments since you last looked — in one list, newest first, not five badges on five tabs.',
      },
      {
        title: 'What is waiting on you',
        body: 'The things that stop until a person decides: an order held for approval, a return to inspect, a review to answer, a quote about to expire.',
      },
      {
        title: 'Early warning, not a post-mortem',
        body: 'Stock about to run out at the rate it is actually selling, invoices about to go late, a booking with nobody assigned to it.',
      },
      {
        title: 'The numbers that matter this week',
        body: 'What came in, what it cost you, and how that compares to the same stretch last month — without building a report to find out.',
      },
      {
        title: 'Pick up where you left off',
        body: 'The things you had open yesterday are still open today, arranged the way you left them.',
      },
      {
        title: 'Made yours',
        body: 'Everything on Home can be moved or removed. A workshop and a bakery do not start the day looking at the same thing.',
      },
    ],
    worksWith: ['money', 'stock', 'bookings'],
  },

  site: {
    heading: 'A website you can change yourself, on a Tuesday, without phoning anybody.',
    lede: 'My Site is the website customers actually land on — built by dragging real sections into place, published in one click, and editable by you at four in the afternoon when the opening hours change.',
    alsoKnownAs: ['website builder', 'CMS', 'landing page builder', 'ecommerce storefront'],
    does: [
      {
        title: 'Build it from real pieces',
        body: 'A library of finished sections — headers, galleries, price lists, contact forms, product grids — that you arrange and fill in. Not a blank page and not a template you cannot escape.',
      },
      {
        title: 'See the change as you make it',
        body: 'The preview is the actual page, not an approximation of it. What you see is what visitors get.',
      },
      {
        title: 'Your own address',
        body: 'Start on a free Piggles address, point your own domain at it whenever you are ready, and the certificate is issued and renewed without you knowing it happened.',
      },
      {
        title: 'Looks right on a phone',
        body: 'Every section is built to reflow rather than shrink, so the site is usable on the device most of your customers will actually use.',
      },
      {
        title: 'Change your mind safely',
        body: 'Every publish is a version. Compare, roll back, and keep working on a draft while the live site carries on being live.',
      },
      {
        title: 'More than one site',
        body: 'Two businesses, or a separate site for the wholesale side, each with its own look, its own domain and its own content.',
      },
    ],
    worksWith: ['content', 'get_found', 'sell'],
    photo: {
      src: '/photos/florist.jpg',
      alt: 'A hand-lettered "fresh cut flowers" sign at a florist',
    },
  },

  content: {
    heading: 'Write it once. Use it everywhere it belongs.',
    lede: 'Content holds the writing, pictures and reusable information behind your site — the guides, the notices, the staff profiles, the frequently asked questions — so the same thing does not get retyped in four places and go out of date in three of them.',
    alsoKnownAs: ['CMS', 'content management system', 'headless CMS', 'blog platform'],
    does: [
      {
        title: 'Anything you write, in one place',
        body: 'Articles, notices, recipes, case studies, team profiles, opening times. If you write it down, it lives here.',
      },
      {
        title: 'Decide what a thing is made of',
        body: 'Set up your own kinds of entry with your own fields, so a "class" has a date and a tutor and a capacity, rather than being a paragraph you have to remember the shape of.',
      },
      {
        title: 'Publish when you mean to',
        body: 'Save drafts, schedule for a date, and unpublish without deleting. Nothing goes live because you hit the wrong key.',
      },
      {
        title: 'A real history',
        body: 'Every version is kept. See what changed, and put back the paragraph you should not have removed.',
      },
      {
        title: 'One picture, used properly',
        body: 'A shared library for images and files, resized for wherever they appear, so the same photograph is not uploaded five times at five sizes.',
      },
      {
        title: 'It shows up on the site',
        body: 'Content flows into the pages you built in My Site. Change it here, and the page changes.',
      },
    ],
    worksWith: ['site', 'get_found', 'messages'],
  },

  get_found: {
    heading: 'Turn up when somebody searches for what you do.',
    lede: 'Get Found is the unglamorous half of having a website: the titles, descriptions, addresses and posts that decide whether a person looking for exactly your thing ever sees you. It tells you what is wrong in plain words, and mostly fixes it for you.',
    alsoKnownAs: ['SEO', 'search engine optimisation', 'social media management', 'meta tags'],
    does: [
      {
        title: 'Plain-English checks',
        body: 'What is missing, why it matters and what to type instead — not a score out of a hundred and a list of acronyms.',
      },
      {
        title: 'Control how you look when shared',
        body: 'The title, the description and the picture that appear when your page is posted or messaged. Set once, right, per page.',
      },
      {
        title: 'Tell search engines you exist',
        body: 'Sitemaps, structured data and redirects handled for you, and kept correct when you rename or move a page.',
      },
      {
        title: 'Post to social without doing it eight times',
        body: 'Write once, choose where it goes, schedule it for when your customers are actually awake.',
      },
      {
        title: 'See what a post actually did',
        body: 'Reach, engagement and clicks for every post you sent — because "did that work" is the only reason to have posted it.',
      },
      {
        title: 'Answer in one place',
        body: 'Comments and messages from the platforms you connected, in one inbox, alongside everything else a customer has said to you.',
      },
    ],
    worksWith: ['site', 'content', 'customers'],
  },

  sell: {
    heading: 'Take money for whatever it is you sell.',
    lede: 'Sell covers products, services, one-offs and repeats — over the counter, on your site, or on account to businesses that pay you at the end of the month. Same catalogue, same orders, however the sale happens.',
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
    worksWith: ['stock', 'customers', 'invoices'],
    photo: { src: '/photos/market.jpg', alt: 'Punnets of tomatoes and corn on a market stall' },
  },

  stock: {
    heading: 'Know what you have, where it is, and when to order more.',
    lede: 'Stock is the honest count. It tracks what came in, what went out, what is on a shelf versus promised to somebody, and tells you what to reorder before you find out by selling something you do not have.',
    alsoKnownAs: ['inventory management', 'warehouse management', 'stock control', 'WMS'],
    does: [
      {
        title: 'One number you can trust',
        body: 'What is physically there, what is already spoken for, and what is genuinely available to sell — kept apart, because treating them as one number is how you oversell.',
      },
      {
        title: 'More than one place',
        body: 'A shop, a back room, a van and a unit across town. Move things between them and keep the count right in both.',
      },
      {
        title: 'Down to the shelf',
        body: 'Bins and locations, so "we have four" also answers "where". Barcode scanning for receiving, picking, packing and counting.',
      },
      {
        title: 'Counting without closing',
        body: 'Rolling counts on a schedule, or a full stocktake. Enter what you found, see what it differs from, and approve the correction.',
      },
      {
        title: 'Reorder before you run out',
        body: 'Reorder points worked out from what actually sells and how long a supplier actually takes — not a number somebody guessed in the first month.',
      },
      {
        title: 'What it really cost',
        body: 'Landed cost including freight and duty, batch and serial tracking for the things that need it, and a valuation you can hand to an accountant.',
      },
    ],
    worksWith: ['sell', 'partners', 'money'],
    photo: {
      src: '/photos/garage.jpg',
      alt: 'A car on a lift above a working bench of tools and a toolbox',
    },
  },

  customers: {
    heading: 'Everything you know about someone, in one history.',
    lede: 'Customers is the memory of your business. Who they are, what they have bought, what they asked last time, what you promised, and what is still open — so anybody who picks up the phone can pick up the thread.',
    alsoKnownAs: ['CRM', 'customer relationship management', 'contact management', 'helpdesk'],
    does: [
      {
        title: 'One record per person, not four',
        body: 'Their orders, bookings, invoices, emails, calls and notes on one page, in the order they happened.',
      },
      {
        title: 'The companies behind the people',
        body: 'Link contacts to the business they work for, so a firm with six people who order is one relationship rather than six.',
      },
      {
        title: 'Track work you are trying to win',
        body: 'Quotes and jobs on a board you can move along, with what it is worth and what happens next — instead of a spreadsheet nobody updates.',
      },
      {
        title: 'Questions and complaints, answered',
        body: 'Requests come in, get assigned to a person, and have a time they are expected to be answered by. Nothing quietly ages in an inbox.',
      },
      {
        title: 'Groups that keep themselves up to date',
        body: 'Everyone who bought a particular thing, or has not been in for six months. Defined once, always current, ready to write to.',
      },
      {
        title: 'One of them, not two',
        body: 'Find and merge duplicates properly — the history joins up instead of one copy being abandoned.',
      },
    ],
    worksWith: ['messages', 'bookings', 'sell'],
    photo: {
      src: '/photos/coffee-shop.jpg',
      alt: 'Staff working behind the counter of a busy café',
    },
  },

  messages: {
    heading: 'Talk to your customers without leaving what you were doing.',
    lede: 'Messages is email and conversation that already knows who it is talking to. Send the one-off reply, the order confirmation and the monthly note to everybody, from the same place — with the whole history of that person beside it.',
    alsoKnownAs: ['email marketing', 'transactional email', 'newsletter', 'live chat', 'inbox'],
    does: [
      {
        title: 'Write from your own address',
        body: 'Verify your domain and send as you@yourbusiness — not as a platform with your name in brackets. Setup is guided and checked.',
      },
      {
        title: 'The automatic ones, handled',
        body: 'Order confirmations, booking reminders, invoice notices and password resets go out reliably, worded like you rather than like a receipt printer.',
      },
      {
        title: 'Write to everybody, or to the right ones',
        body: 'Send to a group that keeps itself current — recent customers, people who booked once, the wholesale list.',
      },
      {
        title: 'Did it arrive, and did they read it',
        body: 'Delivery, opens, clicks, bounces and unsubscribes, per send, so the next one can be better.',
      },
      {
        title: 'Unsubscribes respected properly',
        body: 'Someone who opts out stops receiving marketing everywhere, permanently, without you maintaining a list of exceptions.',
      },
      {
        title: 'Every conversation on the record',
        body: 'What you sent and what they said back is on their record, so the next person to deal with them is not starting cold.',
      },
    ],
    worksWith: ['customers', 'get_found', 'sell'],
  },

  bookings: {
    heading: 'Let people book you without the back-and-forth.',
    lede: 'Bookings publishes real availability, takes the appointment, and keeps your calendar honest — including the parts that are hard: two staff, one room, a deposit, a cancellation and somebody who did not turn up.',
    alsoKnownAs: ['scheduling', 'appointment booking', 'calendar software', 'reservations'],
    does: [
      {
        title: 'Availability that is actually true',
        body: 'Worked out from opening hours, who is in, how long the job takes and what is already booked — not a calendar you keep in step by hand.',
      },
      {
        title: 'Rooms and equipment too',
        body: 'If a service needs a chair, a bay or a particular person, it cannot be double-booked into one that is busy.',
      },
      {
        title: 'The awkward cases',
        body: 'Repeating appointments, buffers between jobs, holidays and one-off closures, and different hours on a Saturday.',
      },
      {
        title: 'Reminders that reduce no-shows',
        body: 'Automatic confirmations and reminders before the appointment, and a link the customer can use to move it themselves.',
      },
      {
        title: 'Deposits and cancellation rules',
        body: 'Take money up front where it matters, with a stated policy that is applied the same way for everybody.',
      },
      {
        title: 'A waiting list that works',
        body: 'When somebody cancels, the next person is offered the slot instead of it silently going empty.',
      },
    ],
    worksWith: ['customers', 'messages', 'team'],
    photo: { src: '/photos/barber.jpg', alt: 'A barber finishing a client’s cut' },
  },

  invoices: {
    heading: 'Send the bill. Find out who has paid.',
    lede: 'Invoices produces the document, sends it, records the payment and tells you who is late — for a single job, a monthly account or a quote that turned into work.',
    alsoKnownAs: ['invoicing', 'billing', 'accounts receivable', 'quotes and estimates'],
    does: [
      {
        title: 'Documents that look like your business',
        body: 'Your logo, your terms, your wording. Quotes, invoices, credit notes and receipts from one template set.',
      },
      {
        title: 'Quote first, invoice after',
        body: 'Turn an accepted quote into an invoice without retyping any of it, and keep the link between the two.',
      },
      {
        title: 'Take payment from the document',
        body: 'The customer opens the invoice and pays it. The payment records itself against the right one.',
      },
      {
        title: 'Chasing, without the awkward part',
        body: 'See what is overdue and by how long, and send a reminder that is firm and polite without you writing it each time.',
      },
      {
        title: 'Accounts, not just one-offs',
        body: 'Statements, part payments, credit notes and write-offs for customers who pay on terms.',
      },
      {
        title: 'Signed where it needs to be',
        body: 'Send a document for signature and keep the signed copy attached to the record.',
      },
    ],
    worksWith: ['money', 'customers', 'sell'],
  },

  money: {
    heading: 'What came in, what went out, what you kept.',
    lede: 'Money is the plain answer to how the business is doing. It reads what already happened — sales, refunds, costs, payouts — and states the result without asking you to be an accountant to read it.',
    alsoKnownAs: ['financial reporting', 'bookkeeping', 'profit and loss', 'accounting'],
    does: [
      {
        title: 'Kept, not just taken',
        body: 'Revenue after refunds, discounts, fees and what the goods cost you — so the number on the screen is the one that matters.',
      },
      {
        title: 'What is actually profitable',
        body: 'Margin by product, by category and by channel. Sometimes the best seller is the worst earner, and this is where that shows up.',
      },
      {
        title: 'Where it went',
        body: 'Costs recorded against the thing that caused them, including freight and supplier charges, rather than a lump at the end of the month.',
      },
      {
        title: 'Money owed, both ways',
        body: 'What customers owe you and how old it is; what you owe suppliers and when it falls due.',
      },
      {
        title: 'Tax handled quietly',
        body: 'Rates by region, exemptions for the customers who have them, and a total you can file from.',
      },
      {
        title: 'Hand it to your accountant',
        body: 'Export in the formats real accounting software reads, or connect it directly, instead of retyping a year.',
      },
    ],
    worksWith: ['invoices', 'sell', 'stock'],
  },

  team: {
    heading: 'Let people help without handing over everything.',
    lede: 'My Team is who works with you and what each of them can see. A Saturday assistant needs the till and the bookings. They do not need your bank details, your margins or the button that deletes the website.',
    alsoKnownAs: ['user management', 'RBAC', 'permissions', 'staff accounts'],
    does: [
      {
        title: 'Their own account',
        body: 'Everyone signs in as themselves. No shared password, and no wondering who did that.',
      },
      {
        title: 'Access by the job they do',
        body: 'Ready-made roles for the common cases, adjustable per person when somebody does two jobs.',
      },
      {
        title: 'Money kept separate',
        body: 'Costs, margins, payouts and platform billing are their own permission. Plenty of people need the product list and none of that.',
      },
      {
        title: 'A record of who did what',
        body: 'Significant changes are logged with a name and a time — not to catch anybody out, but so a mystery has an answer.',
      },
      {
        title: 'Per-location, where it matters',
        body: 'Staff at one shop see that shop, if that is how you want it.',
      },
      {
        title: 'Leaving is clean',
        body: 'Revoke access in one action. Their history stays; their way in does not.',
      },
    ],
    worksWith: ['bookings', 'money', 'connections'],
  },

  automations: {
    heading: 'The jobs that should just happen, happening.',
    lede: 'Automations does the small reliable things you would otherwise do by memory: the follow-up two days later, the low-stock warning, the tag on a customer who bought twice, the reminder before the appointment.',
    alsoKnownAs: ['workflow automation', 'marketing automation', 'triggers and actions'],
    does: [
      {
        title: 'When this, then that',
        body: 'Built from things that already happen in your business — an order paid, a booking made, stock below a level, a quote gone quiet.',
      },
      {
        title: 'Wait, then check again',
        body: 'Steps can pause for a day or a week and then confirm the situation still applies, so nobody gets chased for something they already did.',
      },
      {
        title: 'Start from a working example',
        body: 'A set of ready-made ones for the common jobs. Turn one on, change the wording, done.',
      },
      {
        title: 'See what it did',
        body: 'Every run is listed with what it acted on and what it changed. An automation you cannot inspect is one you will not trust.',
      },
      {
        title: 'Test before it is loose',
        body: 'Run one against a real record and see the outcome before it is switched on for everybody.',
      },
      {
        title: 'Off is one click',
        body: 'Pause anything immediately, without deleting it and rebuilding it later.',
      },
    ],
    worksWith: ['customers', 'messages', 'stock'],
  },

  partners: {
    heading: 'The suppliers and people you work alongside.',
    lede: 'Partners is the other side of your business: who you buy from, what they charge, how long they actually take, and the purchase orders that keep the shelves full.',
    alsoKnownAs: ['supplier management', 'purchasing', 'procurement', 'vendor management'],
    does: [
      {
        title: 'Who supplies what',
        body: 'Suppliers, the items they provide, their codes for them and their prices — including when more than one can supply the same thing.',
      },
      {
        title: 'Purchase orders',
        body: 'Raise, send, receive against, and part-receive. What arrived and what is still outstanding stays clear.',
      },
      {
        title: 'What they really cost you',
        body: 'Freight, duty and handling spread across the delivery, so the cost of an item is the cost of getting it here.',
      },
      {
        title: 'How long they actually take',
        body: 'Measured from your own orders, not from what they told you — which is what reorder timing should be based on.',
      },
      {
        title: 'Price changes caught',
        body: 'When an invoice does not match the agreed price, it is flagged rather than absorbed.',
      },
      {
        title: 'Receiving with a scanner',
        body: 'Scan the delivery in and stock updates as you go, instead of a paper note typed up later.',
      },
    ],
    worksWith: ['stock', 'money', 'sell'],
    photo: { src: '/photos/carpenter.jpg', alt: 'A joiner marking a length of timber' },
  },

  connections: {
    heading: 'Piggles and the other things you already use.',
    lede: 'Connections links Piggles to the software you are not giving up — the accounting package, the payment provider, the marketplace, the calendar — and lets modern AI assistants work with your business data under your control.',
    alsoKnownAs: ['integrations', 'API', 'webhooks', 'MCP', 'AI assistant'],
    does: [
      {
        title: 'The usual suspects',
        body: 'Accounting, payments, shipping, marketplaces and calendars, connected by signing in rather than by pasting keys.',
      },
      {
        title: 'Tell other software what happened',
        body: 'Send an alert to another system the moment an order is placed or a booking is made, and see whether it arrived.',
      },
      {
        title: 'Work with an AI assistant',
        body: 'Connect the assistant you already use and ask it about your own business — what sold, what is low, who has not paid.',
      },
      {
        title: 'Your key, your choice',
        body: 'AI features run on an account you connect, so nothing is sent anywhere you did not agree to. Piggles never quietly uses your data to run somebody else’s model.',
      },
      {
        title: 'Bring your history with you',
        body: 'Import products, customers and past orders from a spreadsheet or another system, with a preview before anything is written.',
      },
      {
        title: 'A real way out',
        body: 'A documented interface for anything bespoke, and a full export whenever you want one.',
      },
    ],
    worksWith: ['money', 'sell', 'team'],
  },
};
