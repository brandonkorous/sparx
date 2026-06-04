// Module catalog — the single source of marketing copy for every module's
// "you don't have this yet" surfaces. Both the upsell gate (<ModuleUpsell>,
// shown when a module is disabled) and the "coming online" stub (<ModuleStub>,
// shown when a module is enabled but its UI is still being built) read from
// here, so a module's name, tagline, blurb, and feature list live in one place
// rather than being copy-pasted across each layout/page.
//
// Keyed by ModuleSlug (the billable units from @sparx/auth's module gate), so
// adding a module to the gate forces a catalog entry at compile time.

import {
  Building2,
  FileText,
  LayoutTemplate,
  Send,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { ModuleSlug } from '@sparx/auth';

export interface ModuleCatalogEntry {
  /** Lucide icon component — consumers render it at their own size. */
  Icon: LucideIcon;
  /** Display name, e.g. "Commerce". */
  title: string;
  /** One-line "what is it" shown under the title. */
  tagline: string;
  /** A sentence or two describing the module — neutral framing that reads
   *  correctly both as an upsell blurb and a "coming online" blurb. */
  description: string;
  /** What the module ships, rendered as a card grid. */
  features: { title: string; description: string }[];
}

export const moduleCatalog: Record<ModuleSlug, ModuleCatalogEntry> = {
  builder: {
    Icon: LayoutTemplate,
    title: 'Builder',
    tagline: 'Themes, layouts, pages, and custom domains.',
    description:
      'The Builder module is the foundation every Sparx site is built on — brand-driven themes, reusable layouts, a visual page editor, and your own domain with automatic SSL.',
    features: [
      {
        title: 'Themes',
        description: 'Brand-driven themes compiled to your tokens, with live preview.',
      },
      {
        title: 'Layouts',
        description: 'Reusable site layouts — header, footer, and named regions.',
      },
      {
        title: 'Page editor',
        description: 'Visual editor with sections, data bindings, and responsive controls.',
      },
      {
        title: 'Custom domains',
        description: 'Map your own domain with automatic SSL provisioning.',
      },
      { title: 'Navigation', description: 'Menus and site structure shared across every page.' },
      { title: 'Publishing', description: 'Draft, preview, and publish with versioned rollback.' },
    ],
  },
  commerce: {
    Icon: ShoppingCart,
    title: 'Commerce',
    tagline: 'Products, orders, and checkout for your storefront.',
    description:
      'The Commerce module turns on product catalogs, inventory, pricing rules, and Stripe-powered checkout for your storefront.',
    features: [
      { title: 'Products', description: 'Variants, options, media, SEO, and bulk imports.' },
      { title: 'Orders', description: 'Fulfilment, refunds, and customer-visible status.' },
      { title: 'Checkout', description: 'Stripe-powered checkout with abandoned cart recovery.' },
      { title: 'Inventory', description: 'Stock levels, low-stock alerts, multi-location.' },
      { title: 'Discounts', description: 'Codes, automatic discounts, and B2B price lists.' },
      { title: 'Shipping', description: 'Rate tables, real-time carrier rates, label printing.' },
    ],
  },
  cms: {
    Icon: FileText,
    title: 'CMS',
    tagline: 'Pages, posts, media, and navigation.',
    description:
      'The CMS module adds long-form pages, a blog, a shared media library, and navigation for content-led sites — independent of whether you sell anything.',
    features: [
      { title: 'Pages', description: 'Structured long-form pages with reusable blocks.' },
      { title: 'Blog', description: 'Posts, authors, categories, and RSS.' },
      {
        title: 'Media library',
        description: 'Upload, organize, and reuse assets across the site.',
      },
      { title: 'Navigation', description: 'Menus and link structure shared across pages.' },
      { title: 'SEO', description: 'Per-page meta, Open Graph, and sitemaps.' },
      { title: 'Scheduling', description: 'Draft, schedule, and publish content on a calendar.' },
    ],
  },
  crm: {
    Icon: Users,
    title: 'CRM',
    tagline: 'Customers, segments, and lifecycle automation.',
    description:
      'The CRM module unifies customer profiles across storefront, B2B, and email so you can segment, score, and re-engage them.',
    features: [
      { title: 'Customer profiles', description: 'Order history, tags, notes, and engagement.' },
      { title: 'Pipeline', description: 'Kanban deal flow for B2B and high-touch sales.' },
      { title: 'Segments', description: 'Live audiences updated incrementally by event.' },
      {
        title: 'Automation',
        description: 'Trigger emails, tasks, and webhooks on customer events.',
      },
      { title: 'Activity log', description: 'Append-only timeline of every touchpoint.' },
      { title: 'MCP integration', description: 'AI-readable customer intelligence surface.' },
    ],
  },
  email: {
    Icon: Send,
    title: 'Email',
    tagline: 'Transactional, automated, and broadcast email from your own domain.',
    description:
      'The Email module sends order, shipping, and marketing email through Mailgun on your verified domain, with automations wired to commerce and CRM events.',
    features: [
      {
        title: 'Broadcasts',
        description: 'Segment-targeted campaigns with scheduling and preview.',
      },
      {
        title: 'Automations',
        description: 'Order, cart-abandon, win-back, and B2B flows triggered by events.',
      },
      {
        title: 'Templates',
        description: 'Branded transactional + marketing templates with preview.',
      },
      {
        title: 'Sending domains',
        description: 'Send from your own domain with automatic DKIM/SPF/DMARC.',
      },
      { title: 'Deliverability', description: 'Suppression list, bounce/complaint handling.' },
      { title: 'Analytics', description: 'Opens, clicks, bounces, and revenue attribution.' },
    ],
  },
  b2b: {
    Icon: Building2,
    title: 'B2B',
    tagline: 'Wholesale, fleet, and net-terms commerce.',
    description:
      'The B2B module layers company accounts, approval flows, and custom price lists onto your storefront — ready for accounts like Gillett Diesel.',
    features: [
      {
        title: 'Company accounts',
        description: 'Parent companies with multiple buyers and roles.',
      },
      {
        title: 'Price lists',
        description: 'Per-company pricing, tiered breaks, contract overrides.',
      },
      { title: 'Quotes', description: 'Sales-assisted quotes that convert to orders.' },
      { title: 'Net terms', description: 'Net 30/60 invoicing backed by Stripe.' },
      { title: 'Approval flows', description: 'Spend limits, multi-step approvals, audit trail.' },
      {
        title: 'Fleet management',
        description: 'VIN/asset-tagged ordering for service operations.',
      },
    ],
  },
  dropship: {
    Icon: Truck,
    title: 'Dropship',
    tagline: 'Supplier catalogs and order routing.',
    description:
      'The Dropship module syncs supplier catalogs, routes orders automatically, and reconciles invoices — keeping your inventory and fulfilment honest.',
    features: [
      { title: 'Supplier catalogs', description: 'CSV / API / EDI feeds with nightly sync.' },
      { title: 'Order routing', description: 'Auto-split orders by supplier, location, or rule.' },
      { title: 'Inventory sync', description: 'Live stock pulls so you do not oversell.' },
      { title: 'Margin rules', description: 'Per-supplier markup, MAP enforcement, exclusions.' },
      { title: 'Tracking', description: 'Push tracking back to the customer automatically.' },
      {
        title: 'Reconciliation',
        description: 'Match supplier invoices to orders with variance flags.',
      },
    ],
  },
  ai: {
    Icon: Sparkles,
    title: 'AI',
    tagline: 'MCP server, agents, and copilots.',
    description:
      'The AI module exposes your storefront and back office to MCP-aware agents — and gives you a copilot that can query orders, customers, and inventory in plain English.',
    features: [
      { title: 'MCP server', description: 'First-class MCP endpoint with per-tenant scopes.' },
      {
        title: 'Tenant copilot',
        description: 'Chat over your store data with safe write actions.',
      },
      { title: 'Agent webhooks', description: 'Subscribe agents to business events via Pub/Sub.' },
      {
        title: 'Product enrichment',
        description: 'Auto-generate descriptions, alt text, SEO tags.',
      },
      { title: 'Smart segments', description: 'Natural-language CRM segment builder.' },
      { title: 'Audit log', description: 'Every agent call recorded with prompt and outcome.' },
    ],
  },
};
