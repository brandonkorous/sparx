/**
 * The full sparx capability catalog — the data behind the `/features` page and
 * the home-page "everything included" band.
 *
 * The marketing site headlines 12 modules; the platform actually ships hundreds
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
    /**
     * The area's hue, as a registered silica color NAME plus its fill class.
     * Nothing here holds a color VALUE, so re-pointing `@sparx/brand/theme.css`
     * re-colors this page with zero edits in this file.
     *
     *   color → `module-crm` / `success`   the NAME, for `<Badge color=…>`
     *   fill  → `bg-module-crm`            the CLASS, for a solid marker
     *   content → `text-module-crm-content`  the CLASS, for ink ON that fill
     *
     * All three are LITERALS because Tailwind's scanner cannot see an interpolated
     * `bg-${color}` / `text-${color}-content` — deriving one from another at runtime
     * produces a class the build never emitted.
     *
     * There is deliberately no bare `text-module-crm` ink here. Measured on white,
     * eight of these hues land between 1.78:1 and 2.5:1 as text — they are FILL
     * colors, and the only legible way to show one at size is to fill a shape with
     * it and write on top in its paired `-content`. `bg-*` does NOT bring that ink
     * along, so the two always travel together.
     *
     * These were 25 hand-mirrored HEXES. Six had already drifted a shade off the
     * palette they were copying — Builder `#6366F1` vs the real `#4f46e5`, AI
     * `#EC4899` vs `#db2777`, plus Scheduling, Invoicing, Live Chat, and SEO, which
     * had gone cyan against a yellow token. That drift is the entire argument for
     * naming a token instead of copying its value.
     */
    color: string;
    fill: string;
    content: string;
    /** true for the 12 activatable modules; false for cross-cutting platform areas */
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
    live: { label: 'Live today', short: 'Live', color: 'success' },
    building: { label: 'In build', short: 'Building', color: 'warning' },
    planned: { label: 'On the roadmap', short: 'Planned', color: 'neutral' },
};

export const CAPABILITY_AREAS: CapabilityArea[] = [
    // ── MODULES ──────────────────────────────────────────────────────────────
    {
        id: 'builder',
        name: 'Builder',
        summary: 'Sites, pages, layouts, and email — visually authored, no code.',
        color: 'module-builder',
        fill: 'bg-module-builder',
        content: 'text-module-builder-content',
        module: true,
        capabilities: [
            live('Drag-and-drop block editor'),
            live('Layers panel with reorder & re-parent'),
            live('Component palette & inspector'),
            live('Live canvas preview'),
            live('Desktop / tablet / mobile preview'),
            live('Six curated themes'),
            live('Brand & theme editor'),
            live('Change one color, the whole site follows'),
            live('Light / dark appearance'),
            live('Theme toggle node'),
            live('Styles compiled for your site alone'),
            live('Fine-grained style controls'),
            live('Color, style, size and shape on everything'),
            live('Responsive visibility controls'),
            live('Entrance motion & stagger'),
            live('Tenant-authored components'),
            live('Save-as-component'),
            live('Pin a component to a version'),
            live('Pull live data into any block'),
            live('One page design, every record'),
            live('Builder-owned navigation'),
            live('Multi-layout catalog'),
            live('Draft → publish + rollback'),
            live('Scheduled publishing'),
            live('Shareable preview links'),
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
        color: 'module-commerce',
        fill: 'bg-module-commerce',
        content: 'text-module-commerce-content',
        module: true,
        capabilities: [
            live('Products & variants'),
            live('Manual & rules-based collections'),
            live('Categories & taxonomy'),
            live('Images converted for speed automatically'),
            live('Vehicle and part fitment'),
            live('Bundles & configurables'),
            live('Lot & serial tracking'),
            live('Product translations'),
            live('Reviews, ratings & Q&A'),
            live('Wishlists'),
            live('Bulk price tiers'),
            live('Price lists'),
            live('Contract pricing'),
            live('Markup rules built from your costs'),
            live('Prices follow your costs automatically'),
            live('Discount codes & conditions'),
            live('Gift cards (issue, reload, redeem)'),
            live('Account credit'),
            live('Surcharges (card / fuel / handling)'),
            live('Carts that survive leaving the site'),
            live('Abandoned-cart capture'),
            live('Multi-step checkout'),
            live('Address validation'),
            live('Stripe — card, Apple/Google Pay, Link'),
            live('Stripe Connect payouts'),
            live('Swap in other payment providers'),
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
            live('Bulk price changes, undoable for 30 minutes'),
            building('PayPal payments'),
            planned('Return shipping labels'),
        ],
    },
    {
        id: 'cms',
        name: 'CMS',
        summary: 'Words, media, structured content, and SEO — standalone or paired.',
        color: 'module-cms',
        fill: 'bg-module-cms',
        content: 'text-module-cms-content',
        module: true,
        capabilities: [
            live('Block editor with tables & embeds'),
            live('Autosave + revision history'),
            live('Media library'),
            live('Focal-point cropping & alt text'),
            live('Responsive image variants'),
            live('Built-in & custom content types'),
            live('Design your own content types'),
            live('Add a field without leaving the page'),
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
        color: 'module-crm',
        fill: 'bg-module-crm',
        content: 'text-module-crm-content',
        module: true,
        capabilities: [
            live('Unified customer record'),
            live('A full history nothing can quietly erase'),
            live('Segments that keep themselves up to date'),
            live('Multi-pipeline deals & stages'),
            live('Board, list and forecast views'),
            live('One person, several roles'),
            live('Find and merge duplicates'),
            live('Tasks & reminders'),
            live('Automations that fire on real activity'),
            live('Pipeline & rep reporting'),
            live('Who is drifting away, and who is worth most'),
            live('CRM MCP tools'),
        ],
    },
    {
        id: 'email',
        name: 'Email',
        summary: 'Transactional and marketing, sent from your own domain.',
        color: 'module-email',
        fill: 'bg-module-email',
        content: 'text-module-email-content',
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
            live('Schedule sends for later'),
            live('CAN-SPAM footer settings'),
            live('Email MCP tools'),
        ],
    },
    {
        id: 'b2b',
        name: 'B2B · Wholesale · Fleet',
        summary: 'Accounts, net terms, RFQ, purchase orders, fleet, credit.',
        color: 'module-b2b',
        fill: 'bg-module-b2b',
        content: 'text-module-b2b-content',
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
        color: 'module-invoicing',
        fill: 'bg-module-invoicing',
        content: 'text-module-invoicing-content',
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
            live('Quote → order conversion'),
        ],
    },
    {
        id: 'dropship',
        name: 'Dropship',
        summary: 'Supplier sync, margin math, automated order routing.',
        color: 'module-dropship',
        fill: 'bg-module-dropship',
        content: 'text-module-dropship-content',
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
        summary: 'Stock you can actually trust — counted, costed, and checked against itself.',
        color: 'module-inventory',
        fill: 'bg-module-inventory',
        content: 'text-module-inventory-content',
        module: true,
        // Rewritten 2026-08-13 against docs/89 §9 and docs/146. The old list was
        // eight Phase-0 bullets and carried `planned('Sync with your warehouse
        // system')` — a capability that has been LIVE since the first build, told to
        // every prospect as unbuilt. Status here is customer-facing: a wrong "live"
        // is a broken promise and a wrong "planned" is a lost sale.
        capabilities: [
            live('Many warehouses — yours, a partner’s, or a van'),
            live('Per-location stock levels'),
            live('Soft & hard reservations'),
            live('Every change recorded, with who and why'),
            live('The numbers check themselves overnight'),
            live('Explain any number — where it came from'),
            live('Shelves & put-away suggestions'),
            live('Barcode scanning on a phone'),
            live('Pick lists, packing & verification'),
            live('Counts — cycle, full, and opening'),
            live('Transfers between your locations'),
            live('Lots, serial numbers & recalls'),
            live('Expiry dates & what to shift first'),
            live('Buy in cases, sell in singles'),
            live('Recipes & builds from components'),
            live('True cost, freight and duty included'),
            live('Suppliers, purchase orders & receiving'),
            live('Supplier scorecards — who is actually late'),
            live('Purchase-order approvals'),
            live('What to reorder, and why'),
            live('Forecasts & stockout risk'),
            live('Backorders — what you have promised'),
            live('Consignment & stock you don’t own'),
            live('Reports, exports & scheduled sends'),
            live('Journals & a reconciliation that explains itself'),
            // Corrected 2026-08-13, a day after the rest of this list was rewritten:
            // the QuickBooks Online and Xero connectors are complete, but a direct
            // connection needs an OAuth app registered with each vendor and this
            // installation has neither (`SPARX_QBO_CLIENT_ID` / `SPARX_XERO_CLIENT_ID`
            // are unset in every deploy target). `accountingProviderAvailability()`
            // reports that as `coming_soon` inside the product, so a `live` chip here
            // was the marketing site promising a button the app deliberately does not
            // offer — the same wrong-"live" failure this whole block was rewritten to
            // fix, one line further down the list.
            building('Direct sync — QuickBooks & Xero'),
            live('Sync with your warehouse system'),
            live('Set up in half an hour from a spreadsheet'),
            live('Your own columns on any record'),
            live('Ask your own AI about your stock'),
        ],
    },
    {
        id: 'chat',
        name: 'Live Chat',
        // NOT "AI-first": the $19 buys the chat product and the agent that runs it,
        // never the intelligence. The concierge is inert until the tenant connects
        // their own Anthropic or OpenAI key, and escalates to a human until they do.
        summary: 'Site chat with a real-time staff inbox — answer first with your own AI.',
        color: 'module-chat',
        fill: 'bg-module-chat',
        content: 'text-module-chat-content',
        module: true,
        capabilities: [
            live('Site chat widget'),
            live('First response from your own AI — bring an Anthropic or OpenAI key'),
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
        color: 'module-scheduling',
        fill: 'bg-module-scheduling',
        content: 'text-module-scheduling-content',
        module: true,
        capabilities: [
            live('Appointments, classes, reservations, rentals'),
            live('Availability per person and per service'),
            live('No double-booking, ever'),
            live('Round-robin & collective assignment'),
            live('Recurring and repeating bookings'),
            live('Take a deposit to hold the slot'),
            live('No-show & late-cancel policies + fees'),
            live('Auto-promoting waitlists'),
            live('Email & SMS reminders'),
            live('Two-way sync with your calendar app'),
            live('Public booking widget'),
            live('Utilization, no-show & revenue reports'),
            live('Scheduling MCP tools'),
            building('Customer self-service portal'),
            building('Intake & consultation forms'),
        ],
    },
    {
        id: 'ai',
        name: 'AI',
        summary: 'A first-class MCP server for Claude, ChatGPT, and Copilot.',
        color: 'module-ai',
        fill: 'bg-module-ai',
        content: 'text-module-ai-content',
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
        summary: 'Instant search across everything, with filters that narrow as you type.',
        color: 'module-social',
        fill: 'bg-module-social',
        content: 'text-module-social-content',
        module: false,
        capabilities: [
            live('Instant product / customer / order search'),
            live('Narrow results by any attribute'),
            live('Finds it even when the spelling is off'),
            live('Fitment search'),
            live('New records are searchable immediately'),
            live('Site search'),
            live('⌘K command palette'),
            live('Search sparx from your browser bar'),
            building('Universal entity search'),
        ],
    },
    {
        id: 'seo',
        name: 'SEO & AI Discoverability',
        summary: 'Built to rank — and built to be read by AI crawlers.',
        color: 'module-seo',
        fill: 'bg-module-seo',
        content: 'text-module-seo-content',
        module: false,
        capabilities: [
            live('Multi-site XML sitemaps'),
            live('Old links keep working when you rename a page'),
            live('SEO fields in every editor'),
            live('Dynamic branded OG cards'),
            live('JSON-LD structured data'),
            live('llms.txt + AI-crawler welcome'),
            live('12-point SEO audit scorecard'),
            live('Hardened against common web attacks'),
            live('Core Web Vitals tracking'),
            planned('A plain-text copy of your site for AI'),
            planned('hreflang / multi-locale'),
        ],
    },
    {
        id: 'automation',
        name: 'Automation',
        summary: 'One place to say "when this happens, do that" — across every module.',
        color: 'module-automations',
        fill: 'bg-module-automations',
        content: 'text-module-automations-content',
        module: false,
        capabilities: [
            live('One place for every rule'),
            live('Event & scheduled triggers'),
            live('Rules that read your real records'),
            live('CRM & B2B actions'),
            live('Webhook / wait / stop actions'),
            live('A run that survives an outage and picks back up'),
            live('Never fires twice, never loops'),
            live('Hold a step for approval, with a record of who'),
            live('Useful automations ready on day one'),
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
        color: 'module-builder',
        fill: 'bg-module-builder',
        content: 'text-module-builder-content',
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
            planned('Per-site commerce settings'),
        ],
    },
    {
        id: 'marketplace',
        name: 'Marketplace & Integrations',
        summary: 'Blueprints, themes, components, and provider connectors.',
        color: 'accent',
        fill: 'bg-accent',
        content: 'text-accent-content',
        module: false,
        capabilities: [
            live('Unified marketplace catalog'),
            live('Blueprints, themes, components, integrations'),
            live('One-tap blueprint install'),
            live('Themes and blueprints installed in one click'),
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
        summary: 'Sign-in we run ourselves, and a business boundary the database enforces.',
        color: 'neutral',
        fill: 'bg-neutral',
        content: 'text-neutral-content',
        module: false,
        capabilities: [
            live('Self-hosted Better Auth'),
            live('Separate customer auth tier'),
            live('Your data fenced off inside the database'),
            live('Scoped API keys'),
            live('Role-based access'),
            live('Our own services prove who they are'),
            live('Blocks password guessing automatically'),
            building('Organizations & teams'),
            planned('MFA / passkeys'),
        ],
    },
    {
        id: 'billing',
        name: 'Billing & Subscriptions',
        summary: 'Per-module pricing — no seats, no tiers, off the day you stop.',
        color: 'success',
        fill: 'bg-success',
        content: 'text-success-content',
        module: false,
        capabilities: [
            live('Per-module activation'),
            live('Flat per-module pricing'),
            live('Stripe Connect'),
            building('Stripe subscription billing'),
            live('14-day all-modules trial, no card'),
            planned('Embedded billing portal'),
            planned('Annual discount & enterprise plans'),
        ],
    },
    {
        id: 'onboarding',
        name: 'Onboarding',
        summary: 'A live site in under five minutes — modules first, no card.',
        color: 'warning',
        fill: 'bg-warning',
        content: 'text-warning-content',
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
        color: 'secondary',
        fill: 'bg-secondary',
        content: 'text-secondary-content',
        module: false,
        capabilities: [
            live('Auto-seeded legal pages'),
            live('Versioned template registry'),
            live('Cookie consent banner'),
            live('GDPR / CCPA modes'),
            live('A consent record nothing can rewrite'),
            live('Visitor → customer stitching'),
            live('Platform ToS / Privacy / DPA / AUP'),
            planned('Legal completeness checklist'),
        ],
    },
    {
        id: 'domains',
        name: 'Domains & SSL',
        summary: 'Search, buy, and connect a domain — HTTPS live in under a minute.',
        color: 'info',
        fill: 'bg-info',
        content: 'text-info-content',
        module: false,
        capabilities: [
            live('Instant *.sparx.zone subdomain'),
            live('Domain search & purchase'),
            live('One-tap domain connect'),
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
        color: 'module-chat',
        fill: 'bg-module-chat',
        content: 'text-module-chat-content',
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
        color: 'primary',
        fill: 'bg-primary',
        content: 'text-primary-content',
        module: false,
        capabilities: [
            live('Module-aware dashboard shell'),
            live('Workspace & site switcher'),
            live('Settings hub'),
            live('See what a module adds before you buy'),
            live('The same layout in every module'),
            building('Multi-step wizards'),
            planned('CSV import / export'),
            planned('Bulk action bar'),
        ],
    },
    {
        id: 'partners',
        name: 'Partners & Agencies',
        summary: 'Tools for the agencies and consultants who run sparx for their clients.',
        color: 'module-b2b',
        fill: 'bg-module-b2b',
        content: 'text-module-b2b-content',
        module: false,
        capabilities: [
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
