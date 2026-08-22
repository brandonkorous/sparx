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
  const base = `${originOf('account')}/${path}`;
  return from ? `${base}?from=${encodeURIComponent(from)}` : base;
};

/** Links back to the marketing site — terms, privacy, trust, cookies, the
 *  wordmark home. Same resolver as {@link accountUrl}, for the same reason. */
export const marketingUrl = (path = ''): string => {
  const base = originOf('marketing');
  return path ? `${base}/${path.replace(/^\//, '')}` : base;
};

/** Where another Piggles surface actually IS, as a full origin.
 *
 *  Three steps, and the order is the whole point:
 *
 *    1. an explicit override wins — a preview deployment, a tunnel, a staging box;
 *    2. else a production BUILD uses the production host, so a deployment that
 *       configures nothing still works;
 *    3. else localhost. **A laptop that configures nothing must point at the
 *       laptop, never at the internet.**
 *
 *  Step 3 is not tidiness. Before it existed, "Start free" on a local
 *  meetpiggles took you to the LIVE getpiggles — and the next click created a
 *  real tenant on the real product, with nothing on screen saying which one you
 *  were on (issue #005). `@piggles/auth-handoff` had the identical bug and was
 *  fixed the identical way; this is that fix, applied to the other direction.
 *
 *  `NEXT_PUBLIC_`, because the header and other client components call these.
 *  A bare `process.env` name is not inlined into the browser bundle, so an
 *  override would have worked on the server and silently fallen through to
 *  production in the browser — the worst of both. */
function originOf(surface: 'account' | 'marketing'): string {
  const configured = (
    surface === 'account'
      ? process.env.NEXT_PUBLIC_PIGGLES_ACCOUNT_ORIGIN
      : process.env.NEXT_PUBLIC_PIGGLES_MARKETING_ORIGIN
  )?.trim();
  if (configured) return configured.replace(/\/$/, '');

  if (process.env.NODE_ENV === 'production') {
    return `https://${surface === 'account' ? PRODUCT.hosts.account : PRODUCT.hosts.marketing}`;
  }
  return surface === 'account' ? 'http://localhost:3021' : 'http://localhost:3020';
}

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
