/**
 * Example businesses — the marketing site's shared, app-wide fixture set.
 *
 * sparx is industry-agnostic, so NO marketing surface anchors on one vertical
 * (see the rotation rule in `.claude/agents/marketing-designer.md` and the
 * `feedback-industry-agnostic-no-diesel` memory). Any page that shows
 * customer-like example data — a receipt, a checkout, a CRM record, an invoice
 * — pulls from THIS list and crossfades through it via `<Cycle>`
 * (components/marketing/cycle.tsx). One source of truth, every vertical
 * represented, nothing hard-coded per page.
 *
 * Each entry is a COMPLETE, internally-coherent fixture: its own customer,
 * products, a real order whose subtotal + shipping + tax === total, plus
 * editorial (`article`), customer-spine (`crm`), messaging (`email`), and
 * wholesale-account (`b2b`) facets — so any surface renders a believable scene
 * without faking math. Keep every entry the same SHAPE (two products each, every
 * facet present) so rotating surfaces never reflow as they crossfade. The spread
 * is deliberate — home goods, grocery, pet, coffee, and a B2B/wholesale supplier
 * — so no single industry reads as "what sparx is for." Each entry's `b2b` facet
 * treats it as a wholesale ACCOUNT the tenant sells to, spanning hospitality,
 * restaurant supply, salon, office, and industrial fleet, so /b2b is never
 * anchored on one vertical (fleet/service is real but ONE of several).
 */

import type { MarketingModule } from '@/components/marketing/primitives';

export interface ExampleProduct {
  name: string;
  sku: string;
  qty: number;
  /** formatted USD line total, e.g. '$432.00'. */
  price: string;
}

/**
 * A representative CMS article per business — the editorial counterpart to
 * `order`, for content surfaces (an editor preview, a published post, an SEO
 * panel). Keep every field present on every entry so rotating CMS surfaces
 * never reflow as they crossfade. `slug` pairs with `domain` to render a real
 * permalink; `seo` is a believable, passing audit score. CMS is standalone —
 * none of this depends on a shop existing.
 */
export interface ExampleArticle {
  /** post title, e.g. 'How we test every batch before it ships'. */
  title: string;
  /** url slug under /blog, e.g. 'batch-testing'. */
  slug: string;
  /** byline — a real staff author, linked to a staff account in-product. */
  author: string;
  /** content category / taxonomy term, e.g. 'Field notes'. */
  category: string;
  /** auto-calculated reading time, e.g. '4 min read'. */
  readTime: string;
  /** SEO meta description (≤160 chars) — what the audit panel scores. */
  metaDescription: string;
  /** SEO score out of 100, as the publish-time audit reports it. */
  seoScore: number;
}

/**
 * A representative Email facet per business — the messaging counterpart to
 * `order`/`article`/`crm`, for the /email surfaces (the branded email preview,
 * a broadcast with open/click stats, a transactional send, the sender address
 * on the tenant's own domain). Keep every field present on every entry so
 * rotating email surfaces never reflow as they crossfade. Numbers are coherent
 * with the real dashboard email overview vocabulary (open ÷ delivered, click ÷
 * delivered): `clickRate` < `openRate`, recipients is a believable list size.
 * `sender` sends from the business's OWN `domain` — the page's core claim. The
 * `transactional` event references the SAME business's `order`. None of this
 * fakes math; every send is a believable scene. See docs/13 (Email PRD).
 */
export interface ExampleEmail {
  /** the from-address on the tenant's OWN domain, e.g. 'hello@flaxandfern.com'. */
  sender: string;
  /** a marketing broadcast subject line — the campaign the team just sent. */
  broadcastSubject: string;
  /** the CRM segment this broadcast targeted (mirrors a real saved segment). */
  segment: string;
  /** recipients the broadcast reached — a believable mailable-list size. */
  recipients: string;
  /** open rate as the overview reports it (opened ÷ delivered), e.g. '51.2%'. */
  openRate: string;
  /** click rate (clicked ÷ delivered) — always lower than openRate. */
  clickRate: string;
  /** a transactional email this business sends, triggered by a platform event.
   *  `event` is the real Pub/Sub trigger; `subject` is what the customer sees. */
  transactional: { event: string; subject: string };
  /** a preview line of the email body — what renders from atomic components. */
  previewLine: string;
}

/**
 * A representative CRM facet per business — the customer-spine counterpart to
 * `order`/`article`, for the /crm surfaces (the unified record card, the
 * activity timeline, a segment match, a pipeline deal). Keep every field
 * present on every entry so rotating CRM surfaces never reflow as they
 * crossfade. Numbers are internally coherent: `avgOrder` ≈ `totalSpent` /
 * `orders`, and the record's signals reference the SAME business's `order`.
 * `signals` mirror the real CRM activity vocabulary (see the dashboard
 * activity-timeline.tsx) and each carries the module that produced it, so the
 * card can color them by source — the marquee "one record, every module"
 * device. None of this requires a shop to exist; CRM is the spine.
 */
export interface ExampleCrm {
  /** initials for the record avatar, e.g. 'DR'. */
  initials: string;
  /** customer type — drives the record's type badge. */
  type: 'retail' | 'b2b' | 'prospect';
  /** lifetime spend, formatted USD, e.g. '$1,847'. */
  totalSpent: string;
  /** order count over the lifetime. */
  orders: number;
  /** average order value, formatted USD — ≈ totalSpent / orders. */
  avgOrder: string;
  /** the live segment this customer currently matches. */
  segment: string;
  /** a pipeline deal for this account — title, value, stage, probability. */
  deal: { title: string; value: string; stage: string; probability: string };
  /** recent cross-module signals on the record, newest first. Each names the
   *  module that produced it so the card colors it by source. */
  signals: { module: MarketingModule; label: string }[];
}

/**
 * A representative B2B/wholesale facet per business — the wholesale-account
 * counterpart to `order`/`article`/`crm`/`email`, for the /b2b surfaces (the
 * account card with its negotiated price tier + net terms, an account-specific
 * price list on one SKU, an open RFQ → quote). Each business is treated as a
 * wholesale ACCOUNT the tenant sells to. Keep every field present on every entry
 * so rotating B2B surfaces never reflow as they crossfade. Numbers are
 * internally coherent: `creditUsed` ≤ `creditLimit`; the price-list `account`
 * price is the `list` price minus exactly `tierDiscount`; the open quote's
 * `total` is a believable account-sized order. Vocabulary mirrors the real
 * dashboard B2B surfaces (pricing tiers "% off list", payment terms "Net 30",
 * credit limit/used, RFQ quote lifecycle, A/R) — see docs/10 (B2B PRD) and the
 * apps/dashboard B2B module. B2B layers on Commerce: same catalog, same
 * checkout, account-aware pricing and terms.
 */
export interface ExampleB2b {
  /** the wholesale account / company name (the buyer), e.g. 'Cedar & Co. Hotels'. */
  account: string;
  /** the buyer contact who places orders for the account. */
  buyer: string;
  /** the assigned pricing tier name (mirrors a real tier), e.g. 'Wholesale'. */
  tier: string;
  /** the tier's headline discount off list, e.g. '22% off list'. */
  tierDiscount: string;
  /** payment terms — 'Net 15' | 'Net 30' | 'Net 45' | 'Net 60'. */
  terms: string;
  /** credit limit, formatted USD, e.g. '$50,000'. */
  creditLimit: string;
  /** credit used (outstanding A/R), formatted USD — always ≤ creditLimit. */
  creditUsed: string;
  /** credit utilization as the account page reports it, e.g. '34%'. */
  creditUsedPct: string;
  /** an example SKU priced for this account: list price vs. the account's
   *  negotiated price (list − tier discount). Proves account-specific pricing. */
  priceList: { item: string; sku: string; list: string; account: string };
  /** an open RFQ → quote for this account, mid-flow. `number` is a quote no.,
   *  `total` the quoted total, `status` a real lifecycle stage, `expires` its
   *  validity window. */
  quote: { number: string; lines: number; total: string; status: string; expires: string };
}

export interface ExampleBusiness {
  /** short vertical label — for clarity + aria, not usually shown. */
  vertical: string;
  /** store/brand name, e.g. 'Flax & Fern'. */
  name: string;
  /** primary domain, e.g. 'flaxandfern.com'. */
  domain: string;
  customer: {
    name: string;
    email: string;
    address: string;
  };
  order: {
    number: string;
    products: ExampleProduct[];
    subtotal: string;
    shipping: { label: string; value: string };
    tax: { label: string; value: string };
    total: string;
    /** payment method(s), e.g. 'Apple Pay · Stripe'. */
    paidWith: string;
  };
  /** editorial fixture for CMS surfaces — see ExampleArticle. */
  article: ExampleArticle;
  /** customer-spine fixture for CRM surfaces — see ExampleCrm. */
  crm: ExampleCrm;
  /** messaging fixture for Email surfaces — see ExampleEmail. */
  email: ExampleEmail;
  /** wholesale-account fixture for B2B surfaces — see ExampleB2b. */
  b2b: ExampleB2b;
}

export const EXAMPLE_BUSINESSES: ExampleBusiness[] = [
  {
    vertical: 'home goods',
    name: 'Flax & Fern',
    domain: 'flaxandfern.com',
    customer: { name: 'Dana Ruiz', email: 'dana.ruiz@gmail.com', address: '412 Maple Ave' },
    order: {
      number: 'Order #1042',
      products: [
        { name: 'Linen Bedding Set', sku: 'SKU LBS-2', qty: 2, price: '$432.00' },
        { name: 'Down Pillow', sku: 'SKU DP-1', qty: 1, price: '$54.00' },
      ],
      subtotal: '$486.00',
      shipping: { label: 'Shipping · UPS Ground', value: '$14.50' },
      tax: { label: 'Tax · auto-calculated', value: '$38.88' },
      total: '$539.38',
      paidWith: 'Apple Pay · Stripe',
    },
    article: {
      title: 'How to care for linen so it lasts a decade',
      slug: 'caring-for-linen',
      author: 'Dana Ruiz',
      category: 'Care guides',
      readTime: '6 min read',
      metaDescription:
        'A simple wash-and-store routine that keeps linen bedding soft, bright, and lasting for years.',
      seoScore: 96,
    },
    crm: {
      initials: 'DR',
      type: 'retail',
      totalSpent: '$1,847',
      orders: 6,
      avgOrder: '$308',
      segment: 'high-value, loyal',
      deal: { title: 'Flax & Fern bulk', value: '$9,300', stage: 'Closed Won', probability: 'won' },
      signals: [
        { module: 'commerce', label: 'Order #1042 placed — $539.38' },
        { module: 'email', label: 'Opened “Spring restock” email' },
        { module: 'crm', label: 'In segment: high-value, loyal' },
        { module: 'ai', label: 'Asked the AI for a reorder quote' },
        { module: 'builder', label: 'Logged in to the storefront' },
      ],
    },
    email: {
      sender: 'hello@flaxandfern.com',
      broadcastSubject: 'Spring linen restock — your shade is back',
      segment: 'high-value, loyal',
      recipients: '6,420',
      openRate: '52.4%',
      clickRate: '7.1%',
      transactional: { event: 'order.created', subject: 'Your Flax & Fern order is confirmed' },
      previewLine: 'Hi Dana — your order is confirmed and heading out the door.',
    },
    b2b: {
      account: 'Cedar & Co. Hotels',
      buyer: 'procurement@cedarcohotels.com',
      tier: 'Wholesale',
      tierDiscount: '22% off list',
      terms: 'Net 30',
      creditLimit: '$50,000',
      creditUsed: '$17,200',
      creditUsedPct: '34%',
      priceList: {
        item: 'Linen Bedding Set',
        sku: 'SKU LBS-2',
        list: '$216.00',
        account: '$168.48',
      },
      quote: {
        number: 'Q-318',
        lines: 6,
        total: '$8,940.00',
        status: 'Quoted',
        expires: 'in 7 days',
      },
    },
  },
  {
    vertical: 'grocery',
    name: 'Hudson Farm Stand',
    domain: 'hudsonfarmstand.com',
    customer: { name: 'Marcus Lee', email: 'marcus@hudsonfarm.co', address: '88 Orchard Ln' },
    order: {
      number: 'Order #1043',
      products: [
        { name: 'Organic Strawberries', sku: 'SKU STR-FL', qty: 4, price: '$72.00' },
        { name: 'Raw Honey, 16oz', sku: 'SKU HNY-16', qty: 2, price: '$28.00' },
      ],
      subtotal: '$100.00',
      shipping: { label: 'Shipping · Local pickup', value: '$0.00' },
      tax: { label: 'Tax · exempt (grocery)', value: '$0.00' },
      total: '$100.00',
      paidWith: 'Link · Stripe',
    },
    article: {
      title: 'What ripens when: a month-by-month harvest guide',
      slug: 'harvest-guide',
      author: 'Marcus Lee',
      category: 'Field notes',
      readTime: '5 min read',
      metaDescription:
        'A season-by-season guide to what we pick each month and how to store it once it gets home.',
      seoScore: 94,
    },
    crm: {
      initials: 'ML',
      type: 'retail',
      totalSpent: '$3,240',
      orders: 12,
      avgOrder: '$270',
      segment: 'win-back at-risk',
      deal: { title: 'Hudson farm CSA', value: '$1,800', stage: 'Lead', probability: '20%' },
      signals: [
        { module: 'commerce', label: 'Order #1043 placed — $100.00' },
        { module: 'email', label: 'Clicked “This week’s harvest” email' },
        { module: 'crm', label: 'In segment: win-back at-risk' },
        { module: 'ai', label: 'Asked the AI when strawberries return' },
        { module: 'builder', label: 'Browsed the CSA sign-up page' },
      ],
    },
    email: {
      sender: 'orders@hudsonfarmstand.com',
      broadcastSubject: 'This week at the stand: peak strawberries',
      segment: 'win-back at-risk',
      recipients: '3,180',
      openRate: '48.9%',
      clickRate: '6.3%',
      transactional: { event: 'order.created', subject: 'Pickup confirmed — see you Saturday' },
      previewLine: 'Hi Marcus — your pickup is set. Here is what is ready this week.',
    },
    b2b: {
      account: 'Harvest Table Restaurants',
      buyer: 'orders@harvesttablegroup.com',
      tier: 'Restaurant Supply',
      tierDiscount: '18% off list',
      terms: 'Net 15',
      creditLimit: '$20,000',
      creditUsed: '$6,300',
      creditUsedPct: '32%',
      priceList: {
        item: 'Raw Honey, 16oz',
        sku: 'SKU HNY-16',
        list: '$14.00',
        account: '$11.48',
      },
      quote: {
        number: 'Q-204',
        lines: 9,
        total: '$2,310.00',
        status: 'Under review',
        expires: 'in 5 days',
      },
    },
  },
  {
    vertical: 'pet',
    name: 'Waggle Pet Co',
    domain: 'wagglepetco.com',
    customer: { name: 'Priya Nair', email: 'priya@waggle.shop', address: '23 Birch St' },
    order: {
      number: 'Order #1044',
      products: [
        { name: 'Leather Dog Collar', sku: 'SKU DOG-CLR', qty: 1, price: '$38.00' },
        { name: 'Engraved Name Tag', sku: 'SKU TAG-EN', qty: 1, price: '$14.00' },
      ],
      subtotal: '$52.00',
      shipping: { label: 'Shipping · USPS First Class', value: '$4.95' },
      tax: { label: 'Tax · auto-calculated', value: '$4.16' },
      total: '$61.11',
      paidWith: 'Apple Pay · Stripe',
    },
    article: {
      title: 'Sizing a collar: the two-finger rule, explained',
      slug: 'collar-sizing',
      author: 'Priya Nair',
      category: 'How-to',
      readTime: '4 min read',
      metaDescription:
        'Measure once and order with confidence — our quick method for finding the right collar fit.',
      seoScore: 92,
    },
    crm: {
      initials: 'PN',
      type: 'retail',
      totalSpent: '$880',
      orders: 6,
      avgOrder: '$147',
      segment: 'new, growing',
      deal: {
        title: 'Waggle retail expansion',
        value: '$6,900',
        stage: 'Proposal',
        probability: '60%',
      },
      signals: [
        { module: 'commerce', label: 'Order #1044 placed — $61.11' },
        { module: 'email', label: 'Opened “New collars dropped” email' },
        { module: 'crm', label: 'In segment: new, growing' },
        { module: 'ai', label: 'Asked the AI to recommend a size' },
        { module: 'builder', label: 'Created a storefront account' },
      ],
    },
    email: {
      sender: 'hello@wagglepetco.com',
      broadcastSubject: 'New collars just dropped — fit guide inside',
      segment: 'new, growing',
      recipients: '2,260',
      openRate: '54.7%',
      clickRate: '8.2%',
      transactional: { event: 'fulfillment.created', subject: 'Your Waggle order has shipped' },
      previewLine: 'Hi Priya — good news, your collar and tag are on the way.',
    },
    b2b: {
      account: 'Paws & Claws Grooming',
      buyer: 'buyer@pawsandclawsco.com',
      tier: 'Salon & Spa',
      tierDiscount: '15% off list',
      terms: 'Net 30',
      creditLimit: '$12,000',
      creditUsed: '$2,880',
      creditUsedPct: '24%',
      priceList: {
        item: 'Leather Dog Collar',
        sku: 'SKU DOG-CLR',
        list: '$38.00',
        account: '$32.30',
      },
      quote: {
        number: 'Q-127',
        lines: 4,
        total: '$1,540.00',
        status: 'Accepted',
        expires: 'converting to order',
      },
    },
  },
  {
    vertical: 'coffee',
    name: 'North Loop Roasters',
    domain: 'northlooproasters.com',
    customer: { name: 'Sam Carter', email: 'sam.carter@gmail.com', address: '17 Cedar Ct' },
    order: {
      number: 'Order #1045',
      products: [
        { name: 'Whole-Bean Sampler', sku: 'SKU WBS-3', qty: 3, price: '$54.00' },
        { name: 'Pour-Over Kit', sku: 'SKU POK-1', qty: 1, price: '$42.00' },
      ],
      subtotal: '$96.00',
      shipping: { label: 'Shipping · USPS Priority', value: '$8.75' },
      tax: { label: 'Tax · auto-calculated', value: '$7.68' },
      total: '$112.43',
      paidWith: 'Google Pay · Stripe',
    },
    article: {
      title: 'Pour-over basics: ratio, grind, and timing',
      slug: 'pour-over-basics',
      author: 'Sam Carter',
      category: 'Brew guides',
      readTime: '7 min read',
      metaDescription:
        'The three variables that decide your cup — and the starting numbers we use for every roast.',
      seoScore: 98,
    },
    crm: {
      initials: 'SC',
      type: 'retail',
      totalSpent: '$1,124',
      orders: 9,
      avgOrder: '$125',
      segment: 'subscriber, monthly',
      deal: {
        title: 'North Loop wholesale',
        value: '$4,200',
        stage: 'Qualified',
        probability: '40%',
      },
      signals: [
        { module: 'commerce', label: 'Order #1045 placed — $112.43' },
        { module: 'email', label: 'Opened “This month’s roast” email' },
        { module: 'crm', label: 'In segment: subscriber, monthly' },
        { module: 'ai', label: 'Asked the AI to pause a subscription' },
        { module: 'builder', label: 'Visited the wholesale inquiry page' },
      ],
    },
    email: {
      sender: 'roast@northlooproasters.com',
      broadcastSubject: 'This month’s roast: a washed Colombia',
      segment: 'subscriber, monthly',
      recipients: '4,910',
      openRate: '57.1%',
      clickRate: '9.0%',
      transactional: { event: 'subscription.renewed', subject: 'Your monthly roast is on its way' },
      previewLine: 'Hi Sam — your subscription renewed and this month’s bag is brewing.',
    },
    b2b: {
      account: 'Daybreak Office Group',
      buyer: 'pantry@daybreakoffices.com',
      tier: 'Distributor',
      tierDiscount: '25% off list',
      terms: 'Net 45',
      creditLimit: '$30,000',
      creditUsed: '$9,750',
      creditUsedPct: '33%',
      priceList: {
        item: 'Whole-Bean Sampler',
        sku: 'SKU WBS-3',
        list: '$18.00',
        account: '$13.50',
      },
      quote: {
        number: 'Q-441',
        lines: 7,
        total: '$3,860.00',
        status: 'Submitted',
        expires: 'awaiting your reply',
      },
    },
  },
  {
    vertical: 'b2b wholesale',
    name: 'Atlas Supply Co',
    domain: 'atlassupply.co',
    customer: {
      name: 'Reyes Fabrication',
      email: 'orders@reyesfab.com',
      address: '90 Foundry Rd',
    },
    order: {
      number: 'Order #1046',
      products: [
        { name: 'Hydraulic Hose Kit', sku: 'SKU HHK-08', qty: 6, price: '$390.00' },
        { name: 'Bearing Set', sku: 'SKU BRG-32', qty: 4, price: '$120.00' },
      ],
      subtotal: '$510.00',
      shipping: { label: 'Shipping · Freight (LTL)', value: '$48.00' },
      tax: { label: 'Tax · resale exempt', value: '$0.00' },
      total: '$558.00',
      paidWith: 'ACH · Stripe',
    },
    article: {
      title: 'Choosing the right hose for your hydraulic system',
      slug: 'hydraulic-hose-spec',
      author: 'Reyes Fabrication',
      category: 'Spec guides',
      readTime: '8 min read',
      metaDescription:
        'Pressure rating, bend radius, and fittings — the spec checklist our buyers run before every order.',
      seoScore: 95,
    },
    crm: {
      initials: 'RF',
      type: 'b2b',
      totalSpent: '$5,110',
      orders: 9,
      avgOrder: '$568',
      segment: 'B2B fleet, net-30',
      deal: {
        title: 'Reyes fleet account',
        value: '$18,000',
        stage: 'Negotiation',
        probability: '75%',
      },
      signals: [
        { module: 'commerce', label: 'Order #1046 placed — $558.00' },
        { module: 'b2b', label: 'Net-30 invoice, due in 11 days' },
        { module: 'email', label: 'Opened “Q3 contract renewal” email' },
        { module: 'crm', label: 'In segment: B2B fleet, net-30' },
        { module: 'ai', label: 'Asked the AI for a bulk reorder quote' },
      ],
    },
    email: {
      sender: 'orders@atlassupply.co',
      broadcastSubject: 'Q3 contract pricing — your account renewal',
      segment: 'B2B fleet, net-30',
      recipients: '1,140',
      openRate: '61.3%',
      clickRate: '11.4%',
      transactional: { event: 'quote.created', subject: 'Your quote from Atlas Supply is ready' },
      previewLine: 'Hi Reyes — your requested quote is attached, valid for 30 days.',
    },
    b2b: {
      account: 'Reyes Fabrication',
      buyer: 'orders@reyesfab.com',
      tier: 'Fleet Partner',
      tierDiscount: '20% off list',
      terms: 'Net 60',
      creditLimit: '$75,000',
      creditUsed: '$28,400',
      creditUsedPct: '38%',
      priceList: {
        item: 'Hydraulic Hose Kit',
        sku: 'SKU HHK-08',
        list: '$65.00',
        account: '$52.00',
      },
      quote: {
        number: 'Q-512',
        lines: 12,
        total: '$14,280.00',
        status: 'Quoted',
        expires: 'in 14 days',
      },
    },
  },
];
