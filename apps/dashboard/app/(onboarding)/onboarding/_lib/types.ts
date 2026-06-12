// Client-safe types shared across the onboarding wizard. Kept free of any
// server-only import so the wizard islands can pull them into the browser
// bundle without dragging in the api-rest client.
//
// Modules-first onboarding (docs/15 v2): the tenant explicitly picks their
// modules FIRST (that selection drives billing AND filters the template catalog),
// then template → workspace → domain → payments → launch. Payments is conditional
// on a selling module being on; launch is the preview-and-publish screen.

export type OnboardingStepKey =
  | 'modules'
  | 'template'
  | 'workspace'
  | 'domain'
  | 'payments'
  | 'launch';

export interface OnboardingCompleted {
  modules: boolean;
  template: boolean;
  workspace: boolean;
  domain: boolean;
  payments: boolean;
}

export type BlueprintVertical = 'retail' | 'b2b' | 'content' | 'services';

/** A blueprint as the template gallery renders it — the catalog summary plus its
 *  "what's inside" counts and this site's install state. Mirrors one element of
 *  `GET /v1/blueprints`'s `blueprints[]`. */
export interface WizardBlueprint {
  key: string;
  version: string;
  name: string;
  summary: string;
  vertical: BlueprintVertical;
  preview: string | null;
  requiresModules: string[];
  contents: {
    products: number;
    categories: number;
    collections: number;
    content: number;
    pages: number;
    emails: number;
    components: number;
    theme: string;
    hasLayout: boolean;
  };
  install: { id: string; status: string; version: string; update_available: boolean } | null;
}

/** Server → wizard handoff. The server component reads these once and the
 *  client wizard drives itself from there (resuming at `step`). */
export interface WizardInitialState {
  step: OnboardingStepKey;
  /** The tenant's company name (tenant.name) — seeded at signup, edited in the
   *  Workspace step. */
  companyName: string;
  /** The tenant's storefront subdomain handle (tenant.slug). */
  slug: string;
  /** The primary property's display name (property.name). */
  siteName: string;
  /** Current module flags (settings.modules.<slug>.enabled), the Modules step's
   *  starting state. */
  modules: Record<string, boolean>;
  completed: OnboardingCompleted;
  /** The full template catalog, loaded server-side so the gallery is SSR. */
  blueprints: WizardBlueprint[];
  /** The chosen template + its install row (resume + the Launch publish). Both
   *  null on the "start from scratch" path. */
  blueprintKey: string | null;
  installId: string | null;
  /** Storefront origin the Launch preview/links target. Prod is the tenant's
   *  canonical zone host (`https://<slug>.sparx.zone`); dev points at the local
   *  storefront, which resolves tenants by `?tenant=<slug>` instead of subdomain. */
  siteOrigin: string;
  useTenantParam: boolean;
  /** From the marketplace funnel (`/sign-up?blueprint=<key>`) — auto-highlight
   *  that template on the gallery so a referred visitor lands on their pick. */
  preselectKey: string | null;
  /** Platform flag: is buying a NEW domain open yet? Off until tenant billing
   *  (Stripe) lands — the Domain step then discloses "checkout opens soon" and
   *  buying is deferred. Free `.sparx.zone` addresses and connecting a domain you
   *  already own are always available, flag or not. */
  domainPurchaseEnabled: boolean;
}

/** ICANN registrant contact — required to register any domain. Captured at the
 *  Domain step when a tenant chooses a paid domain, carried until Launch. */
export interface RegistrantContact {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/** A domain the tenant chose to BUY during onboarding. In the deferred-purchase
 *  flow the choice (domain + ICANN contact + price) is captured at the Domain
 *  step but NOT charged or registered until Launch — a custom domain is the one
 *  paid, opt-in add-on, billed only when the tenant commits to going live. */
export interface PendingDomain {
  domain: string;
  /** First-year price incl. our fee, in cents — what we charge at launch. */
  displayPrice: number;
  /** Renewal price incl. our fee, in cents — per additional year. */
  renewalDisplayPrice: number;
  years: number;
  privacy: boolean;
  propertyId: string;
  contact: RegistrantContact;
}

export type SlugAvailability =
  | { available: true }
  | { available: false; reason: 'invalid' | 'reserved' | 'taken'; suggestions: string[] };

export type WizardResult<T = void> = { ok: true; data: T } | { ok: false; error: string };
