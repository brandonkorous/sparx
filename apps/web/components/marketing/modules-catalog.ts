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
  Send,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react';
import type { MarketingModule } from './primitives';

export interface ModuleEntry {
  /** Canonical module slug — also the MODULE_COLORS / route key. */
  id: MarketingModule;
  /** Display label (matches the dashboard sidebar + Stripe product name). */
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
    title: 'Accounts, net terms, fleet.',
    description:
      'Account pricing, RFQ, purchase orders, fleet accounts. Wholesale on the same engine as retail.',
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
      'Live chat on your site, routed to your inbox and tied to the same customer record as the rest.',
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
    label: 'AI / MCP',
    title: 'Your AI speaks your data.',
    description:
      'A first-class MCP server. Claude, ChatGPT, and Copilot read live business data — natively.',
    price: 49,
    href: '/ai',
  },
];

/** Module brand hex, mirroring @sparx/ui ModuleProvider's MODULE_COLORS. These
 *  are the CONSTANT brand hues (the `--module-*` tokens resolve to exactly these
 *  in every theme), kept as literal hex because the module strip also renders in
 *  the edge-runtime OG images, where Satori cannot resolve CSS custom properties. */
export const MODULE_HEX: Record<MarketingModule, string> = {
  builder: '#6366F1',
  commerce: '#F97316',
  cms: '#14B8A6',
  crm: '#06B6D4',
  invoicing: '#65A30D',
  email: '#0EA5E9',
  b2b: '#475569',
  dropship: '#10B981',
  inventory: '#F59E0B',
  chat: '#8B5CF6',
  scheduling: '#F43F5E',
  ai: '#EC4899',
};

/** Module glyphs — the SAME Lucide icons the dashboard sidebar uses (each
 *  module's manifest `icon`). A typed Record so adding a module to the union
 *  forces a matching icon here, rather than silently falling back to a dot. */
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
};

/** Lowest module price, for "from $N/mo" copy. Derived so it never drifts. */
export const MODULES_PRICE_FLOOR = Math.min(...MODULES.map((m) => m.price));

/** What running EVERYTHING costs per month. Modules that are `includedWith`
 *  another (Invoicing, Inventory) ride along free once you own everything — so
 *  they add $0. Derived: sum of every module that ISN'T bundled-free. */
export const MODULES_ALL_ON_TOTAL = MODULES.filter((m) => !m.includedWith).reduce(
  (sum, m) => sum + m.price,
  0
);
