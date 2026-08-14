// Piggles product identity — the strings and hosts that make this a different
// product from sparx running on the same platform.
//
// Anything here that a surface renders must come from THIS object rather than a
// literal, so the brand is one import instead of a search-and-replace.

export const PRODUCT = {
  name: 'Piggles',
  tagline: 'Business software for people who have a business to run.',

  /** The three surfaces. Split deliberately: the money a customer pays WizeWorks
   *  and the money a customer's own customers pay them are different concerns,
   *  and merging them is what made this confusing in sparx. */
  hosts: {
    /** Discover and understand. */
    marketing: 'meetpiggles.com',
    /** Authenticate, sign up, onboard, provision, and pay us. The auth
     *  AUTHORITY — the console has no sign-in UI of its own. */
    account: 'getpiggles.com',
    /** Operate the business. */
    console: 'mypiggles.com',
  },

  /** Tenant sites. `*.piggles.site` keeps customer-hosted public content on a
   *  separate registrable domain from the platform brand — a cookie, reputation
   *  and content-isolation boundary, not a cosmetic one. */
  tenantSites: {
    suffix: 'piggles.site',
    /** CNAME target a customer points their own domain at. */
    cnameTarget: 'customers.piggles.site',
  },

  /** Sending domain. */
  email: 'piggles.email',
} as const;

/** Links out to the account app. Every "sign up" / "sign in" affordance on every
 *  Piggles surface resolves through here rather than writing the host inline,
 *  because the account app is the AUTH AUTHORITY: the console has no sign-in UI
 *  of its own, and a stray hardcoded host is how one surface ends up pointing at
 *  a login that does not exist.
 *
 *  `from` is a first-touch attribution hint. Three registrable domains cannot
 *  share a cookie, so attribution cannot ride one across the boundary — the
 *  marketing site serialises what it knows into the link at click time and the
 *  account app captures it first-party on arrival. This carries the coarse part
 *  (which page sent them); the richer payload is appended client-side. */
export const accountUrl = (path: 'signup' | 'sign-in' | 'contact', from?: string): string => {
  const base = `https://${PRODUCT.hosts.account}/${path}`;
  return from ? `${base}?from=${encodeURIComponent(from)}` : base;
};

/** The capacity meters. Present so the console can name one at the point of
 *  friction — NOT so it can price one. Expansion pricing belongs to the account
 *  service, and the console never knows a price (piggles/CLAUDE.md RULE #2).
 *
 *  `kind` matters: stocks never degrade what already exists, flows carry real
 *  marginal cost and abuse exposure, units are discrete and self-evidently
 *  explicit. Enforcement differs by kind — see BILLING_RULES.md. */
export const METERS = {
  storage: { label: 'Storage', kind: 'stock' },
  contacts: { label: 'Customer records', kind: 'stock' },
  email: { label: 'Email sends', kind: 'flow' },
  seats: { label: 'Team members', kind: 'unit' },
  sites: { label: 'Sites', kind: 'unit' },
  locations: { label: 'Locations', kind: 'unit' },
} as const satisfies Record<string, { label: string; kind: 'stock' | 'flow' | 'unit' }>;

export type MeterKey = keyof typeof METERS;
