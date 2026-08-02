/**
 * The industry ("vertical") landing pages — one entry per kind of business.
 *
 * These are the pages an ad, a social post or a search result lands on. A person
 * who runs a salon does not search for "modular content and commerce OS"; they
 * search for "booking system for hair salon" and they want to know, in about
 * fifteen seconds, whether this thing is for them and what it costs. Every page
 * here answers exactly those two questions for ONE kind of business.
 *
 * ## What is data and what is computed
 *
 * Only the things that genuinely differ per industry live here: the words, the
 * jobs a business of that kind actually needs done, and which modules that adds
 * up to (`stack`). Everything else is DERIVED — the prices, what each module
 * replaces, the totals, the savings — from `../pricing/data.ts`, which is the
 * single source of truth for every price on the site. Nothing in this file
 * carries a dollar figure, so a price change on /pricing re-prices all six pages
 * with no edit here. See ./stack.ts for the arithmetic.
 *
 * ## No invented customers
 *
 * There are no logos, quotes, case studies or "trusted by" counts on these
 * pages, because there are none to show yet. What a page CAN honestly say is
 * what the platform does for that kind of business and what it costs — so that
 * is what it says. Every capability named in `jobs` is one that ships (they
 * mirror lib/capabilities.ts), and every blueprint named is a real installable
 * one in marketplace-catalog/blueprints.
 *
 * ## Growing this list
 *
 * Six industries ship first — the ones most likely to walk in the door. The
 * blueprint catalog already covers twenty (schools, clinics, hotels, farms,
 * freight, law and accounting, publishers, venues, wine shops, florists…), so
 * adding one is an entry here plus a blueprint reference; the route, metadata,
 * OG card, sitemap entry and hub card all follow automatically.
 *
 * Data-as-code: this file IS the catalog, so it is exempt from the file-size
 * rule the same way registry.ts in ../tools and lib/capabilities.ts are.
 */
import type { LucideIcon } from 'lucide-react';
import { Hammer, PenTool, Scissors, ShoppingBag, UtensilsCrossed, Wrench } from 'lucide-react';
import type { FaqItem } from '../faq';
import type { MarketingModule } from '../primitives';

/** A module a vertical's stack can contain. Every key must exist in the pricing
 *  LEDGER — ./stack.ts fails loudly at build time if one does not. */
export type StackModule = Extract<
  MarketingModule,
  | 'builder'
  | 'commerce'
  | 'cms'
  | 'crm'
  | 'email'
  | 'b2b'
  | 'ai'
  | 'dropship'
  | 'scheduling'
  | 'invoicing'
  | 'inventory'
  | 'chat'
>;

/** One thing this kind of business needs done, and the module that does it. The
 *  module is not decoration: it colors the card AND tells the reader which line
 *  of the price table below they are paying for. */
export interface VerticalJob {
  module: StackModule;
  /** Plain-language outcome, not a feature name. "Bays booked, not
   *  double-booked" — never "resource-constrained scheduling". */
  title: string;
  body: string;
}

export interface Vertical {
  /** URL segment: /for/<slug>. Chosen for how people SEARCH, not for our
   *  internal naming — "auto-shops", never "garage" (which is our blueprint's
   *  codename and nobody's search term). */
  slug: string;
  /** Hub card + breadcrumb label. */
  label: string;
  /** The business, as a noun phrase used mid-sentence: "what a salon pays". */
  subject: string;
  /** Plural, for headings: "salons". */
  plural: string;
  /** H1. Deliberately similar across pages — the SUBJECT is what varies, and a
   *  visitor arriving from one ad never sees the other five. */
  headline: string;
  /** The one paragraph under the H1. Says what they get and what it replaces. */
  lede: string;
  /** The page's hue. Set to the module this industry is most likely to be won
   *  on, so the color carries information rather than decorating the page — and
   *  so six pages do not all render in the same one. */
  lead: StackModule;
  icon: LucideIcon;
  /** The other names this same business goes by. Renders as real on-page content
   *  (a visitor scanning for their own trade) and is the honest way to cover
   *  near-synonym searches without spinning up six thin pages per industry. */
  alsoCalled: string[];
  /** The modules this business turns on, in the order they matter to it. Drives
   *  the price table, the totals, and the savings figure. */
  stack: StackModule[];
  /** Modules that some businesses of this kind add, with the reason. Kept OUT of
   *  `stack` so the headline price stays the price of the common case. */
  alsoConsider?: { module: StackModule; because: string }[];
  jobs: VerticalJob[];
  /** The installable starting point in the blueprint catalog. `id` is the real
   *  marketplace listing slug — /market/blueprints/<id>. */
  blueprint: { id: string; name: string; tuned: string };
  faq: FaqItem[];
  /** <title>. Front-loads the phrase someone would actually type. */
  seoTitle: string;
  /** <meta name="description">. */
  seoDescription: string;
  keywords: string[];
}

export const VERTICALS: Vertical[] = [
  // ── Beauty & salons ────────────────────────────────────────────────────────
  {
    slug: 'salons',
    label: 'Beauty & salons',
    subject: 'a salon',
    plural: 'salons',
    headline: 'Everything a salon needs to run',
    lede: 'Take bookings around the clock, hold the chair with a deposit, keep every client’s history where the whole team can see it, and send the reminder that stops a no-show. One system, one bill, no web person on retainer.',
    lead: 'scheduling',
    icon: Scissors,
    alsoCalled: [
      'hair salons',
      'barbershops',
      'nail bars',
      'spas',
      'lash & brow studios',
      'massage therapists',
      'med spas',
    ],
    stack: ['builder', 'scheduling', 'crm', 'commerce', 'email'],
    jobs: [
      {
        module: 'scheduling',
        title: 'Booking that never closes',
        body: 'Clients pick the stylist, the service and the time from your own site, at eleven at night if that is when they think of it. Your calendar updates as they book, each person keeps their own hours, and nobody gets double-booked.',
      },
      {
        module: 'commerce',
        title: 'A deposit holds the chair',
        body: 'An empty chair is a lost afternoon. Ask for a deposit when the booking is made, set how much notice you need to cancel, and put the deposit toward the bill on the day.',
      },
      {
        module: 'crm',
        title: 'Every client, remembered',
        body: 'Color formula, allergies, what they had last time, what they bought, what they said. It is on the client’s record before they sit down — and it is there for whoever is covering.',
      },
      {
        module: 'email',
        title: 'The reminder that saves the slot',
        body: 'Confirmation when they book, a reminder the day before, and a quiet note to anyone you have not seen in a few months. Written once, sent automatically, from your own address.',
      },
      {
        module: 'commerce',
        title: 'Sell what is on the shelf',
        body: 'The shampoo they always ask for, gift cards in December, a package of six. Same checkout as the booking, and the purchase lands on the same client record.',
      },
      {
        module: 'builder',
        title: 'Change it yourself, in a minute',
        body: 'Prices went up, someone new joined, the hours changed for a holiday. Edit it in your browser and it is live — no email to a web designer, no waiting a week.',
      },
    ],
    blueprint: { id: 'sparx-salon', name: 'Salon', tuned: 'hair, beauty, nails and spa' },
    faq: [
      {
        id: 'salons-stylists',
        question: 'Can clients book a specific stylist?',
        answer:
          'Yes. Each person on the team has their own hours, their own services and their own calendar, so a client can book “Tuesday with Amara” rather than just “Tuesday”. You can also let them book by service and have the system offer whoever is free.',
      },
      {
        id: 'salons-deposit',
        question: 'Can I take a deposit when someone books?',
        answer:
          'Yes. You choose the amount — a flat fee or a percentage — and it is collected at the time of booking. It applies to the final bill automatically. You also set your own cancellation window, so a late cancellation keeps the deposit if that is your policy.',
      },
      {
        id: 'salons-retail',
        question: 'Do I have to sell products to use this?',
        answer:
          'No. Every module is separate and you turn on only what you want. A salon that just wants a site and a booking calendar pays for exactly those two. If you decide to sell retail or gift cards later, you switch Commerce on then and nothing else has to change.',
      },
      {
        id: 'salons-existing-site',
        question: 'What if I already have a website?',
        answer:
          'You can keep it and use sparx for bookings and clients, or move the site across and have everything in one place. Moving is the more common choice — your domain points at sparx, the secure certificate is issued for you, and the old links keep working.',
      },
    ],
    seoTitle: 'Salon booking, website and client records — all in one',
    seoDescription:
      'Online booking, deposits, client history, retail and reminders for hair, beauty, nail and spa businesses. One system instead of five subscriptions. See what a salon actually pays.',
    keywords: [
      'salon booking software',
      'hair salon website',
      'barbershop booking system',
      'nail salon appointment software',
      'spa booking and client records',
      'salon software with deposits',
    ],
  },

  // ── Auto shops ─────────────────────────────────────────────────────────────
  {
    slug: 'auto-shops',
    label: 'Auto shops',
    subject: 'an auto shop',
    plural: 'auto shops',
    headline: 'Everything an auto shop needs to run',
    lede: 'Book the bay, quote the job, sell the part, invoice the customer, and keep the whole history against the vehicle instead of in someone’s head. One system, one bill, and it works on a phone with oily hands.',
    lead: 'invoicing',
    icon: Wrench,
    alsoCalled: [
      'repair shops',
      'service centers',
      'tire and exhaust',
      'body shops',
      'mobile mechanics',
      'parts counters',
      'diesel and fleet workshops',
    ],
    stack: ['builder', 'scheduling', 'invoicing', 'crm', 'commerce', 'inventory'],
    alsoConsider: [
      {
        module: 'b2b',
        because:
          'you serve trade or fleet accounts that buy on account — agreed pricing, purchase orders, and payment on terms rather than card at the counter',
      },
    ],
    jobs: [
      {
        module: 'invoicing',
        title: 'Quote it, then turn it into the invoice',
        body: 'Send the estimate from the workshop. When they say go, it becomes an invoice with a pay-by-card link on it — the same lines, no re-typing, and you can see what has been paid without opening a spreadsheet.',
      },
      {
        module: 'scheduling',
        title: 'Bays booked, not double-booked',
        body: 'Customers pick a slot from your own site and your schedule fills itself. Different jobs take different amounts of time, so the system reserves the right amount and stops the day being over-promised by lunchtime.',
      },
      {
        module: 'crm',
        title: 'The history stays with the vehicle',
        body: 'Every job, part, and note recorded against the car as well as the customer. Next time it rolls in you already know what you did, what you warned them about, and what is due.',
      },
      {
        module: 'commerce',
        title: 'Sell parts over the counter and online',
        body: 'The same catalog serves the counter and the website. Customers can search by what fits their vehicle rather than by part number, which is the difference between a sale and a phone call.',
      },
      {
        module: 'inventory',
        title: 'Know what is actually on the shelf',
        body: 'Stock counts down as you sell and back up as you receive, across the workshop and the counter. A low-stock warning arrives before you find out mid-job.',
      },
      {
        module: 'builder',
        title: 'A site that says what you do',
        body: 'Services, hours, the makes you specialize in, and a booking button. Edit it yourself when any of that changes — it is live the moment you save.',
      },
    ],
    blueprint: { id: 'sparx-garage', name: 'Garage', tuned: 'vehicle service, repair and parts' },
    faq: [
      {
        id: 'auto-fleet',
        question: 'Can I take fleet or trade accounts on terms?',
        answer:
          'Yes, by adding the B2B module. That gives each account its own agreed pricing, a credit limit, purchase-order checkout and payment on terms rather than card up front, plus vehicles tracked by VIN and cost center. It is a separate module because most shops do not need it — if you do, it switches on without changing anything else.',
      },
      {
        id: 'auto-parts-online',
        question: 'Do I have to sell parts online?',
        answer:
          'No. Plenty of shops run this as a site, a booking calendar and invoicing, and never turn Commerce on. If you do sell parts, you get the online shop and the counter from the same catalog rather than keeping two.',
      },
      {
        id: 'auto-booking',
        question: 'Can customers book a service themselves?',
        answer:
          'Yes, and you keep control of it. You decide which jobs are bookable online, how long each takes, how much notice you need, and how many can run at once. Anything you would rather talk about first can be an enquiry instead of a booking.',
      },
      {
        id: 'auto-phone',
        question: 'Does it work on a phone in the workshop?',
        answer:
          'Yes. Everything — the diary, the estimate, the invoice, the vehicle history — works in a phone browser. There is nothing to install and no per-person charge, so every technician can have it.',
      },
    ],
    seoTitle: 'Auto repair shop software — booking, invoicing and parts',
    seoDescription:
      'Online booking, estimates that become invoices, vehicle history, parts and stock for repair shops, service centers and mobile mechanics. One system instead of five. See what an auto shop actually pays.',
    keywords: [
      'auto repair shop software',
      'mechanic booking system',
      'auto shop invoicing software',
      'garage management software',
      'auto parts website',
      'vehicle service history software',
    ],
  },

  // ── Tattoo & piercing studios ──────────────────────────────────────────────
  {
    slug: 'tattoo-studios',
    label: 'Tattoo & piercing studios',
    subject: 'a studio',
    plural: 'tattoo studios',
    headline: 'Everything a tattoo studio needs to run',
    lede: 'A portfolio that does the selling, an enquiry form that filters out the time-wasters, a deposit before the day is held, and every reference and consent form kept against the client. One system, one bill, and the work stays yours.',
    lead: 'cms',
    icon: PenTool,
    alsoCalled: [
      'tattoo shops',
      'piercing studios',
      'permanent makeup',
      'body art',
      'resident and guest artists',
      'private studios',
    ],
    stack: ['builder', 'cms', 'scheduling', 'commerce', 'crm'],
    jobs: [
      {
        module: 'cms',
        title: 'A portfolio built for the work',
        body: 'Galleries by artist, by style, by healed piece. Upload from your phone between clients and it is published in seconds. The work is the pitch, so it gets the whole page rather than a corner of one.',
      },
      {
        module: 'scheduling',
        title: 'Consultations and sessions, per artist',
        body: 'Each artist keeps their own availability, their own session lengths and their own booking rules. A guest spot is a few days on the calendar, not a rebuild of the whole calendar.',
      },
      {
        module: 'commerce',
        title: 'A deposit before the day is held',
        body: 'A no-show costs a full day. Take a deposit when the session is booked, apply it to the final price, and set the notice you need. Your policy, enforced by the system rather than by an awkward conversation.',
      },
      {
        module: 'crm',
        title: 'References, notes and forms in one place',
        body: 'The reference images they sent, the placement and sizing you agreed, aftercare notes, and the signed consent form — all on one client record, so the second session starts where the first one ended.',
      },
      {
        module: 'commerce',
        title: 'Gift cards, aftercare and merch',
        body: 'Sell the aftercare balm you actually recommend, flash prints, and gift cards for a session. Same checkout, and it lands on the same client record as the booking.',
      },
      {
        module: 'builder',
        title: 'Your own site, not a rented profile',
        body: 'On your own domain, with your own look. Nobody puts another studio’s ad next to your portfolio, and nothing disappears because a platform changed its rules.',
      },
    ],
    blueprint: { id: 'sparx-gallery', name: 'Gallery', tuned: 'artists, makers and portfolios' },
    faq: [
      {
        id: 'tattoo-artists',
        question: 'Can each artist have their own portfolio and calendar?',
        answer:
          'Yes. Each artist gets their own gallery and their own availability, and clients can browse by artist or by style before they enquire. Guest artists work the same way — add them, give them dates, and take them off the calendar when the spot ends.',
      },
      {
        id: 'tattoo-deposit',
        question: 'Can I require a deposit before I hold a date?',
        answer:
          'Yes. Set the amount, and it is taken when the session is booked rather than chased afterwards. It applies to the final price automatically, and your cancellation window decides what happens if they move the date.',
      },
      {
        id: 'tattoo-consent',
        question: 'What about consent forms and reference images?',
        answer:
          'Both live on the client record alongside the booking, so anything you collected at consultation is there at the session. You control who on the team can see a record, and you can export or delete a client’s file on request.',
      },
      {
        id: 'tattoo-enquiry',
        question: 'Can I take enquiries instead of straight bookings?',
        answer:
          'Yes — that is the usual setup. Most studios take a described enquiry with reference images first, then convert it into a booked session once the artist has seen it. You can mix the two: consultations bookable online, sessions by approval.',
      },
    ],
    seoTitle: 'Tattoo studio website, portfolio and booking system',
    seoDescription:
      'Per-artist portfolios, enquiries and consultations, deposits before you hold a date, and consent forms on the client record — for tattoo and piercing studios. See what a studio actually pays.',
    keywords: [
      'tattoo studio website',
      'tattoo booking software',
      'tattoo artist portfolio website',
      'piercing studio booking system',
      'tattoo deposit booking system',
      'tattoo shop management software',
    ],
  },

  // ── Restaurants & cafés ────────────────────────────────────────────────────
  {
    slug: 'restaurants',
    label: 'Restaurants & cafés',
    subject: 'a restaurant',
    plural: 'restaurants',
    headline: 'Everything a restaurant needs to run',
    lede: 'Take orders for collection and delivery on your own site at your own prices, change the menu yourself when the special sells out, book the table, and email the regulars. One system, one bill, and no commission on every order.',
    lead: 'commerce',
    icon: UtensilsCrossed,
    alsoCalled: [
      'cafés',
      'bakeries',
      'bars',
      'food trucks',
      'caterers',
      'delis',
      'coffee roasters',
    ],
    stack: ['builder', 'commerce', 'scheduling', 'email', 'inventory'],
    jobs: [
      {
        module: 'commerce',
        title: 'Orders on your site, not someone else’s',
        body: 'Collection and delivery ordering you own, at the prices you set. The difference between paying a delivery app a quarter of every order and paying a flat monthly fee is most of a wage.',
      },
      {
        module: 'builder',
        title: 'A menu you change yourself',
        body: 'Sold out of the special, put the prices up, added a Sunday roast. Change it in the browser and it is live before the next order comes in — no agency, no ticket, no PDF menu from 2023.',
      },
      {
        module: 'scheduling',
        title: 'Tables, tastings and private hire',
        body: 'Take bookings for the room, the table or the whole place, with your own covers and sittings. Deposits on large parties, so a twelve-top that vanishes costs somebody other than you.',
      },
      {
        module: 'email',
        title: 'The regulars hear it first',
        body: 'A list you actually own, from your own address. New menu, a supper club, closed for remodeling — one message rather than hoping the algorithm shows it to the people who already come in.',
      },
      {
        module: 'inventory',
        title: 'Stock that counts itself down',
        body: 'When the last one sells, it comes off the site by itself rather than after an apologetic phone call. Low-stock warnings tell you before service, not during it.',
      },
      {
        module: 'commerce',
        title: 'Gift cards and catering deposits',
        body: 'Sell gift cards year-round and take a deposit on a catering job when it is booked. Both are money in before the work, and both use the same checkout as everything else.',
      },
    ],
    blueprint: { id: 'sparx-kitchen', name: 'Kitchen', tuned: 'restaurants, cafés and bakeries' },
    faq: [
      {
        id: 'restaurants-delivery-apps',
        question: 'Do I still need the delivery apps?',
        answer:
          'That is your call, and most places run both for a while. The apps bring people who have never heard of you; your own ordering page keeps the ones who have. Every order that moves across from an app to your own site keeps roughly a quarter to a third of its value in your register instead of theirs.',
      },
      {
        id: 'restaurants-reservations',
        question: 'Can I take table reservations too?',
        answer:
          'Yes, with the Scheduling module. You set the sittings, the covers, how far ahead people can book and how much notice you need to cancel. Large parties can require a deposit, and confirmations and reminders go out automatically.',
      },
      {
        id: 'restaurants-menu-changes',
        question: 'How hard is it to change the menu?',
        answer:
          'You edit it in your browser like a document and press publish. Sold-out items can also take themselves off when stock runs out, so nobody orders the last portion twice.',
      },
      {
        id: 'restaurants-devices',
        question: 'Does it work on the tablet by the pass?',
        answer:
          'Yes — orders, menu edits and bookings all work in a browser on any device, and there is no charge per person, so front of house and the kitchen can both have it open.',
      },
    ],
    seoTitle: 'Restaurant website and online ordering — no commission',
    seoDescription:
      'Your own collection and delivery ordering, a menu you edit yourself, table bookings, and email to your regulars — for restaurants, cafés and bakeries. See what a restaurant actually pays.',
    keywords: [
      'restaurant website builder',
      'online ordering system for restaurants',
      'commission free food ordering',
      'cafe website with online ordering',
      'restaurant table booking system',
      'bakery online shop',
    ],
  },

  // ── Trades & home services ─────────────────────────────────────────────────
  {
    slug: 'home-services',
    label: 'Trades & home services',
    subject: 'a trade business',
    plural: 'trade and home-service businesses',
    headline: 'Everything a trade business needs to run',
    lede: 'Quote from the van, book the visit, invoice when the job is signed off, and keep every property, part and promise on one record instead of a notebook, a text thread and a spreadsheet. One system, one bill.',
    lead: 'crm',
    icon: Hammer,
    alsoCalled: [
      'plumbers',
      'electricians',
      'heating & cooling',
      'landscapers',
      'cleaners',
      'roofers',
      'carpenters',
      'pest control',
    ],
    stack: ['builder', 'crm', 'scheduling', 'invoicing', 'email'],
    jobs: [
      {
        module: 'crm',
        title: 'Every job against the address',
        body: 'What you fitted, which part, what it cost, what you told them, and the photo you took before you closed the wall up. On the property record — so the callout in two years takes ten minutes rather than an afternoon.',
      },
      {
        module: 'invoicing',
        title: 'Quote from the van, invoice from the van',
        body: 'Send the estimate before you have left the driveway. When they accept, it becomes an invoice with a card link on it. You can see what is unpaid without opening a spreadsheet, and the reminder goes out without you having the conversation.',
      },
      {
        module: 'scheduling',
        title: 'Visits booked without the phone tag',
        body: 'Customers pick a slot you have actually made available, and you keep the shape of the day: travel time between jobs, how many can run at once, and how much notice you need.',
      },
      {
        module: 'email',
        title: 'Follow-ups that bring the work back',
        body: 'The annual service, the furnace check, the “it has been a year since we did your gutters” note. Written once and sent when the time comes, from your own address rather than your personal inbox.',
      },
      {
        module: 'crm',
        title: 'Nothing falls through',
        body: 'A new enquiry creates the job. A finished job triggers the invoice. An unpaid invoice chases itself. The parts you set up once keep running whether or not you remembered them that week.',
      },
      {
        module: 'builder',
        title: 'A site that proves you are real',
        body: 'What you do, where you work, your registration numbers, photos of finished jobs, and a way to get in touch. This is what someone checks before they let you into their house — and you can change it yourself.',
      },
    ],
    blueprint: {
      id: 'sparx-hearth',
      name: 'Hearth',
      tuned: 'home services, interiors and furnishings',
    },
    faq: [
      {
        id: 'trades-booking',
        question: 'Can customers book a visit online?',
        answer:
          'Yes, and you decide how much freedom they get. Some trades open up straightforward jobs for online booking and take everything else as an enquiry first. You set the slot lengths, the notice you need, the travel gap between jobs and how many can overlap.',
      },
      {
        id: 'trades-payment',
        question: 'Can I take payment on site?',
        answer:
          'Yes. An invoice carries a pay-by-card link, so you can hand them your phone or send it while you are packing up. Card and bank payment both come in through Stripe at their standard rates — sparx does not add a percentage of its own.',
      },
      {
        id: 'trades-team',
        question: 'What if I have a team out in vans?',
        answer:
          'Everyone gets an account and there is no per-person charge, so the whole team can be on it. Each person has their own calendar and their own availability, and the jobs, notes and photos land on the same shared records.',
      },
      {
        id: 'trades-products',
        question: 'Do I need to sell anything to use this?',
        answer:
          'No. Most trades never turn Commerce on — a site, a calendar, customer records and invoicing is the whole job. If you do start selling parts or maintenance plans, that is a module you add later without disturbing the rest.',
      },
    ],
    seoTitle: 'Software for trades — quotes, jobs, invoices and a website',
    seoDescription:
      'Quotes that become invoices, online booking, job history against the property, and a website you can edit — for plumbers, electricians, heating engineers, landscapers and cleaners. See what it actually costs.',
    keywords: [
      'software for tradesmen',
      'plumber invoicing software',
      'electrician job management software',
      'home services scheduling software',
      'trade business website',
      'field service quotes and invoices',
    ],
  },

  // ── Boutiques & local retail ───────────────────────────────────────────────
  {
    slug: 'boutiques',
    label: 'Boutiques & local retail',
    subject: 'a shop',
    plural: 'boutiques and local shops',
    headline: 'Everything a shop needs to run',
    lede: 'Sell online without keeping a second stock list, hold one customer record whether they bought in the shop or on the site, and email the people who already love you. One system, one bill, and a percentage of nothing goes anywhere else.',
    lead: 'inventory',
    icon: ShoppingBag,
    alsoCalled: [
      'clothing shops',
      'gift shops',
      'bookstores',
      'home goods',
      'florists',
      'pet shops',
      'wine shops',
      'makers',
    ],
    stack: ['builder', 'commerce', 'inventory', 'crm', 'email'],
    alsoConsider: [
      {
        module: 'dropship',
        because:
          'you want to list ranges you do not hold — the supplier ships direct, and your margin is set by a rule rather than by hand',
      },
    ],
    jobs: [
      {
        module: 'inventory',
        title: 'One stock count, not two',
        body: 'The shelf and the website read from the same number. Sell the last one in the shop and it comes off the site by itself — no oversold order, no apology email, no keeping a spreadsheet in step by hand.',
      },
      {
        module: 'commerce',
        title: 'A shop online that matches the real one',
        body: 'Sizes, colors, bundles, and a checkout that takes cards, Apple Pay and the rest. Your prices, your delivery rules, and no extra percentage taken on top of the card fee for the privilege.',
      },
      {
        module: 'crm',
        title: 'One customer, however they bought',
        body: 'The regular who comes in on Saturdays and orders online at Christmas is one person, not two rows in two systems. What they have bought, what they have spent and what they have opened all sit on the same record.',
      },
      {
        module: 'email',
        title: 'A list you actually own',
        body: 'New stock in, the sale starts Friday, we are closed for stocktake. Sent from your own address to a list nobody can take away from you or throttle to a tenth of its size.',
      },
      {
        module: 'commerce',
        title: 'Collect in store, deliver locally',
        body: 'Reserve online and collect, a local delivery round on Thursdays, or post it. Different rules for different ZIP codes, set once, without an app for each one.',
      },
      {
        module: 'builder',
        title: 'Change it yourself, any day',
        body: 'A window display changes weekly; a website should be no harder. Swap the front page, add the Christmas hours, put the new range up — in the browser, live when you save it.',
      },
    ],
    blueprint: {
      id: 'sparx-boutique',
      name: 'Boutique',
      tuned: 'small fashion and independent retail',
    },
    faq: [
      {
        id: 'boutiques-stock',
        question: 'Do I have to keep two stock lists?',
        answer:
          'No — that is the point of running Inventory alongside Commerce. There is one count, and the shop and the website both read from it. It also comes free with Commerce, so it is not a separate bill.',
      },
      {
        id: 'boutiques-collect',
        question: 'Can customers reserve online and collect in store?',
        answer:
          'Yes. Click-and-collect, local delivery with your own rules and ZIP codes, and normal shipping all run side by side. You decide which are offered, and to whom.',
      },
      {
        id: 'boutiques-fees',
        question: 'Do you take a percentage of my sales?',
        answer:
          'No. You pay the monthly module price and your card processor’s normal fee, and nothing else. Hosted shop platforms commonly add 0.6–2% on top of that when you use your own processor; sparx adds nothing.',
      },
      {
        id: 'boutiques-migrate',
        question: 'Can I move from the platform I am on now?',
        answer:
          'Yes. Products, customers and past orders import from the common shop platforms, and page links from your old site can be redirected so search results and bookmarks still land somewhere. Most small shops are across in under a week.',
      },
    ],
    seoTitle: 'Website and online shop for boutiques and local retail',
    seoDescription:
      'One stock count across the shop and the website, one customer record however they bought, click-and-collect, local delivery and email — for boutiques, gift shops and independent retail.',
    keywords: [
      'boutique website builder',
      'online shop for small retail',
      'retail inventory and ecommerce',
      'click and collect website',
      'gift shop online store',
      'independent retail ecommerce platform',
    ],
  },
];

export const VERTICAL_SLUGS = VERTICALS.map((v) => v.slug);

export function getVertical(slug: string): Vertical | undefined {
  return VERTICALS.find((v) => v.slug === slug);
}
