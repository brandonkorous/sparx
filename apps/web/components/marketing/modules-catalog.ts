// The marketing module catalog — ONE source of truth for every place the site
// enumerates modules (the homepage modules grid, the pricing teaser, the footer
// module links). Before this, three surfaces each kept their own list and they
// drifted (the grid showed nine, the teaser eight, the canonical product twelve).
//
// This mirrors the canonical platform sources — kept in sync by hand because the
// marketing bundle must NOT import the server-coupled packages:
//   • slugs + bundling graph: packages/modules/src/index.ts (ModuleSlug,
//     BUNDLED_FREE, REQUIRES)
//   • monthly prices:         packages/billing/src/price-catalog.ts
//                             (MODULE_MONTHLY_CENTS — the dollar values below)
//   • colors:                 packages/ui ModuleProvider / primitives MODULE_COLORS
//   • sidebar order:          apps/dashboard .../_shell/registry.ts (moduleManifests)
//
// Order here matches the dashboard sidebar so the marketing menu and the product
// read identically. Data-as-code: exempt from the file/function size rule.

import type { LucideIcon } from 'lucide-react';
import {
  Boxes,
  Building2,
  CalendarClock,
  FileText,
  MessagesSquare,
  ReceiptText,
  Search,
  Send,
  Share2,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
  Warehouse,
  Workflow,
} from 'lucide-react';
import type { MarketingModule } from './primitives';

export interface ModuleEntry {
  /** Canonical module slug — also the MODULE_COLORS / route key. */
  id: MarketingModule;
  /** Display label — matches the dashboard sidebar's manifest label. Marketing
   *  used to widen a few of these ('AI / MCP', 'AI · MCP'), which left the same
   *  module wearing three names across the site; "MCP" also means nothing to a
   *  non-technical owner. Keep them identical to the product, and let the
   *  description carry the vocabulary. */
  label: string;
  /** Editorial one-liner — the headline of the tile. */
  title: string;
  /** What it does, in plain terms. */
  description: string;
  /** Monthly list price in whole dollars (MODULE_MONTHLY_CENTS / 100). */
  price: number;
  /** Modules that include this one FREE (BUNDLED_FREE). Present ⇒ "included"
   *  story: the standalone price still applies only to tenants with none of
   *  these active. */
  includedWith?: string[];
  /** A separately-billed module this one needs to run (REQUIRES). */
  requires?: string;
  /** Marketing landing route, when one exists. Omitted ⇒ no "Learn" link yet
   *  (invoicing / inventory / chat pages are not built). */
  href?: string;
  /** Renders as a $0 "Free" tile: `price` is 0 and it is never charged, bundled,
   *  or required. Two kinds carry it — free PLATFORM CAPABILITIES (SEO ships with
   *  every tenant; Automations unlocks once any one module is active; neither is a
   *  ModuleSlug or has a dashboard manifest), AND Social (docs/133), which IS a
   *  real independently-gated ModuleSlug that simply costs nothing. All read as
   *  modules to a visitor, so they belong in the menu, the footer, and the
   *  switchboard. */
  free?: boolean;
}

export const MODULES: ModuleEntry[] = [
  {
    id: 'builder',
    label: 'Builder',
    title: 'Themes, pages, live URLs.',
    description:
      'The site builder. Pick a theme, edit blocks, point your domain. No code, no staging dance.',
    price: 10,
    href: '/builder',
  },
  {
    id: 'commerce',
    label: 'Commerce',
    title: 'Cart, checkout, orders.',
    description: 'Products, payments, tax and shipping. Stripe, PayPal, Klarna — all handled.',
    price: 49,
    href: '/commerce',
  },
  {
    id: 'cms',
    label: 'CMS',
    title: 'Words, media, SEO.',
    description:
      'Editor, blog, media library, structured content. Works standalone — no Builder required.',
    price: 49,
    href: '/cms',
  },
  {
    id: 'crm',
    label: 'CRM',
    title: 'Customers, pipeline, signal.',
    description:
      'Activity log, automations, segments — built on your live data, not stitched to it.',
    price: 49,
    href: '/crm',
  },
  {
    id: 'invoicing',
    label: 'Invoicing',
    title: 'Quotes, invoices, payment links.',
    description:
      'Send estimates, quotes, and invoices, take card or ACH, track what is paid — tied to the same customers.',
    price: 19,
    includedWith: ['Commerce', 'B2B'],
  },
  {
    id: 'email',
    label: 'Email',
    title: 'Transactional and marketing.',
    description:
      'Self-hosted on sparx.email. Your domain, your reputation, flat price — no SendGrid markup.',
    price: 29,
    href: '/email',
  },
  {
    id: 'b2b',
    label: 'B2B',
    // B2B is what we used to call Wholesale, and it also carries fleet
    // accounts — related but NOT the same thing. A distributor wants wholesale
    // pricing and never touches fleet; a service shop runs fleet accounts with
    // no wholesale price list; some do both. Name both, imply neither is
    // required, and don't let "fleet" make this read as an auto-parts product.
    title: 'Wholesale accounts, net terms, fleet.',
    description:
      'Account pricing, RFQ, quotes, and purchase orders — wholesale on the same engine as retail. Add fleet accounts when your buyers manage equipment.',
    price: 99,
    requires: 'Commerce',
    href: '/b2b',
  },
  {
    id: 'dropship',
    label: 'Dropship',
    title: 'Suppliers, sync, fulfillment.',
    description: 'Catalog sync, margin math, automated order routing. Sell without holding stock.',
    price: 29,
    href: '/dropship',
  },
  {
    id: 'inventory',
    label: 'Inventory',
    title: 'Stock, locations, reorder points.',
    description:
      'Track stock across locations, set reorder points, sync counts to every channel in real time.',
    price: 29,
    includedWith: ['Commerce', 'B2B'],
  },
  {
    id: 'chat',
    label: 'Live Chat',
    title: 'Talk to visitors in real time.',
    description:
      'Live chat routed to your inbox, on the same customer record as the rest. Connect your own AI to answer first and hand off when it is unsure.',
    price: 19,
  },
  {
    id: 'scheduling',
    label: 'Scheduling',
    title: 'Appointments, classes, bookings.',
    description:
      'Appointments, classes, reservations, rentals — one engine with deposits, reminders, waitlists.',
    price: 29,
    href: '/scheduling',
  },
  {
    id: 'ai',
    label: 'AI',
    // One module, two AI tools, two documents: an AI concierge for the tenant's
    // customers (/ai) and agentic MCP access for the tenant's own team
    // (/agentic). The card is the module's front door → /ai.
    title: 'An AI for your customers, and one for you.',
    description:
      'A concierge that answers your visitors, plus agentic MCP so your own AI reads live data. Bring your own key — never ours.',
    price: 49,
    href: '/ai',
  },
  {
    id: 'social',
    label: 'Social',
    title: 'One post, every network.',
    description:
      'Compose once and publish to Facebook, Instagram and Pinterest — pulled from the same products and media, each image auto-cropped to fit, scheduled or posted now. Free with sparx.',
    price: 0,
    free: true,
    href: '/social',
  },
  {
    id: 'seo',
    label: 'SEO',
    title: 'Get found, on every page.',
    description:
      'Audits every page the platform renders — titles, metadata, redirects, sitemaps. Free with sparx, always on.',
    price: 0,
    free: true,
  },
  {
    id: 'automations',
    label: 'Automations',
    title: 'Work that runs itself.',
    description:
      'Trigger-and-action workflows across your modules — when this happens, do that. Free once any one module is on.',
    price: 0,
    free: true,
  },
];

/** The billable modules — everything a tenant actually pays for. Use this,
 *  never the raw MODULES, anywhere a COUNT or a SUM has to be about money, so
 *  the free capabilities can't silently inflate either. */
export const PAID_MODULES = MODULES.filter((m) => !m.free);

/** SEO + Automations — real capabilities at $0. Listed alongside the paid
 *  modules everywhere a visitor is browsing what the platform DOES. */
export const FREE_MODULES = MODULES.filter((m) => m.free);

/** Module brand hex — re-exported from @sparx/brand, the single TS source. Only
 *  for contexts where CSS custom properties don't resolve (the module strip also
 *  renders in edge-runtime OG images, where Satori can't read a `var()`). In the
 *  DOM use `MODULE_COLOR` / `MODULE_BACKGROUND_COLOR` below instead. */
export { MODULE_HEX } from '@sparx/brand';

export const MODULE_COLOR: Record<MarketingModule, string> = {
  builder: 'module-builder',
  commerce: 'module-commerce',
  cms: 'module-cms',
  crm: 'module-crm',
  invoicing: 'module-invoicing',
  email: 'module-email',
  b2b: 'module-b2b',
  dropship: 'module-dropship',
  inventory: 'module-inventory',
  chat: 'module-chat',
  scheduling: 'module-scheduling',
  ai: 'module-ai',
  seo: 'module-seo',
  automations: 'module-automations',
  social: 'module-social',
};

export const MODULE_BACKGROUND_COLOR: Record<MarketingModule, string> = {
  builder: 'bg-module-builder',
  commerce: 'bg-module-commerce',
  cms: 'bg-module-cms',
  crm: 'bg-module-crm',
  invoicing: 'bg-module-invoicing',
  email: 'bg-module-email',
  b2b: 'bg-module-b2b',
  dropship: 'bg-module-dropship',
  inventory: 'bg-module-inventory',
  chat: 'bg-module-chat',
  scheduling: 'bg-module-scheduling',
  ai: 'bg-module-ai',
  seo: 'bg-module-seo',
  automations: 'bg-module-automations',
  social: 'bg-module-social',
};

/**
 * The paired INK for a solid module fill. `bg-module-commerce` sets the fill and
 * nothing else — silica emits the fill and its `-content` ink as two independent
 * utilities — so anything wearing `MODULE_BACKGROUND_COLOR` must also wear the
 * matching entry here or it inherits whatever ink the surrounding surface had.
 *
 * This map exists because the alternative kept being `#FFFFFF`: two call sites
 * (the timeline markers, the module tile glyph) hit the contrast problem and
 * reached for a literal white, which is right in light mode and wrong the moment
 * a module hue is light enough to need dark ink. Literal class names, because
 * Tailwind's scanner cannot see an interpolated `text-module-${id}-content`.
 */
export const MODULE_CONTENT_COLOR: Record<MarketingModule, string> = {
  builder: 'text-module-builder-content',
  commerce: 'text-module-commerce-content',
  cms: 'text-module-cms-content',
  crm: 'text-module-crm-content',
  invoicing: 'text-module-invoicing-content',
  email: 'text-module-email-content',
  b2b: 'text-module-b2b-content',
  dropship: 'text-module-dropship-content',
  inventory: 'text-module-inventory-content',
  chat: 'text-module-chat-content',
  scheduling: 'text-module-scheduling-content',
  ai: 'text-module-ai-content',
  seo: 'text-module-seo-content',
  automations: 'text-module-automations-content',
  social: 'text-module-social-content',
};

export const MODULE_BORDER_COLOR: Record<MarketingModule, string> = {
  builder: 'border-module-builder',
  commerce: 'border-module-commerce',
  cms: 'border-module-cms',
  crm: 'border-module-crm',
  invoicing: 'border-module-invoicing',
  email: 'border-module-email',
  b2b: 'border-module-b2b',
  dropship: 'border-module-dropship',
  inventory: 'border-module-inventory',
  chat: 'border-module-chat',
  scheduling: 'border-module-scheduling',
  ai: 'border-module-ai',
  seo: 'border-module-seo',
  automations: 'border-module-automations',
  social: 'border-module-social',
};

/** Module glyphs — the SAME Lucide icons the dashboard sidebar uses (each
 *  module's manifest `icon`). A typed Record so adding a module to the union
 *  forces a matching icon here, rather than silently falling back to a dot.
 *  ONE map for every marketing surface: the module tiles, the pricing
 *  switchboard, the module strip, AND the header megamenu (via ModuleGlyph). */
export const MODULE_ICON: Record<MarketingModule, LucideIcon> = {
  builder: Boxes,
  commerce: ShoppingCart,
  cms: FileText,
  crm: Users,
  invoicing: ReceiptText,
  email: Send,
  b2b: Building2,
  dropship: Truck,
  inventory: Warehouse,
  chat: MessagesSquare,
  scheduling: CalendarClock,
  ai: Sparkles,
  seo: Search,
  automations: Workflow,
  social: Share2,
};
