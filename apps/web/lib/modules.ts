/**
 * Single source of truth for per-module marketing pages. Each module page
 * route (`app/builder/page.tsx`, etc.) and its OG image hydrates from
 * the matching entry here. See docs/sparx-brand-guide.md for the colors
 * and the per-module marketing-domain map.
 */
import type { MarketingModule } from '@/components/marketing/primitives';

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
  /** Eyebrow chip label (e.g. "Builder", "AI · MCP") */
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

export const MODULES: Record<MarketingModule, ModuleMeta> = {
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
    lede: 'Products and inventory, a checkout that converts, Stripe payments, tax and carrier rates wired in. D2C and B2B from the same engine. Run it headless on the API or pair it with Builder for a hosted storefront.',
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
        body: 'Stripe as the primary processor, connected through Stripe Connect — you keep your own account. A small per-transaction fee that steps down to 0% as you grow.',
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
        'A flat $49/mo with Invoicing bundled in free. Pair it with Builder for a hosted storefront or run it headless against the API — one toggle on one bill, off the moment you stop selling. A small per-transaction fee on Commerce steps down to 0% as your active modules grow.',
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
      'Self-hosted Postal on sparx.email. Your domain, your reputation. No SendGrid markup.',
    lede: 'Self-hosted Postal on sparx.email. Your sending domain, your reputation, SPF/DKIM/DMARC auto-configured. No per-email markup, no $0.0008 nickel-and-dime.',
    features: [
      {
        number: '01',
        title: 'Transactional out of the box.',
        body: 'Order confirmations, password resets, RFQ replies — wired into every module. Templates editable, brandable.',
      },
      {
        number: '02',
        title: 'Marketing campaigns.',
        body: 'Drag-drop or HTML. A/B test subject lines and content. Sync segments live from CRM — no list export ever again.',
      },
      {
        number: '03',
        title: 'Your domain, your reputation.',
        body: 'Sending from mail.yourstore.com, not noreply@sparx-email-broadcast.com. Deliverability is yours.',
      },
      {
        number: '04',
        title: 'DKIM, SPF, DMARC.',
        body: 'Auto-provisioned with your custom domain. We add the DNS records, monitor failures, alert on reputation drops.',
      },
      {
        number: '05',
        title: 'No per-email pricing.',
        body: 'Send 10K or 1M emails a month — same $29/mo. We host the SMTP infrastructure on Postal. No SendGrid bill.',
      },
      {
        number: '06',
        title: 'Open, click, bounce events.',
        body: 'Tracked into CRM, available via webhook and MCP. Your AI can see who opened what.',
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
    headlinePrimary: 'Industrial-grade,',
    headlineSecondary: 'out of the box',
    title: 'sparx B2B — Wholesale, fleet, net terms.',
    description:
      'Account-tier pricing, RFQ, purchase orders, fleet accounts, service scheduling. Built for industrial.',
    lede: 'Shopify charges $2,400/mo for B2B and still doesn’t do net terms properly. sparx ships wholesale pricing, RFQ, purchase orders, fleet accounts, and service scheduling natively. $99/mo. Built for how industrial actually works.',
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
        body: 'Buyers request quotes from a product page. You reply with line-item pricing and expiration. Approved quotes convert to orders.',
      },
      {
        number: '05',
        title: 'Service scheduling.',
        body: 'Bookable bays, technicians, parts. Customer-portal scheduling. Reminders via sparx Email.',
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
        'A flat $99/mo, layered on Commerce. Wholesale pricing, net terms, RFQ, purchase orders, and fleet accounts — native, on one bill with everything else.',
    },
    marketingDomain: 'sparxb2b.com',
  },
  ai: {
    slug: 'ai',
    module: 'ai',
    label: 'AI · MCP',
    headlinePrimary: 'Bring your',
    headlineSecondary: 'own AI',
    title: 'sparx AI — Bring your own AI. Native MCP for Claude, ChatGPT, Copilot.',
    description:
      'Don’t learn another chatbot. Connect Claude, ChatGPT, or Copilot to sparx and run your business in plain English — from the chat you already use. No exports, no CSVs.',
    lede: 'We didn’t build you another AI assistant to learn. We opened a direct line so the AI you already use — Claude, ChatGPT, Copilot — can read and write your live business data in plain English, from the same chat you’re already in. No new tool, no new tab, no exports.',
    features: [
      {
        number: '01',
        title: 'Nothing new to learn.',
        body: 'Stay in the assistant you already trust. sparx shows up as tools inside it — no second app, no separate chat history, no bot to babysit.',
      },
      {
        number: '02',
        title: 'Your whole business, reachable.',
        body: 'Ask about orders, customers, and revenue. Create a draft, update inventory, send a quote. Everything the API can do, your AI can do — in plain English.',
      },
      {
        number: '03',
        title: 'Connect once.',
        body: 'Generate a scoped key, paste it with one endpoint into your client. Works with Claude, ChatGPT, Copilot, Cursor — anything that speaks MCP.',
      },
      {
        number: '04',
        title: 'Scoped & audited.',
        body: 'Per-agent keys, per-tool permissions, every call written to the audit log. Write actions confirm first. Revoke in one click.',
      },
      {
        number: '05',
        title: 'A first-class server.',
        body: 'Not a plugin. The MCP server is part of the platform, scoped to your tenant, deployed alongside the API — and it tracks the modules you run.',
      },
      {
        number: '06',
        title: 'Live data, no middleman.',
        body: 'Your AI reads the same records the dashboard does, the moment they change. No nightly export, no sync to drift, nothing in between.',
      },
    ],
    pricing: {
      price: '$49',
      period: '/mo',
      modifier: '+',
      bundleNote:
        'A flat $49/mo. Connect any MCP client and read or write live data across every module you run — scoped, audited, revocable, all on one bill.',
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
    lede: 'Catalog sync, margin math, automated order routing. Sell without holding inventory — but with a real platform underneath, not a Shopify app stacked on a Shopify app.',
    features: [
      {
        number: '01',
        title: 'Supplier connectors.',
        body: 'Native integrations for major suppliers + a generic CSV/FTP/API import for the long tail. Hourly sync, conflict resolution included.',
      },
      {
        number: '02',
        title: 'Margin math.',
        body: 'Set per-supplier markup rules (flat, percentage, tiered). sparx maintains your retail price as supplier costs change.',
      },
      {
        number: '03',
        title: 'Automated routing.',
        body: 'Order comes in → routed to the right supplier instantly. Multi-supplier orders split correctly with one customer-facing tracking.',
      },
      {
        number: '04',
        title: 'Inventory sync.',
        body: 'Real-time stock levels from supplier. Out-of-stock products auto-hidden, back-in-stock auto-relisted.',
      },
      {
        number: '05',
        title: 'Tracking & fulfillment.',
        body: 'Supplier sends tracking, sparx forwards to customer via sparx Email with your branding.',
      },
      {
        number: '06',
        title: 'No middleman markup.',
        body: 'You connect directly to your suppliers. sparx takes $29/mo flat — no per-order sparx fee, no Oberlo-style cut.',
      },
    ],
    pricing: {
      price: '$29',
      period: '/mo',
      modifier: '+',
      bundleNote:
        'A flat $29/mo, layered on Commerce. Supplier sync, margin rules, and automated routing — sell without holding inventory, on one bill with everything else.',
    },
  },
};

export const MODULE_ORDER: MarketingModule[] = [
  'builder',
  'commerce',
  'cms',
  'crm',
  'email',
  'b2b',
  'ai',
  'dropship',
];

export function getModule(slug: string): ModuleMeta | undefined {
  return Object.values(MODULES).find((m) => m.slug === slug);
}
