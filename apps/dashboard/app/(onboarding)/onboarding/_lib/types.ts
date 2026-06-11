// Client-safe types shared across the onboarding wizard. Kept free of any
// server-only import so the wizard islands can pull them into the browser
// bundle without dragging in the api-rest client.
//
// Template-first onboarding (docs/15): pick a complete blueprint → domain →
// payments → preview & launch. The chosen template ships theme, brand, products,
// and content, so the old Business/Theme/Product steps collapse into one.

export type OnboardingStepKey = 'template' | 'domain' | 'payments' | 'launch';

export interface OnboardingCompleted {
  template: boolean;
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
  storeName: string;
  slug: string;
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
}

export type SlugAvailability =
  | { available: true }
  | { available: false; reason: 'invalid' | 'reserved' | 'taken'; suggestions: string[] };

export type WizardResult<T = void> = { ok: true; data: T } | { ok: false; error: string };
