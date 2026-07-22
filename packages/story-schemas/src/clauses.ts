// The clause catalog — the atoms of the natural-language "story" onboarding. Each
// clause is one phrase the owner can speak ("order online", "remember every customer")
// that maps to a module (and optionally a commerce fulfillment config or an inline
// object slot). Phrasing is FIRST-PERSON and plain — how an owner actually talks about
// their business, not a feature name — so the assembled story reads like a story. The
// composer assembles clauses into self-organizing sentences; this file is the
// data-as-code contract behind that grammar.
//
// Client-safe: pure data + framework-agnostic helpers, no React, no server import —
// it ships in the composer's browser bundle, is read by the server action that
// commits the story, AND is rendered read-only by the marketing hero. Module slugs
// here MUST match `apps/dashboard/lib/modules.ts`.

/** Where a clause lands grammatically. `cust` clauses join the opening's "…where
 *  they can A, B, and C"; `owner` clauses each form their own "I'll …" / "I also …"
 *  sentence (the owner picks which line). */
export type ClauseVoice = 'cust' | 'owner';

/** A commerce fulfillment method a clause turns on — a Commerce SUB-config, not its
 *  own module. */
export type Fulfillment = 'ship' | 'pickup' | 'delivery';

/** The blueprint verticals an industry can start from. Lives here because the
 *  industry starters below are the thing that picks one; the onboarding wizard's
 *  `WizardBlueprint` re-exports it. */
export type BlueprintVertical = 'retail' | 'b2b' | 'content' | 'services';

export interface Clause {
  /** Module slug this clause activates (key in `lib/modules.ts`). */
  mod: string;
  place: ClauseVoice;
  /** Customer-voice phrasing ("order online") — set for `cust` clauses. */
  cust?: string;
  /** Owner-voice phrasing ("share what I know on a blog") — set for `owner` clauses. */
  owner?: string;
  /** Commerce fulfillment method, if this clause configures one. */
  cfg?: Fulfillment;
  /** Inline editable object slot placeholder ("branded swag" → "have a supplier ship ___"). */
  slot?: string;
}

export const CLAUSE: Record<string, Clause> = {
  book: { mod: 'scheduling', place: 'cust', cust: 'book appointments' },
  classes: { mod: 'scheduling', place: 'cust', cust: 'sign up for classes' },
  shop: { mod: 'commerce', place: 'cust', cust: 'order online' },
  ship: { mod: 'commerce', place: 'cust', cust: 'have it shipped', cfg: 'ship' },
  pickup: { mod: 'commerce', place: 'cust', cust: 'pick up locally', cfg: 'pickup' },
  delivery: { mod: 'commerce', place: 'cust', cust: 'get local delivery', cfg: 'delivery' },
  chat: { mod: 'chat', place: 'cust', cust: 'message me with questions' },
  blog: { mod: 'cms', place: 'owner', owner: 'share what I know on a blog' },
  crm: { mod: 'crm', place: 'owner', owner: 'remember every customer' },
  email: { mod: 'email', place: 'owner', owner: 'stay in touch with my customers' },
  inventory: { mod: 'inventory', place: 'owner', owner: 'always know what’s in stock' },
  invoicing: { mod: 'invoicing', place: 'owner', owner: 'send an invoice and get paid' },
  ai: { mod: 'ai', place: 'owner', owner: 'let an AI assistant help me run it' },
  wholesale: { mod: 'b2b', place: 'owner', owner: 'supply other businesses' },
  dropship: {
    mod: 'dropship',
    place: 'owner',
    owner: 'have a supplier ship',
    slot: 'branded swag',
  },
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
