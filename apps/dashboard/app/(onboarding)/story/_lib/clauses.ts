// The clause catalog — the atoms of the natural-language "story" onboarding. Each
// clause is one phrase the owner can speak ("order online", "publish a blog") that
// maps to a module (and optionally a commerce fulfillment config or an inline object
// slot). The composer assembles clauses into self-organizing sentences; this file is
// the data-as-code contract behind that grammar.
//
// Client-safe: pure data + framework-agnostic helpers, no React, no server import —
// it ships in the composer's browser bundle AND is read by the server action that
// commits the story. Module slugs here MUST match `apps/dashboard/lib/modules.ts`.

import type { BlueprintVertical } from '../../onboarding/_lib/types';

/** Where a clause lands grammatically. `cust` clauses join the opening's "…where
 *  they can A, B, and C"; `owner` clauses each form their own "I'll …" / "I also …"
 *  sentence (the owner picks which line). */
export type ClauseVoice = 'cust' | 'owner';

/** A commerce fulfillment method a clause turns on — a Commerce SUB-config, not its
 *  own module. */
export type Fulfillment = 'ship' | 'pickup' | 'delivery';

export interface Clause {
  /** Module slug this clause activates (key in `lib/modules.ts`). */
  mod: string;
  place: ClauseVoice;
  /** Customer-voice phrasing ("order online") — set for `cust` clauses. */
  cust?: string;
  /** Owner-voice phrasing ("publish a blog") — set for `owner` clauses. */
  owner?: string;
  /** Commerce fulfillment method, if this clause configures one. */
  cfg?: Fulfillment;
  /** Inline editable object slot placeholder ("branded swag" → "offer dropshipped ___"). */
  slot?: string;
}

export const CLAUSE: Record<string, Clause> = {
  book: { mod: 'scheduling', place: 'cust', cust: 'book appointments' },
  classes: { mod: 'scheduling', place: 'cust', cust: 'sign up for classes' },
  shop: { mod: 'commerce', place: 'cust', cust: 'order online' },
  ship: { mod: 'commerce', place: 'cust', cust: 'have it shipped', cfg: 'ship' },
  pickup: { mod: 'commerce', place: 'cust', cust: 'pick up locally', cfg: 'pickup' },
  delivery: { mod: 'commerce', place: 'cust', cust: 'get local delivery', cfg: 'delivery' },
  chat: { mod: 'chat', place: 'cust', cust: 'ask questions on the page' },
  blog: { mod: 'cms', place: 'owner', owner: 'publish a blog' },
  crm: { mod: 'crm', place: 'owner', owner: 'keep every customer in one place' },
  email: { mod: 'email', place: 'owner', owner: 'email my customers' },
  inventory: { mod: 'inventory', place: 'owner', owner: 'track stock across locations' },
  invoicing: { mod: 'invoicing', place: 'owner', owner: 'send estimates and invoices' },
  ai: { mod: 'ai', place: 'owner', owner: 'let my AI assistant help run it' },
  wholesale: { mod: 'b2b', place: 'owner', owner: 'sell wholesale to other businesses' },
  dropship: { mod: 'dropship', place: 'owner', owner: 'offer dropshipped', slot: 'branded swag' },
};

/** The platform's clause groups. Menus render FLAT (no section headers) — this just
 *  defines the canonical clause ORDER and documents intent. */
export const MOVEMENTS: { label: string; ids: string[] }[] = [
  { label: 'Serve & book', ids: ['book', 'classes'] },
  { label: 'Sell', ids: ['shop', 'ship', 'pickup', 'delivery', 'dropship', 'inventory'] },
  { label: 'Publish & share', ids: ['blog'] },
  { label: 'Know my customers', ids: ['crm', 'chat'] },
  { label: 'Reach out', ids: ['email'] },
  { label: 'Sell to businesses', ids: ['wholesale'] },
  { label: 'Run the back office', ids: ['invoicing', 'ai'] },
];

export const ALL_CLAUSE_IDS: string[] = MOVEMENTS.flatMap((m) => m.ids);

/** Greenfield vs existing business — drives the opening verb. */
export const TENSE = {
  future: { verb: 'want to start', sub: 'a new business' },
  current: { verb: 'run', sub: 'an existing business' },
} as const;
export type TenseKey = keyof typeof TENSE;
export const TENSE_ORDER: TenseKey[] = ['future', 'current'];

/** Who the business serves — tints the opening and hints the audience model. */
export const AUDIENCE = {
  people: { label: 'people', sub: 'direct to consumer', kind: 'crm' },
  businesses: { label: 'businesses', sub: 'B2B · wholesale', kind: 'b2b' },
  both: { label: 'people and businesses', sub: 'D2C + B2B', kind: 'crm' },
} as const;
export type AudienceKey = keyof typeof AUDIENCE;
export const AUDIENCE_ORDER: AudienceKey[] = ['people', 'businesses', 'both'];

/** NARRATIVE dependencies — modules a clause's module silently pulls on BEYOND the
 *  billing graph in `lib/modules.ts`. Selling anything needs a store, so Dropship
 *  and B2B (wholesale) both pull Commerce. (B2B→Commerce is also a billing REQUIRES;
 *  Dropship→Commerce is narrative-only.) */
export const NARRATIVE_REQ: Record<string, string[]> = {
  b2b: ['commerce'],
  dropship: ['commerce'],
};

export interface Industry {
  slug: string;
  /** Menu label, e.g. "Beauty & salon". */
  name: string;
  /** Sentence noun, e.g. "a salon". */
  noun: string;
  /** Lucide icon key, resolved to a component in the composer. */
  icon: string;
  /** Clauses surfaced first (as "suggested") and used to pick a starting blueprint. */
  suggest: string[];
  /** Preferred blueprint vertical for the starting-point match. */
  vertical: BlueprintVertical | null;
  /** Default audience hint when the industry is chosen. */
  audience?: AudienceKey;
}

// The generic fallback — used whenever the typed business doesn't match a starter.
export const GENERIC_INDUSTRY: Industry = {
  slug: 'generic',
  name: 'Something else',
  noun: 'a business',
  icon: 'sparkles',
  suggest: ['blog', 'shop'],
  vertical: null,
};

// The 8 real industry starters (slugs MATCH services/api-rest industry-starters.ts)
// plus the generic fallback. Picking one sets the spine: suggested clauses, the
// starting-point blueprint vertical, and `settings.category`.
export const INDUSTRIES: Industry[] = [
  {
    slug: 'apparel',
    name: 'Apparel & fashion',
    noun: 'a clothing store',
    icon: 'shirt',
    suggest: ['shop', 'ship', 'email', 'crm'],
    vertical: 'retail',
  },
  {
    slug: 'food',
    name: 'Food & beverage',
    noun: 'a food shop',
    icon: 'utensils',
    suggest: ['shop', 'pickup', 'ship', 'blog'],
    vertical: 'retail',
  },
  {
    slug: 'electronics',
    name: 'Electronics & tech',
    noun: 'an electronics store',
    icon: 'cpu',
    suggest: ['shop', 'ship', 'chat'],
    vertical: 'retail',
  },
  {
    slug: 'auto-parts',
    name: 'Auto parts & accessories',
    noun: 'a parts store',
    icon: 'car',
    suggest: ['shop', 'ship', 'invoicing', 'wholesale'],
    vertical: 'retail',
  },
  {
    slug: 'salon',
    name: 'Beauty & salon',
    noun: 'a salon',
    icon: 'scissors',
    suggest: ['book', 'shop', 'blog', 'crm'],
    vertical: 'services',
    audience: 'people',
  },
  {
    slug: 'fitness',
    name: 'Fitness & wellness',
    noun: 'a fitness studio',
    icon: 'dumbbell',
    suggest: ['classes', 'email', 'crm'],
    vertical: 'services',
    audience: 'people',
  },
  {
    slug: 'professional',
    name: 'Professional services',
    noun: 'a consultancy',
    icon: 'briefcase',
    suggest: ['book', 'invoicing', 'blog', 'crm'],
    vertical: 'services',
  },
  {
    slug: 'wholesale',
    name: 'Wholesale & distribution',
    noun: 'a distribution business',
    icon: 'warehouse',
    suggest: ['wholesale', 'shop', 'invoicing', 'crm'],
    vertical: 'b2b',
    audience: 'businesses',
  },
  GENERIC_INDUSTRY,
];

export const INDUSTRY_BY_SLUG: Record<string, Industry> = Object.fromEntries(
  INDUSTRIES.map((i) => [i.slug, i])
);

/** Resolve a slug to a definite Industry (the generic fallback when unknown/null). */
export function industryOf(slug: string | null): Industry {
  return (slug ? INDUSTRY_BY_SLUG[slug] : undefined) ?? GENERIC_INDUSTRY;
}
