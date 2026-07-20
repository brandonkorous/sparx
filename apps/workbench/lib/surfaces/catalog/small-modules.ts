// The modules that are one or two surfaces each.
//
// Grouped in one file on purpose: five files of four lines apiece would be
// fragmentation, not cohesion. Each block below stands alone and lifts straight
// out into its own file the moment it grows past a handful of surfaces.

import {
  BarChart2,
  Bot,
  Gauge,
  Inbox,
  Link2,
  Package,
  Search,
  Settings,
  Wrench,
  Workflow,
} from 'lucide-react';
import type { SurfaceDefinition } from '../registry';
import { stub } from './stub';

/* ── Dropshipping ───────────────────────────────────────────────────────── */
const DROPSHIP: SurfaceDefinition[] = [
  stub({
    key: 'dropship.suppliers.list',
    title: 'Suppliers',
    module: 'dropship',
    icon: Link2,
    order: 1,
    keywords: ['partners', 'sources', 'vendors'],
    body: 'The businesses that hold the stock and ship it to your customers for you.',
  }),
  stub({
    key: 'dropship.products.list',
    title: 'Supplier products',
    module: 'dropship',
    icon: Package,
    section: 'Catalog',
    order: 10,
    keywords: ['import', 'listings', 'sync'],
    body: 'What your suppliers offer, and which of it you have chosen to list and sell as your own.',
  }),
  stub({
    key: 'dropship.analytics',
    title: 'Profitability',
    module: 'dropship',
    icon: BarChart2,
    section: 'Reporting',
    order: 20,
    keywords: ['margin', 'profit', 'cost'],
    body: 'What you paid the supplier against what the customer paid you, product by product.',
  }),
];

/* ── Automations ────────────────────────────────────────────────────────── */
const AUTOMATIONS: SurfaceDefinition[] = [
  stub({
    key: 'automations.list',
    title: 'Automations',
    module: 'automations',
    icon: Workflow,
    order: 1,
    keywords: ['rules', 'when this then that', 'triggers', 'workflow'],
    body: 'Jobs that run themselves — when an order comes in, when stock runs low, when someone fills in a form.',
  }),
];

/* ── Search / SEO ───────────────────────────────────────────────────────── */
const SEO: SurfaceDefinition[] = [
  stub({
    key: 'seo.performance',
    title: 'Search performance',
    module: 'seo',
    icon: Gauge,
    order: 1,
    keywords: ['seo', 'google', 'ranking', 'traffic', 'found'],
    body: 'How easily people find you on a search engine, and which of your pages they land on.',
  }),
  stub({
    key: 'seo.audits',
    title: 'Site checks',
    module: 'seo',
    icon: Search,
    section: 'Checks',
    order: 10,
    keywords: ['audit', 'issues', 'problems', 'fix'],
    body: 'Things on your site that make it harder to find — a missing description, a broken link, a slow page.',
  }),
  stub({
    key: 'seo.search-console',
    title: 'Search Console',
    module: 'seo',
    icon: Link2,
    section: 'Checks',
    order: 11,
    keywords: ['google', 'connect', 'verify'],
    body: 'Connects the free tool Google provides, so the numbers here come from Google itself rather than an estimate.',
  }),
];

/* ── Messages ───────────────────────────────────────────────────────────── */
const CHAT: SurfaceDefinition[] = [
  stub({
    key: 'chat.inbox',
    title: 'Inbox',
    module: 'chat',
    icon: Inbox,
    order: 1,
    keywords: ['live chat', 'conversations', 'support', 'messages'],
    body: 'Conversations with people on your site, live while they are still reading it.',
  }),
  stub({
    key: 'chat.settings',
    title: 'Chat settings',
    module: 'chat',
    icon: Settings,
    section: 'Setup',
    order: 10,
    keywords: ['widget', 'hours', 'away message', 'greeting'],
    body: 'What the chat box looks like on your site, when it is available, and what it says when nobody is there.',
  }),
];

/* ── AI ─────────────────────────────────────────────────────────────────── */
const AI: SurfaceDefinition[] = [
  stub({
    key: 'ai.prompts',
    title: 'Instructions',
    module: 'ai',
    icon: Bot,
    order: 1,
    keywords: ['prompts', 'tone', 'assistant', 'rules'],
    body: 'What you have told the AI about your business — how to describe it, what tone to write in, what never to say.',
  }),
  stub({
    key: 'ai.tools',
    title: 'What AI can touch',
    module: 'ai',
    icon: Wrench,
    order: 2,
    keywords: ['tools', 'mcp', 'permissions', 'access'],
    body: 'Which parts of your business an AI assistant is allowed to read or change on your behalf. Nothing is open by default.',
  }),
];

export const SMALL_MODULE_SURFACES: SurfaceDefinition[] = [
  ...DROPSHIP,
  ...AUTOMATIONS,
  ...SEO,
  ...CHAT,
  ...AI,
];
