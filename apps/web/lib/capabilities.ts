/**
 * The full sparx capability catalog — the data behind the `/features` page and
 * the home-page "everything included" band.
 *
 * The marketing site headlines 11 modules; the platform actually ships hundreds
 * of discrete capabilities. This file is the marketing-facing projection of
 * docs/89-feature-catalog.md. When a feature's status changes in that doc, change
 * the matching `status` here — the `/features` page and the home teaser both
 * render straight from this list, including the live counts, so this is the
 * single place that decides what the public sees.
 *
 * Keep labels short (2–5 words): they render as chips. Order within an area is
 * roughly "most impressive first" — the page does not re-sort.
 */

export type CapabilityStatus = 'live' | 'building' | 'planned';

export interface Capability {
  name: string;
  status: CapabilityStatus;
}

export interface CapabilityArea {
  /** stable anchor id */
  id: string;
  /** display name */
  name: string;
  /** one-line summary shown under the area heading */
  summary: string;
  /** accent color (dot + top stripe). Module areas reuse their brand color. */
  accent: string;
  /** true for the 11 activatable modules; false for cross-cutting platform areas */
  module: boolean;
  capabilities: Capability[];
}

const live = (name: string): Capability => ({ name, status: 'live' });
const building = (name: string): Capability => ({ name, status: 'building' });
const planned = (name: string): Capability => ({ name, status: 'planned' });

/** Status display metadata — labels + dot colors used across the marketing UI. */
export const STATUS_META: Record<
  CapabilityStatus,
  { label: string; short: string; color: string }
> = {
  live: { label: 'Live today', short: 'Live', color: 'var(--color-success)' },
  building: { label: 'In build', short: 'Building', color: '#F59E0B' },
  planned: { label: 'On the roadmap', short: 'Planned', color: '#A1A1AA' },
};

export const CAPABILITY_AREAS: CapabilityArea[] = [
  // ── MODULES ──────────────────────────────────────────────────────────────
  {
    id: 'builder',
    name: 'Builder',
    summary: 'Sites, pages, layouts, and email — visually authored, no code.',
    accent: '#6366F1',
    module: true,
    capabilities: [
      live('Drag-and-drop block editor'),
      live('Layers panel with reorder & re-parent'),
      live('Component palette & inspector'),
      live('Live canvas preview'),
      live('Desktop / tablet / mobile preview'),
      live('Six curated themes'),
      live('Brand & theme editor'),
      live('Token-based color system'),
      live('Light / dark appearance'),
      live('Theme toggle node'),
      live('Per-tenant CSS compilation'),
      live('Utility-class authoring'),
      live('Four-axis style recipe'),
      live('Responsive visibility controls'),
      live('Entrance motion & stagger'),
      live('Tenant-authored components'),
      live('Save-as-component'),
      live('Per-placement version pinning'),
      live('Data binding catalog'),
      live('Collection / per-record render'),
      live('Builder-owned navigation'),
      live('Multi-layout catalog'),
      live('Draft → publish + rollback'),
      live('Scheduled publishing'),
      live('Draft preview tokens'),
      live('Page import / export'),
      live('One-click tenant blueprints'),
      live('Email builder'),
      live('Per-recipient email personalization'),
      planned('Undo / redo'),
      planned('External data connections'),
      planned('Collaborative editing'),
    ],
  },
  {
    id: 'commerce',
    name: 'Commerce',
    summary: 'Cart, checkout, orders, payments, tax, and shipping.',
    accent: '#F97316',
    module: true,
    capabilities: [
      live('Products & variants'),
      live('Manual & rules-based collections'),
      live('Categories & taxonomy'),
      live('WebP/AVIF image pipeline'),
      live('Fitment / vehicle compatibility'),
      live('Bundles & configurables'),
      live('Lot & serial tracking'),
      live('Product translations'),
      live('Reviews, ratings & Q&A'),
      live('Wishlists'),
      live('Bulk price tiers'),
      live('Price lists'),
      live('Contract pricing'),
      live('Cost-driven markup engine'),
      live('Auto cost-recompute'),
      live('Discount codes & conditions'),
      live('Gift cards (issue, reload, redeem)'),
      live('Account credit'),
      live('Surcharges (card / fuel / handling)'),
      live('Persistent guest & member carts'),
      live('Abandoned-cart capture'),
      live('Multi-step checkout'),
      live('Address validation'),
      live('Stripe — card, Apple/Google Pay, Link'),
      live('Stripe Connect payouts'),
      live('Pluggable payment providers'),
      live('Tax zones + TaxJar / Avalara'),
      live('Tax exemption certificates'),
      live('Shipping zones & profiles'),
      live('Carrier rates & labels (EasyPost/Shippo)'),
      live('Local pickup'),
      live('Order lifecycle & timeline'),
      live('Partial fulfillments + tracking'),
      live('Refunds (full / partial)'),
      live('Returns / RMA'),
      live('Subscriptions & subscribe-and-save'),
      live('Reorder from history'),
      live('Commerce analytics + CSV export'),
      live('Bulk price adjust with 30-min revert'),
      building('PayPal payments'),
      planned('Return shipping labels'),
    ],
  },
  {
    id: 'cms',
    name: 'CMS',
    summary: 'Words, media, structured content, and SEO — standalone or paired.',
    accent: '#14B8A6',
    module: true,
    capabilities: [
      live('Block editor with tables & embeds'),
      live('Autosave + revision history'),
      live('Media library'),
      live('Focal-point cropping & alt text'),
      live('Responsive image variants'),
      live('Built-in & custom content types'),
      live('Builder-authored type schema'),
      live('Inline +New field'),
      live('Per-entry SEO + JSON-LD'),
      live('Blog with authors & categories'),
      live('Scheduled publish'),
      live('RSS feed'),
      live('Headless REST + GraphQL'),
      live('Content webhooks'),
      building('Localization (i18n)'),
      planned('Content approvals'),
      planned('AI alt-text'),
      planned('A/B content testing'),
    ],
  },
  {
    id: 'crm',
    name: 'CRM',
    summary: 'Customers, pipeline, segments, and activity — on your live data.',
    accent: '#06B6D4',
    module: true,
    capabilities: [
      live('Unified customer record'),
      live('Append-only activity log'),
      live('Materialized dynamic segments'),
      live('Multi-pipeline deals & stages'),
      live('Kanban / list / forecast views'),
      live('Multi-role contacts'),
      live('Deduplication & merge'),
      live('Tasks & reminders'),
      live('Event-driven automations'),
      live('Pipeline & rep reporting'),
      live('Churn-risk & LTV analysis'),
      live('CRM MCP tools'),
    ],
  },
  {
    id: 'email',
    name: 'Email',
    summary: 'Transactional and marketing, sent from your own domain.',
    accent: '#0EA5E9',
    module: true,
    capabilities: [
      live('Self-hosted sending'),
      live('Sending-domain management'),
      live('DKIM / SPF / DMARC auto-setup'),
      live('Default transactional flows'),
      live('Custom automation rules'),
      live('Frequency caps'),
      live('React Email template editor'),
      live('Variable picker & live preview'),
      live('Spam-score & test send'),
      live('Segment-targeted broadcasts'),
      live('Open / click / bounce analytics'),
      live('Revenue attribution'),
      live('Unsubscribe + suppression list'),
      live('Scheduled send queue'),
      live('CAN-SPAM footer settings'),
      live('Email MCP tools'),
    ],
  },
  {
    id: 'b2b',
    name: 'B2B · Wholesale · Fleet',
    summary: 'Accounts, net terms, RFQ, purchase orders, fleet, credit.',
    accent: '#475569',
    module: true,
    capabilities: [
      live('B2B accounts & contacts'),
      live('Account-tier pricing'),
      live('Per-account product overrides'),
      live('Catalog visibility rules'),
      live('Quantity restrictions'),
      live('Fleet profiles (VIN / engine)'),
      live('Fitment-aware catalog'),
      live('RFQ & quotes + PDF'),
      live('Quote-line markup'),
      live('Net 15/30/60/90 terms'),
      live('PO-required checkout'),
      live('Credit limits & tracking'),
      live('Auto B2B invoicing'),
      live('Dunning ladder & credit hold'),
      live('Purchase approval workflows'),
      building('B2B buyer portal'),
    ],
  },
  {
    id: 'invoicing',
    name: 'Invoicing & Billing Documents',
    summary: 'Estimates → work orders → invoices with snapshots and line types.',
    accent: '#65A30D',
    module: true,
    capabilities: [
      live('Configurable document workflows'),
      live('Stage labels & numbering'),
      live('Line types: part / labor / sublet / freight'),
      live('Authored billing documents'),
      live('Cost-derived line markup'),
      live('Immutable stage snapshots'),
      live('Document tax & surcharges'),
      live('Payments & AR aging'),
      live('Branded, printable documents'),
      planned('Quote → invoice conversion'),
    ],
  },
  {
    id: 'dropship',
    name: 'Dropship',
    summary: 'Supplier sync, margin math, automated order routing.',
    accent: '#10B981',
    module: true,
    capabilities: [
      live('Supplier connectors (DSers, Spocket, Faire…)'),
      live('Encrypted credentials'),
      live('Catalog import with retail pricing'),
      live('Per-supplier markup rules'),
      live('Scheduled catalog & stock sync'),
      live('Out-of-stock auto-hide / relist'),
      live('Automated multi-supplier routing'),
      live('Tracking ingestion & forwarding'),
      live('Margin & profitability reporting'),
    ],
  },
  {
    id: 'inventory',
    name: 'Inventory',
    summary: 'Multi-warehouse stock, reservations, and a full audit trail.',
    accent: '#F59E0B',
    module: true,
    capabilities: [
      live('Multi-warehouse (owned / 3PL / virtual)'),
      live('Per-location stock levels'),
      live('Reorder points & lead time'),
      live('Soft & hard reservations'),
      live('Adjustments audit log'),
      live('Low-stock alerts'),
      live('Inventory CSV import'),
      planned('External ERP / WMS sync'),
    ],
  },
  {
    id: 'chat',
    name: 'Live Chat',
    summary: 'AI-first site chat with a real-time staff inbox.',
    accent: '#8B5CF6',
    module: true,
    capabilities: [
      live('Site chat widget'),
      live('AI first response (grounded on your data)'),
      live('Confidence-gated human handoff'),
      live('Real-time staff inbox'),
      live('Conversation assignment'),
      live('Quick replies / canned responses'),
      live('Customer context sidebar'),
      live('Operating hours & away message'),
      live('Web push for staff'),
      planned('Customer reply notifications'),
      planned('File & image attachments'),
    ],
  },
  {
    id: 'scheduling',
    name: 'Scheduling',
    summary: 'Appointments, classes, reservations, and rentals on one booking engine.',
    accent: '#F43F5E',
    module: true,
    capabilities: [
      live('Appointments, classes, reservations, rentals'),
      live('Resource & service availability engine'),
      live('No double-booking — enforced in the DB'),
      live('Round-robin & collective assignment'),
      live('Recurring / series bookings (RRULE)'),
      live('Deposits & holds via your gateway'),
      live('No-show & late-cancel policies + fees'),
      live('Auto-promoting waitlists'),
      live('Email & SMS reminders'),
      live('iCal feed out + CalDAV busy import'),
      live('Public booking widget'),
      live('Utilization, no-show & revenue reports'),
      live('Scheduling MCP tools'),
      building('Customer self-service portal'),
      building('Intake & consultation forms'),
    ],
  },
  {
    id: 'ai',
    name: 'AI · MCP',
    summary: 'A first-class MCP server for Claude, ChatGPT, and Copilot.',
    accent: '#EC4899',
    module: true,
    capabilities: [
      live('First-class MCP server'),
      live('Claude / ChatGPT / Copilot / Cursor'),
      live('Read & write tools across modules'),
      live('Scoped, per-tool permissions'),
      live('Per-agent API keys'),
      live('Rate limiting'),
      live('Full audit trail'),
      live('One-click key revoke'),
    ],
  },

  // ── CROSS-CUTTING PLATFORM ────────────────────────────────────────────────
  {
    id: 'search',
    name: 'Search & Discovery',
    summary: 'Typesense-backed search, facets, and a global command palette.',
    accent: '#2563EB',
    module: false,
    capabilities: [
      live('Instant product / customer / order search'),
      live('Faceted filtering'),
      live('Typo tolerance & synonyms'),
      live('Fitment search'),
      live('Real-time indexing'),
      live('Site search'),
      live('⌘K command palette'),
      live('Scoped browser search keys'),
      building('Universal entity search'),
    ],
  },
  {
    id: 'seo',
    name: 'SEO & AI Discoverability',
    summary: 'Built to rank — and built to be read by AI crawlers.',
    accent: '#0891B2',
    module: false,
    capabilities: [
      live('Multi-site XML sitemaps'),
      live('301/302 redirects + auto on slug change'),
      live('SEO fields in every editor'),
      live('Dynamic branded OG cards'),
      live('JSON-LD structured data'),
      live('llms.txt + AI-crawler welcome'),
      live('12-point SEO audit scorecard'),
      live('Security headers'),
      live('Core Web Vitals tracking'),
      planned('Markdown endpoints for LLMs'),
      planned('hreflang / multi-locale'),
    ],
  },
  {
    id: 'automation',
    name: 'Automation',
    summary: 'One rule engine across every module — triggers, conditions, gates.',
    accent: '#7C3AED',
    module: false,
    capabilities: [
      live('Unified rule engine'),
      live('Event & scheduled triggers'),
      live('Entity-hydrated conditions'),
      live('CRM & B2B actions'),
      live('Webhook / wait / stop actions'),
      live('Durable, resumable runs'),
      live('Idempotency & loop guard'),
      live('Gated execution with audit'),
      live('Seeded system automations'),
      building('Commerce & email actions'),
      building('Automation dashboard'),
      building('AI automation assistant'),
      planned('Zapier / Make / n8n'),
    ],
  },
  {
    id: 'multisite',
    name: 'Multi-site & Multi-brand',
    summary: 'Many sites under one tenant — shared data where you want it.',
    accent: '#4F46E5',
    module: false,
    capabilities: [
      live('Many properties per tenant'),
      live('Header breadcrumb site switcher'),
      live('Per-site domains'),
      live('Per-site layouts & pages'),
      live('Per-site navigation'),
      live('Per-site content & catalog scoping'),
      live('Per-site brand override'),
      live('Per-site orders & memberships'),
      planned('Per-site module scope'),
      planned('Per-site storefront settings'),
    ],
  },
  {
    id: 'marketplace',
    name: 'Marketplace & Integrations',
    summary: 'Blueprints, themes, components, and provider connectors.',
    accent: '#DB2777',
    module: false,
    capabilities: [
      live('Unified marketplace catalog'),
      live('Blueprints, themes, components, integrations'),
      live('One-tap blueprint install'),
      live('Storage-backed bundles'),
      live('Provider integration framework'),
      live('Stripe / PayPal / EasyPost / Shippo'),
      live('Avalara / TaxJar / dropship suppliers'),
      live('Integrations catalog'),
      planned('Creator submissions'),
      planned('Paid listings & payouts'),
      planned('Social commerce channels'),
    ],
  },
  {
    id: 'auth',
    name: 'Auth & Security',
    summary: 'Self-hosted auth and database-level tenant isolation.',
    accent: '#334155',
    module: false,
    capabilities: [
      live('Self-hosted Better Auth'),
      live('Separate customer auth tier'),
      live('Row-level security per tenant'),
      live('Scoped API keys'),
      live('Role-based access'),
      live('Internal service auth'),
      live('Brute-force & rate limiting'),
      building('Organizations & teams'),
      planned('MFA / passkeys'),
    ],
  },
  {
    id: 'billing',
    name: 'Billing & Subscriptions',
    summary: 'Per-module pricing — no seats, no tiers, off the day you stop.',
    accent: '#16A34A',
    module: false,
    capabilities: [
      live('Per-module activation'),
      live('Flat per-module pricing'),
      live('Stripe Connect'),
      building('Stripe subscription billing'),
      planned('14-day no-card trial lifecycle'),
      planned('Embedded billing portal'),
      planned('Annual discount & enterprise plans'),
    ],
  },
  {
    id: 'onboarding',
    name: 'Onboarding',
    summary: 'A live site in under five minutes — modules first, no card.',
    accent: '#EA580C',
    module: false,
    capabilities: [
      live('Under-5-minute, no-card flow'),
      building('Modules-first wizard'),
      building('Template gallery'),
      building('Workspace setup'),
      building('Domain search & purchase'),
      building('Stripe Connect step'),
      building('One-click launch'),
      planned('Business formation (LLC / EIN)'),
      planned('Welcome checklist'),
    ],
  },
  {
    id: 'legal',
    name: 'Legal & Consent',
    summary: 'Policies and cookie consent, seeded and versioned on day one.',
    accent: '#57534E',
    module: false,
    capabilities: [
      live('Auto-seeded legal pages'),
      live('Versioned template registry'),
      live('Cookie consent banner'),
      live('GDPR / CCPA modes'),
      live('Append-only consent records'),
      live('Visitor → customer stitching'),
      live('Platform ToS / Privacy / DPA / AUP'),
      planned('Legal completeness checklist'),
    ],
  },
  {
    id: 'domains',
    name: 'Domains & SSL',
    summary: 'Search, buy, and connect a domain — HTTPS live in under a minute.',
    accent: '#0284C7',
    module: false,
    capabilities: [
      live('Instant *.sparx.zone subdomain'),
      live('Domain search & purchase'),
      live('One-tap connect + DNS config'),
      live('Custom domain (BYO)'),
      live('Automatic SSL'),
      live('Email DNS auto-setup'),
      live('Renewal reminders & auto-renew'),
      live('WHOIS privacy & transfer-out'),
      building('Domain billing ledger'),
    ],
  },
  {
    id: 'attribution',
    name: 'Attribution & Analytics',
    summary: 'Know which channel actually drove the signup — and the sale.',
    accent: '#9333EA',
    module: false,
    capabilities: [
      live('First-touch channel capture'),
      live('UTM taxonomy & classifier'),
      live('UTM link builder'),
      live('Acquisition reporting'),
      planned('Site attribution'),
      planned('Visitor → order stitching'),
      planned('Multi-touch models'),
      planned('Attribution MCP tools'),
    ],
  },
  {
    id: 'dashboard',
    name: 'Dashboard & Operations',
    summary: 'One module-aware workspace for the whole platform.',
    accent: '#475569',
    module: false,
    capabilities: [
      live('Module-aware dashboard shell'),
      live('Workspace & site switcher'),
      live('Settings hub'),
      live('Module gating & upsell'),
      live('Working-area standards'),
      building('Multi-step wizards'),
      planned('CSV import / export'),
      planned('Bulk action bar'),
    ],
  },
  {
    id: 'partners',
    name: 'Partners & Admin',
    summary: 'Tools for agencies, consultants, and the people who run sparx.',
    accent: '#64748B',
    module: false,
    capabilities: [
      planned('WizeWorks admin portal'),
      planned('Tenant impersonation & support'),
      planned('Consultant multi-client workspace'),
      planned('White-label client reports'),
      planned('Public partner directory'),
    ],
  },
];

/** Roll-up counts across the whole catalog — the page and home band read these so
 *  the headline numbers can never drift from the list. */
export function capabilityCounts(): {
  live: number;
  building: number;
  planned: number;
  total: number;
  areas: number;
  modules: number;
} {
  let liveN = 0;
  let buildingN = 0;
  let plannedN = 0;
  for (const area of CAPABILITY_AREAS) {
    for (const cap of area.capabilities) {
      if (cap.status === 'live') liveN += 1;
      else if (cap.status === 'building') buildingN += 1;
      else plannedN += 1;
    }
  }
  return {
    live: liveN,
    building: buildingN,
    planned: plannedN,
    total: liveN + buildingN + plannedN,
    areas: CAPABILITY_AREAS.length,
    modules: CAPABILITY_AREAS.filter((a) => a.module).length,
  };
}

/** Round a count down to a clean "N+" floor (e.g. 247 → "240+") for hero copy. */
export function roundedFloor(n: number, step = 10): number {
  return Math.floor(n / step) * step;
}
