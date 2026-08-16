// The Piggles lexicon — the vocabulary adapter.
//
// Canonical source: piggles/docs/initial/config/terminology.yaml and
// docs/product/TERMINOLOGY.md. This is the typed form of it.
//
// THE GENERATING RULE: sparx names things by CATEGORY, Piggles names them by
// WHAT YOU ARE DOING. A shop owner does not have a CRM; they have customers.
// When a new term is needed and this table does not cover it, apply that rule
// rather than inventing a synonym for the category word.
//
// This exists so that vocabulary is DATA, not a brand conditional in a component
// (piggles/CLAUDE.md RULE #0). Nothing in a surface should ever read
// `brand === 'piggles' ? 'Customers' : 'CRM'`.

/** Every concept the product has two names for. Keys are the platform's
 *  vocabulary; values are what a Piggles customer sees. */
export const LEXICON = {
  // ── Surfaces ──────────────────────────────────────────────────────────────
  workbench: 'Home',
  site: 'My Site',
  cms: 'Content',
  seo: 'Get Found',
  commerce: 'Sell',
  selling: 'Sell',
  inventory: 'Stock',
  crm: 'Customers',
  email: 'Messages',
  scheduling: 'Bookings',
  invoicing: 'Invoices',
  finance: 'Money',
  team: 'My Team',
  staff: 'My Team',
  integrations: 'Connections',
  automations: 'Automations',
  partners: 'Partners',

  // ── Structure ─────────────────────────────────────────────────────────────
  module: 'App',
  modules: 'Apps',
  enable_module: 'Add app',
  tenant: 'Business',
  property: 'Site',
  mdi: 'Workspace',
  rbac: 'Access',
  role: 'Role',
  permission: 'What they can do',
} as const satisfies Record<string, string>;

export type LexiconKey = keyof typeof LEXICON;

/**
 * What to call each PLATFORM MODULE, one entry per module key.
 *
 * Distinct from the app registry's labels, and the difference is load-bearing.
 * One Piggles app routinely fronts several modules — "Sell" is commerce + B2B +
 * dropship — so mapping every module to its app's name would give three
 * different things the same name. That reads fine in the rail, where they ARE
 * one place, and badly everywhere the modules are listed side by side: the AI
 * tool-policy matrix and the automation step editor both enumerate modules, and
 * three rows all called "Sell" is worse than the acronyms this table exists to
 * replace.
 *
 * So: the app registry answers "which place does this live in", and this answers
 * "what is this thing called". Feeding `moduleLabel()` in the shared workbench is
 * what makes a surface say "Wholesale" without knowing which brand it is
 * rendering under.
 *
 * The generating rule is the same as the rest of the lexicon — name it by what
 * you are doing. Two are worth explaining:
 *
 *   • `storefront` is "Online store", not "My Site". The site is the whole web
 *     presence; the storefront is the part that takes money, and a business with
 *     both needs to be able to tell them apart.
 *   • `chat` is "Chats", not "Messages". Email is "Messages" — the thing people
 *     mean when they say it — and live chat with a visitor is a different
 *     activity from writing to a customer.
 */
export const MODULE_TERMS = {
  platform: 'Home',
  builder: 'My Site',
  storefront: 'Online store',
  cms: 'Content',
  seo: 'Get Found',
  social: 'Social',
  commerce: 'Sell',
  inventory: 'Stock',
  dropship: 'Dropshipping',
  b2b: 'Wholesale',
  crm: 'Customers',
  chat: 'Chats',
  email: 'Messages',
  scheduling: 'Bookings',
  invoicing: 'Invoices',
  finance: 'Money',
  staff: 'My Team',
  automations: 'Automations',
  ai: 'Connections',
  partner: 'Partners',
} as const satisfies Record<string, string>;

export type ModuleTermKey = keyof typeof MODULE_TERMS;

/**
 * What to call each app GROUP where one has to be named.
 *
 * The group keys are colour families — `web`, `run` — and a colour family is not
 * a place anybody goes. These are the same rule as the rest of the lexicon: name
 * it by what you are doing there.
 *
 * `home` has no entry on purpose. It holds one app, and a heading over a single
 * row is an eyebrow (root CLAUDE.md RULE #2) — a one-app group renders bare.
 */
export const GROUP_TERMS = {
  web: 'Your website',
  sell: 'Selling',
  people: 'Who you deal with',
  money: 'Getting paid',
  run: 'Running the place',
} as const satisfies Record<string, string>;

/** What Piggles calls a group, or `undefined` for one that must render bare. */
export const groupTerm = (group: string): string | undefined =>
  (GROUP_TERMS as Record<string, string | undefined>)[group];

/** What Piggles calls a module, or `undefined` for one it has no name for —
 *  which lets a caller fall through to the platform's own label rather than
 *  rendering a blank where a new module appeared. */
export const moduleTerm = (module: string): string | undefined =>
  (MODULE_TERMS as Record<string, string | undefined>)[module];

/** Look up a customer-facing term.
 *
 *  Typed against the table, so a key that does not exist is a compile error
 *  rather than a silent fallback to a category word. */
export const term = (key: LexiconKey): string => LEXICON[key];

/** Terms that are DELIBERATELY context-dependent and must not be resolved by a
 *  lookup. Recorded so nobody "completes" the table with a wrong single answer.
 *
 *  `collection` is "content type" when describing the schema and "list" when
 *  describing the rows — one word for both is wrong in one of the two places.
 *  `priceBook` only surfaces at all in advanced pricing detail; in ordinary
 *  copy the concept simply does not appear. */
export const CONTEXTUAL_TERMS = {
  collection: ['Content type', 'List'],
  priceBook: ['Pricing'],
} as const;

/** Words that must never reach a customer outside an explicitly advanced or
 *  developer context (docs, API reference, the SEO satellites).
 *
 *  This is the enforceable half of piggles/CLAUDE.md RULE #3 — a copy review can
 *  grep for these. The SEO satellite sites are the deliberate exception: their
 *  whole job is ranking for the category vocabulary and translating it. */
export const BANNED_IN_PRODUCT_COPY = [
  'CMS',
  'CRM',
  'headless',
  'MDI',
  'RBAC',
  'tenant',
  'module',
  'collection',
  'price book',
  'GraphQL',
  'webhook',
  'API key',
] as const;
