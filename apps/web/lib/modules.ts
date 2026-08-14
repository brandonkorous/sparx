/**
 * Single source of truth for per-module marketing pages. Each module page
 * route (`app/builder/page.tsx`, etc.) and its OG image hydrates from
 * the matching entry here. See docs/sparx-brand-guide.md for the colors
 * and the per-module marketing-domain map.
 */
import type { MarketingModule } from '@/components/marketing/primitives';

/** The modules that have a dedicated marketing landing page today. Invoicing and
 *  Live Chat are billable modules (see modules-catalog.ts) but do not yet have
 *  standalone pages, so they are intentionally absent from this map. Add a slug
 *  here when its page ships. */
export type ModulePageSlug = Extract<
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
  | 'social'
  | 'finance'
  | 'staff'
  | 'inventory'
>;

export interface ModuleFeature {
  number: string;
  title: string;
  body: string;
}

export interface ModulePricing {
  price: string;
  period: string;
  /** e.g. "+$49" appears as additive when bundled, "$49" appears as standalone */
  modifier?: '+' | '';
  bundleNote: string;
}

export interface ModuleMeta {
  slug: string;
  module: MarketingModule;
  /** Chip label on the OG card (e.g. "Builder", "AI") — matches the module's
   *  dashboard manifest label, not a widened marketing variant. */
  label: string;
  /** Tagline for hero headline — pair with `headlineSecondary` for the lede line */
  headlinePrimary: string;
  headlineSecondary: string;
  /** Used in <title> and OG */
  title: string;
  description: string;
  lede: string;
  features: ModuleFeature[];
  pricing: ModulePricing;
  /** External marketing domain for this module, if it has one */
  marketingDomain?: string;
}

export const MODULES: Record<ModulePageSlug, ModuleMeta> = {
  builder: {
    slug: 'builder',
    module: 'builder',
    label: 'Builder',
    headlinePrimary: 'Your site,',
    headlineSecondary: 'live',
    title: 'sparx Builder — your site, live in 5 minutes',
    description:
      'The website module. Pick a theme, edit in the browser, point your domain — SSL and CDN handled. Content site or store, live in 5 minutes. $10/mo.',
    lede: 'The website module. Pick a theme, edit blocks in the browser, point your domain. SSL and the global CDN are handled for you. The same builder serves a one-page portfolio, a 40-post blog, or a 50,000-SKU catalog.',
    features: [
      {
        number: '01',
        title: 'Theme-first.',
        body: 'Start from a polished theme, change the parts that matter, publish. Want full control? Build a custom frontend against the same API — coding optional, never required.',
      },
      {
        number: '02',
        title: 'Block editor.',
        body: 'Drag, drop, edit in the browser. Every block is responsive and accessible by default — clean markup, no mystery wrappers, no shadow DOM.',
      },
      {
        number: '03',
        title: 'Custom domain + SSL.',
        body: 'Point your DNS and your certificate provisions itself. No separate DNS service, no certificate to renew, no upcharge.',
      },
      {
        number: '04',
        title: 'CDN-cached.',
        body: 'Pages serve from the edge, fast everywhere. Edits go live the moment you publish — no cache to clear, no wait.',
      },
      {
        number: '05',
        title: 'Headless if you want.',
        body: 'Same data, your own front end. The Builder SDK works with Next.js, Remix, and Astro, with TypeScript types generated from your schema.',
      },
      {
        number: '06',
        title: 'Multi-site, one login.',
        body: 'Run several sites from one sparx account. Each site has its own domain, theme, and module mix — billed together, switched between in a click.',
      },
    ],
    pricing: {
      price: '$10',
      period: '/mo',
      modifier: '',
      bundleNote:
        "Builder hosts and serves your site — pages, custom domains, SSL, and the global CDN. It's a module, not a required base: switch it on when you want a hosted sparx site, leave it off and run headless through the API and MCP. One bill with everything else.",
    },
  },
  commerce: {
    slug: 'commerce',
    module: 'commerce',
    label: 'Commerce',
    headlinePrimary: 'Sell, ship,',
    headlineSecondary: 'get paid',
    title: 'sparx Commerce — Sell, ship, get paid.',
    description:
      'Products, inventory, a checkout that converts, Stripe payments, and order operations at real volume. The transactional core of sparx — headless or hosted.',
    lede: 'Products and inventory, a checkout that converts, Stripe payments, tax and carrier rates wired in. D2C and B2B from the same engine. Run it headless on the API or pair it with Builder for a hosted site.',
    features: [
      {
        number: '01',
        title: 'Inventory that tracks.',
        body: 'Per-variant counts, deny or backorder policy, low-stock thresholds that publish alerts. Bulk-adjust by CSV or API — read live, never stale.',
      },
      {
        number: '02',
        title: 'Checkout that converts.',
        body: 'Single-page, address autocomplete, saved payment methods, Apple Pay, Google Pay, and Link. Conversion-tuned out of the box.',
      },
      {
        number: '03',
        title: 'Stripe payments.',
        body: 'Take cards through sparx Pay for a flat 0.5%, or connect your own Stripe, PayPal, or Square account and pay sparx nothing on the payment at all.',
      },
      {
        number: '04',
        title: 'Tax & shipping.',
        body: 'TaxJar or Avalara for tax; carrier rates (FedEx, UPS, USPS) via EasyPost, plus flat-rate rules and local pickup. Plug your account, done.',
      },
      {
        number: '05',
        title: 'Discounts & promotions.',
        body: 'Percentage, fixed amount, free shipping, buy-X-get-Y. Code or automatic, with minimums, date windows, and usage limits.',
      },
      {
        number: '06',
        title: 'Order ops at scale.',
        body: 'Multi-fulfillment partial shipments, bulk order operations, refunds that restock, and a full order timeline. Built for actual shipping volume.',
      },
    ],
    pricing: {
      price: '$49',
      period: '/mo',
      modifier: '',
      bundleNote:
        'A flat $49/mo with Invoicing and Inventory bundled in free. Pair it with Builder for a hosted site or run it headless against the API — one toggle on one bill, off the moment you stop selling. The only payment fee is 0.5% on sparx Pay; bring your own card processor and there is none.',
    },
  },
  cms: {
    slug: 'cms',
    module: 'cms',
    label: 'CMS',
    headlinePrimary: 'Words, media,',
    headlineSecondary: 'SEO',
    title: 'sparx CMS — Words, media, SEO.',
    description:
      'Editor, blog, media library, structured content. Works standalone — no Builder required.',
    lede: 'Editor, blog, media library, structured content. Works standalone — no Builder required. The same publishing toolset whether you sell something or just write.',
    features: [
      {
        number: '01',
        title: 'Block editor, fast.',
        body: 'No nested-popover hell. Type, format, embed, publish. Autosave on every keystroke; revisions on every save.',
      },
      {
        number: '02',
        title: 'Structured content.',
        body: 'Define content types (Recipe, Author, Case Study), generate forms automatically. Schema-aware, type-safe API.',
      },
      {
        number: '03',
        title: 'Media library.',
        body: 'Drag-drop with auto-WebP/AVIF transcode, focal-point cropping, alt-text suggestions. CDN-served.',
      },
      {
        number: '04',
        title: 'SEO that works.',
        body: 'Per-page meta + OG, sitemaps generated, JSON-LD inferred from your content types. Lighthouse-scored on publish.',
      },
      {
        number: '05',
        title: 'Standalone or paired.',
        body: 'Use CMS alone for a content site. Pair with Builder + Commerce and your blog and shop share one design system.',
      },
      {
        number: '06',
        title: 'API + GraphQL.',
        body: 'Headless out of the box. Fetch content for a separate Next.js, Astro, or mobile app. Webhook on publish.',
      },
    ],
    pricing: {
      price: '$49',
      period: '/mo',
      modifier: '',
      bundleNote:
        'A flat $49/mo that runs standalone — no Builder required. Add Builder when you want it rendered on a hosted sparx site. One bill with everything else, cancel anytime.',
    },
    marketingDomain: 'sparxcms.com',
  },
  crm: {
    slug: 'crm',
    module: 'crm',
    label: 'CRM',
    headlinePrimary: 'Customers,',
    headlineSecondary: 'pipeline, signal',
    title: 'sparx CRM — Customers, pipeline, signal.',
    description:
      'Activity log, automations, segments. Built on your commerce data — not stitched to it.',
    lede: 'Activity log, automations, segments — sitting on top of the same database as your orders. No sync, no Zapier, no "the HubSpot record disagrees with the Shopify record."',
    features: [
      {
        number: '01',
        title: 'One customer record.',
        body: 'Orders, support tickets, RFQs, marketing email opens, AI conversations — all attached to the same person. No deduping.',
      },
      {
        number: '02',
        title: 'Dynamic segments.',
        body: "Build audiences from any signal: spent over X, hasn't reordered in N days, opened the last email but didn't buy. Sync to Email automatically.",
      },
      {
        number: '03',
        title: 'Pipeline that knows commerce.',
        body: 'Deal stages tied to order status. Quote sent → quote accepted → invoice paid, visible on one card.',
      },
      {
        number: '04',
        title: 'Automations.',
        body: 'When X happens, do Y. Trigger emails, tag customers, create tasks, fire webhooks. Visual builder, no code.',
      },
      {
        number: '05',
        title: 'Activity timeline.',
        body: 'Every interaction in chronological order. Phone notes, support replies, order events. Your full picture of a customer.',
      },
      {
        number: '06',
        title: 'Built for sales teams.',
        body: 'Assigned reps, deal owners, commission-trackable activities. Multi-seat with per-seat permissions.',
      },
    ],
    pricing: {
      price: '$49',
      period: '/mo',
      modifier: '+',
      bundleNote:
        'A flat $49/mo. It sits on the same database as your orders and content — no sync, no glue — so switch it on alongside whatever modules you already run. One bill, off anytime.',
    },
    marketingDomain: 'sparxcrm.com',
  },
  email: {
    slug: 'email',
    module: 'email',
    label: 'Email',
    headlinePrimary: 'Transactional',
    headlineSecondary: 'and marketing',
    title: 'sparx Email — Transactional and marketing.',
    description:
      'Transactional + marketing email on your own domain. SPF, DKIM, and DMARC auto-configured; no per-email markup. $29/mo.',
    lede: 'Transactional and marketing email, sent from your own domain and your reputation. Every message is triggered by a real platform event, rendered on-brand, and authenticated with SPF, DKIM, and DMARC the moment your domain verifies. No per-email markup.',
    features: [
      {
        number: '01',
        title: 'Transactional out of the box.',
        body: 'Order confirmations, shipping updates, password resets, quote replies — triggered by platform events and wired into every module. Templates editable, brandable.',
      },
      {
        number: '02',
        title: 'Marketing broadcasts.',
        body: 'Compose, preview against a real customer, send or schedule. Target live CRM segments — no list export, ever — and watch opens and clicks roll in.',
      },
      {
        number: '03',
        title: 'Your domain, your reputation.',
        body: 'Sends from orders@yourbrand.com once your domain verifies, not a shared blast domain. Until then, mail goes out on the shared sparx domain so you are never blocked.',
      },
      {
        number: '04',
        title: 'DKIM, SPF, DMARC.',
        body: 'Auto-configured with your sending domain. sparx adds the DNS records, polls for verification, monitors failures, and alerts on reputation drops.',
      },
      {
        number: '05',
        title: 'No per-email pricing.',
        body: 'Send 10K or 1M emails a month — same $29/mo. One flat price, no per-email fees and no contact-tier surcharges.',
      },
      {
        number: '06',
        title: 'Open, click, bounce events.',
        body: 'Tracked back onto the customer record in the CRM, available via webhook and MCP. Your AI can see who opened what.',
      },
    ],
    pricing: {
      price: '$29',
      period: '/mo',
      modifier: '+',
      bundleNote:
        'A flat $29/mo — send 10K or 1M a month for the same price. Switch it on and transactional + marketing wire into every module you run. One bill, no per-email metering.',
    },
    marketingDomain: 'sparxemail.com',
  },
  b2b: {
    slug: 'b2b',
    module: 'b2b',
    label: 'B2B · Wholesale · Fleet',
    headlinePrimary: 'Wholesale,',
    headlineSecondary: 'done right',
    title: 'sparx B2B — Account pricing, net terms, RFQ.',
    description:
      'Account-specific price lists, RFQ to quote, net terms and credit limits, bulk PO ordering, and fleet accounts — wholesale layered on the same catalog and checkout as D2C.',
    lede: 'Account-specific price lists, RFQ to quote, net terms and credit limits, bulk PO ordering, and fleet accounts — wholesale that runs on the same catalog and checkout as your retail orders. Each buyer logs in to their negotiated price and their terms. $99/mo, layered on Commerce.',
    features: [
      {
        number: '01',
        title: 'Account-tier pricing.',
        body: 'Per-account price lists, volume breaks, contract pricing. Login determines price; no manual quote needed.',
      },
      {
        number: '02',
        title: 'Net terms & POs.',
        body: 'Net 15, 30, 60, 90. PO number required at checkout. Aging reports, statements, dunning — built in.',
      },
      {
        number: '03',
        title: 'Fleet accounts.',
        body: 'Vehicles, drivers, VIN-aware ordering. Service history per unit. PO routing per cost center.',
      },
      {
        number: '04',
        title: 'RFQ & quotes.',
        body: 'Buyers request quotes from a product page. You reply with line-item pricing and expiration. Accepted quotes convert to orders.',
      },
      {
        number: '05',
        title: 'Buyer self-service portal.',
        body: 'Each account gets its own portal: re-order from history, saved lists, multiple buyers with per-seat roles, and live statements. Add the Scheduling module and service appointments book from the same portal.',
      },
      {
        number: '06',
        title: 'Approval workflows.',
        body: 'Spend caps per buyer. Manager approval for orders over a threshold. Multi-step approvals for enterprise customers.',
      },
    ],
    pricing: {
      price: '$99',
      period: '/mo',
      modifier: '+',
      bundleNote:
        'A flat $99/mo, layered on Commerce, with Invoicing and Inventory bundled in free. Wholesale pricing, net terms, RFQ, purchase orders, and fleet accounts — native, on one bill with everything else.',
    },
    marketingDomain: 'sparxb2b.com',
  },
  ai: {
    slug: 'ai',
    module: 'ai',
    // /ai is the customer-facing half of the AI module — the concierge that
    // answers a tenant's website visitors. The tenant-facing MCP / agentic half
    // is its own document at /agentic. Both are the one $49 `ai` module.
    label: 'AI',
    headlinePrimary: 'Answers for',
    headlineSecondary: 'your customers',
    title: 'sparx AI Concierge — answer your customers, on your own AI.',
    description:
      'An AI that answers your website visitors instantly — grounded on your live catalog and policies, and it hands off to a real person the moment it’s unsure. Bring your own Anthropic or OpenAI key; sparx never runs the AI for you.',
    lede: 'Put an AI on your site chat that actually knows your business. It answers from your live products, orders, and policies — not a scraped FAQ — and when it isn’t sure, it hands the conversation to your team instead of guessing. You connect your own AI; the intelligence is always yours.',
    features: [
      {
        number: '01',
        title: 'Answers, not guesses.',
        body: 'Every reply is grounded on your live catalog, order status, and policies — the same records your dashboard shows, the moment they change. No scraped FAQ to go stale.',
      },
      {
        number: '02',
        title: 'Knows when to get a human.',
        body: 'Each answer carries a confidence score. Below the line — or any doubt — it hands off to your team on the staff inbox instead of making something up.',
      },
      {
        number: '03',
        title: 'Bring your own AI.',
        body: 'Connect your own Anthropic or OpenAI key in one screen. sparx runs no AI on your behalf — no key, and every chat simply goes to a person.',
      },
      {
        number: '04',
        title: 'Looks, never touches.',
        body: 'The concierge can look anything up for a customer, but it never places an order or changes a record on their behalf. Reading is automatic; acting stays human.',
      },
      {
        number: '05',
        title: 'Sounds like you.',
        body: 'Set the greeting, the away message, the tone, and the accent color. It opens the way you would and stays on brand through the whole conversation.',
      },
      {
        number: '06',
        title: 'On the clock you choose.',
        body: 'Set operating hours: outside them, customers get your away message and a clean handoff, so no one waits on a bot that should be a person.',
      },
    ],
    pricing: {
      price: '$49',
      period: '/mo',
      modifier: '+',
      bundleNote:
        'A flat $49/mo for the whole AI module — this customer-facing concierge AND agentic MCP access for your own team (that half lives at /agentic). Bring your own AI key; one module, one bill.',
    },
  },
  dropship: {
    slug: 'dropship',
    module: 'dropship',
    label: 'Dropship',
    headlinePrimary: 'Suppliers, sync,',
    headlineSecondary: 'fulfillment',
    title: 'sparx Dropship — Suppliers, sync, fulfillment.',
    description: 'Catalog sync, margin math, automated order routing. Sell without inventory.',
    lede: 'Connect a supplier, import their catalog, set a markup rule, and let orders route themselves. Sell without holding inventory — on a real platform underneath, where your suppliers, products, and orders all live in one place.',
    features: [
      {
        number: '01',
        title: 'Supplier connectors.',
        body: 'Connect Printify, Printful, DSers, or Spocket by API, or import any supplier by CSV feed. Validated on connect, scheduled sync, several suppliers at once.',
      },
      {
        number: '02',
        title: 'Margin math.',
        body: 'Set a per-supplier pricing rule — percentage markup, multiplier, flat markup, or a target margin. sparx prices imported products automatically as supplier costs change.',
      },
      {
        number: '03',
        title: 'Automated routing.',
        body: 'An order comes in and routes to the right supplier instantly. Multi-supplier orders split into a fulfillment group per supplier, with one customer-facing tracking.',
      },
      {
        number: '04',
        title: 'Inventory sync.',
        body: 'Live stock levels pulled from the supplier; out-of-stock combos grey out and a discontinued product is flagged. Print-on-demand suppliers are made-to-order, so stock is unlimited.',
      },
      {
        number: '05',
        title: 'Tracking & fulfillment.',
        body: 'The supplier returns tracking, sparx forwards it to the customer via sparx Email with your branding, and logs the shipment on the customer record.',
      },
      {
        number: '06',
        title: 'No per-order cut.',
        body: 'You connect directly to your own suppliers. sparx is a flat $29/mo — no per-order dropship fee and no reseller markup between you and your supplier.',
      },
    ],
    pricing: {
      price: '$29',
      period: '/mo',
      modifier: '+',
      bundleNote:
        'A flat $29/mo. Connect a supplier, import the catalog, set a markup rule, and route orders automatically — sell without holding inventory. Works alongside Commerce, so imported products land in your catalog and your orders route back to the supplier, all on one bill.',
    },
  },
  scheduling: {
    slug: 'scheduling',
    module: 'scheduling',
    label: 'Scheduling',
    headlinePrimary: 'Every booking,',
    headlineSecondary: 'one engine',
    title: 'sparx Scheduling — Every booking, one engine.',
    description:
      'Appointments, classes, reservations, and rentals on one engine. Deposits, reminders, waitlists, calendar sync — unlimited staff and bookings, one flat $29/mo.',
    lede: 'Appointments, classes, reservations, and rentals on one engine — with deposits, reminders, waitlists, and calendar sync built in. Unlimited staff, resources, and bookings for one flat price. It sits on the same platform as your customers, your payments, and your email, so a booking is part of the business, not a silo.',
    features: [
      {
        number: '01',
        title: 'Every booking shape.',
        body: 'Appointments, capped-roster classes, party reservations, and asset rentals all run on the same engine — a salon chair, a fitness class, a dinner table, a rental bay. Switch on what you book; round-robin and collective availability included.',
      },
      {
        number: '02',
        title: 'Double-booking is impossible.',
        body: 'Availability is computed from real resource calendars, and the no-overlap guarantee is enforced in the database — not hoped for in app code. Two people can hit book on the last slot and exactly one wins.',
      },
      {
        number: '03',
        title: 'Deposits, no-shows, policies.',
        body: 'Take a deposit or hold a card at booking, set per-service cancellation and no-show windows, and charge a fee when someone bails. Payments run through your own gateway — no Commerce module required.',
      },
      {
        number: '04',
        title: 'Reminders & waitlists.',
        body: 'Automatic confirmations and reminders by email and SMS cut no-shows. A full session takes a waitlist that auto-promotes the moment a seat frees — at the session level and across a provider’s whole week.',
      },
      {
        number: '05',
        title: 'Your calendar, in sync.',
        body: 'Subscribe to your bookings in Google, Apple, or Outlook, and import busy time from the calendars you already keep — by iCal feed or CalDAV — so personal commitments block your availability automatically.',
      },
      {
        number: '06',
        title: 'One loop, not five tools.',
        body: 'The booking, the customer, the deposit, the reminder, and the no-show live in one system. A finished visit records to the customer’s history; a no-show updates their lifetime value. Book, remind, take payment, fulfill, follow up — nothing to sync.',
      },
    ],
    pricing: {
      price: '$29',
      period: '/mo',
      modifier: '',
      bundleNote:
        'A flat $29/mo — unlimited staff, resources, locations, and bookings, with no per-seat, per-staff, or per-cover fees, ever. It requires nothing else; deposits just need a connected payment gateway. One bill with everything else, off anytime.',
    },
  },
  social: {
    slug: 'social',
    module: 'social',
    label: 'Social',
    headlinePrimary: 'One post,',
    headlineSecondary: 'every network',
    title: 'sparx Social — One post, every network.',
    description:
      'Compose a post once and publish to Facebook, Instagram, and Pinterest — from the same products and media you already have, each image auto-cropped to fit, scheduled or posted now. Free with sparx.',
    lede: 'Compose a post once, drop in your photos, and send it to Facebook, Instagram, and Pinterest at the time you choose. sparx crops each image to the shape every platform wants, keeps your products and media one click away, and holds each post for approval before it reaches a live account. Free with every sparx plan.',
    features: [
      {
        number: '01',
        title: 'Compose once, post everywhere.',
        body: 'Write the caption a single time and pick which accounts it goes to. sparx fans it out to your Facebook Page, Instagram, and Pinterest boards — no re-typing, no logging into three apps.',
      },
      {
        number: '02',
        title: 'The right shape, automatically.',
        body: 'Upload one photo and sparx derives the feed, story, and landscape crops each network wants — attention-aware, with a draggable focal point so the subject is never cut off. One upload, correct renditions everywhere.',
      },
      {
        number: '03',
        title: 'Schedule or post now.',
        body: 'Send it this instant or line it up for later. Scheduled posts sit in one queue you can see and reorder, and they publish on time without you being at the keyboard.',
      },
      {
        number: '04',
        title: 'Approvals before it goes live.',
        body: 'Nothing reaches a live account unreviewed unless you decide it should. Require approval by default, override per post, and control who on your team is allowed to publish to the brand’s accounts.',
      },
      {
        number: '05',
        title: 'Straight from your catalog.',
        body: 'Post the product you’re already selling or a picture from your media library — the same records the rest of sparx uses. No export, no re-uploading the same photo into yet another tool.',
      },
      {
        number: '06',
        title: 'Free, and it’s yours.',
        body: 'Organic posting is free with every sparx plan. Connect your own Facebook, Instagram, and Pinterest accounts in a click, and disconnect them just as easily — your reach and your audience stay yours.',
      },
    ],
    pricing: {
      price: 'Free',
      period: '',
      modifier: '',
      bundleNote:
        'Free with sparx. Organic posting to Facebook, Instagram, and Pinterest for every tenant — switch it on alongside whatever modules you run, at no added cost and on the same one bill.',
    },
  },
  finance: {
    slug: 'finance',
    module: 'finance',
    label: 'Finance',
    headlinePrimary: 'What you spent,',
    headlineSecondary: 'what you kept',
    title: 'sparx Finance — What you spent, what you kept.',
    description:
      'Track every cost against what actually came in, and see which jobs made money. Not accounting software — your accountant keeps the books and gets a clean export. $29/mo, free with Commerce or B2B.',
    lede: 'Record every cost your business has — parts, wages, rent, fuel, the software nobody remembers signing up for — against what actually came in, so “did we make money” has an answer instead of a shrug. Because sparx already knows what you sold and what each part cost coming off the shelf, half the sum is done before you start. That lets it go one better than a spend tracker: which individual jobs made money, and which quietly did not.',
    features: [
      {
        number: '01',
        title: 'Half the sum is already here.',
        body: 'Your sales, what each part cost at the price you actually paid, and what a marketplace or card processor took are already recorded. Finance reads them where they live rather than asking you to enter them again, so you only ever type the half nothing else in your business has seen.',
      },
      {
        number: '02',
        title: 'Recording a cost takes seconds.',
        body: 'How much, what for, which kind — then Enter, with the cursor back on the amount and the category still set. Rent, insurance and subscriptions are set up once and post themselves every month, and a bank or card statement imports on your bank’s own column layout, with a preview before anything is written.',
      },
      {
        number: '03',
        title: 'Bills to pay, not just money owed.',
        body: 'You already track who owes you, because chasing it is how you get paid. What you owe tends to live in an inbox and a rough sense that rent is due soon. Both directions get the same screen, sorted by how late something is rather than when it arrived.',
      },
      {
        number: '04',
        title: 'Profit, netted against real sales.',
        body: 'What came in, what the work cost, what the wages cost, what it took to keep the doors open, and what was left — for any period, for one of your businesses or all of them, with the period before it alongside. A month that lost money reads red before you parse a minus sign.',
      },
      {
        number: '05',
        title: 'Which jobs were worth doing.',
        body: 'Every order and booking ranked by what you kept on it, worst first, each opening into the parts, the hours and the share of running costs that got it there. A booking valued from a service’s list price rather than a collected amount is labelled as such instead of being averaged into the same column.',
      },
      {
        number: '06',
        title: 'Your accountant keeps the books.',
        body: 'No general ledger, no chart of accounts, no payroll, no tax filing — sparx does not do bookkeeping and is not going to. What it does is hand over a clean export: every cost for a period, posted to the account codes you mapped once, with nothing ever dated inside a month your accountant has already closed.',
      },
    ],
    pricing: {
      price: '$29',
      period: '/mo',
      modifier: '',
      bundleNote:
        'A flat $29/mo standalone — and free with Commerce or B2B, the same way Invoicing and Inventory are. That is not a promotion: profit is what came in minus what went out, a tenant selling through sparx has already bought the revenue half, and billing separately for the part we subtract from it would be charging twice for one number.',
    },
  },
  staff: {
    slug: 'staff',
    module: 'staff',
    label: 'Team',
    headlinePrimary: 'What an hour',
    headlineSecondary: 'actually costs',
    title: 'sparx Team — What an hour of work actually costs.',
    description:
      'Hours, pay rates, shifts, time off and licence renewals — so the biggest cost in your business stops being a guess. Not payroll: sparx records what people worked and what it cost. $29/mo.',
    lede: 'For most businesses that do work rather than ship boxes, wages are the largest single number on the page — and it is usually the one nobody can break down. sparx records who worked, for how long, on what, and at what rate, then hands the answer to your profit figures as a derived number instead of a line you type in and hope. It is not payroll and never will be: nothing here withholds tax, files a return, or pays anybody.',
    features: [
      {
        number: '01',
        title: 'A rate is a row, not a column.',
        body: 'The day someone gets a raise, a system that stores their rate on the person quietly rewrites the cost of every job they have ever worked — and last quarter’s profit moves for a reason nothing on the screen can explain. Here a pay rate has a start date. Give someone a new one and the old one closes the day before, so March still costs what March cost.',
      },
      {
        number: '02',
        title: 'Hours count once somebody says so.',
        body: 'Clock in from a phone or type in the three and a half hours you spent at the Ellison job on Tuesday. Either way it waits until a manager approves it — because a timesheet that pushed straight into the profit figure would mean every mistyped shift moved the month before anyone had looked at it.',
      },
      {
        number: '03',
        title: 'Wages become a real line in Finance.',
        body: 'Approved hours are costed at the rate in force on the day worked, marked up by whatever employer costs you told us about, and filed as spending under Wages — split across your businesses and, where the hours named a job, charged to that job. The wages figure stops being something you estimate.',
      },
      {
        number: '04',
        title: 'Nobody’s hours are ever quietly free.',
        body: 'If somebody worked and no rate covers those dates, sparx does not cost them at zero. The timesheet says so, the total says “so far”, and the derivation reports exactly how many hours it could not price — because a zero here becomes a zero in your profit, and you would read that as a month where labour cost nothing.',
      },
      {
        number: '05',
        title: 'The rota is planned time, not paid time.',
        body: 'Build next week as a draft, publish it in one act, and see approved time off sitting on the same grid so you know who is actually available on Thursday. Nobody is paid from the schedule — a shift is what you planned, a time entry is what happened, and keeping them apart is why the two numbers never quietly become one.',
      },
      {
        number: '06',
        title: 'A lapsed licence finds you first.',
        body: 'Record the tickets, licences and certificates your work depends on, each with as much notice as you need — more for the one you renew by post. Expired shows red on the roster before you assign the job, not after the inspection. A qualification that never expires is recorded as exactly that, and never nags you.',
      },
    ],
    pricing: {
      price: '$29',
      period: '/mo',
      modifier: '',
      bundleNote:
        'A flat $29/mo, whatever size your team is — not per person, because charging per head would price the module against the exact thing it measures. It is not bundled with Finance in either direction: Finance is useful without it, and a business that only wants hours, rotas and licence renewals should not have to buy a spend ledger to get them.',
    },
  },
  // Stock, and the argument for it (docs/146 §5). The claim this whole entry
  // serves is one sentence: the number is right, you can see exactly why, and
  // you were running in an afternoon — without buying a seat for every person in
  // the warehouse. Every feature below is one half of that, and none of them is
  // a capability list item dressed up: the six are ordered as the page's own
  // story, not as a menu.
  inventory: {
    slug: 'inventory',
    module: 'inventory',
    label: 'Inventory',
    headlinePrimary: 'The number',
    headlineSecondary: 'is right',
    title: 'sparx Inventory — The stock number is right, and it can show you why.',
    description:
      'Stock across every location, on a record that can be taken apart back to the day you counted it — and that checks itself overnight. Set up from a spreadsheet in an afternoon. $29/mo, unlimited users, free with Commerce or B2B.',
    lede: 'Most stock systems store a number and ask you to believe it. sparx stores every change — every delivery, sale, count, transfer and breakage — and works the number out from them, so any quantity on any screen can be taken apart in front of you, back to the day somebody last counted the shelf. It re-checks itself every night and tells you when it drifted, rather than waiting for you to find out from a customer.',
    features: [
      {
        number: '01',
        title: 'Ask any number why.',
        body: 'Click a quantity anywhere in sparx and it comes apart: what you counted, what arrived, what sold, what came back, what broke, and who is holding the rest for orders not yet shipped. Every line names the person or the system that caused it. When the shelf disagrees with the screen, you have somewhere to start instead of a recount.',
      },
      {
        number: '02',
        title: 'It checks itself overnight.',
        body: 'Every night sparx re-adds the whole history and compares it to the number it has been showing you. If the two ever disagree it says so, names the items and the value in question, and leaves the evidence alone rather than quietly correcting itself. The screen tells you how long it has been clean.',
      },
      {
        number: '03',
        title: 'Down to the shelf, from a phone.',
        body: 'Shelves and zones inside each location, printed labels that still scan when the wifi does not reach the back of the building, and receiving, put-away, picking, counting and transfers all driven from a phone camera. Pick lists walk the aisle in order and refuse the wrong item.',
      },
      {
        number: '04',
        title: 'What to buy, and who is letting you down.',
        body: 'Reorder points that move with real demand and the season instead of being a number somebody typed in last spring, with days of cover and the revenue at risk if you do nothing. Every supplier keeps a scorecard: how often they are late, how much of the order they actually send, and what they quoted against what they billed.',
      },
      {
        number: '05',
        title: 'Costs that survive an accountant.',
        body: 'Moving average, FIFO layers or standard cost — your choice, per item if you need it. Freight and duty are shared across the delivery so a part costs what it really cost to get on your shelf, in your own currency at the rate on the day it landed. Nineteen reports, every one exportable, and every export re-imports.',
      },
      {
        number: '06',
        title: 'Off the spreadsheet in an afternoon.',
        body: 'Bring the sheet you already keep. sparx matches your column names to its own, shows you exactly what it is about to create and change before it touches anything, and finishes with an opening count so day one is a counted number rather than an imported guess. Everyone in the warehouse can use it — we do not charge per person.',
      },
    ],
    pricing: {
      price: '$29',
      period: '/mo',
      modifier: '',
      bundleNote:
        'A flat $29/mo standalone, and free with Commerce or B2B — if you sell through sparx, the stock behind what you sell is not a second product. Unlimited users at any price: the people who actually touch stock are pickers, receivers and counters, and charging per seat would mean the accuracy of your numbers depended on how few people you let near them.',
    },
  },
};

export const MODULE_ORDER: ModulePageSlug[] = [
  'builder',
  'commerce',
  'cms',
  'crm',
  'email',
  'b2b',
  'ai',
  'dropship',
  'scheduling',
  'social',
  'finance',
  'staff',
  'inventory',
];

export function getModule(slug: string): ModuleMeta | undefined {
  return Object.values(MODULES).find((m) => m.slug === slug);
}
