// Canonical marketing → app hand-off links. ONE source so every CTA on the
// marketing site points at a real destination and carries a `ref` for signup
// attribution (docs/80 L-PLAT). The app origin mirrors nav.tsx and
// lib/marketplace.ts's hand-off origin — keep them in sync.
//
// Launch posture: self-serve signup is LIVE (the primary front door), and the
// early-access waitlist stays as a visible secondary path for people who aren't
// ready to spin up an account yet. Primary CTAs → signupHref(); "talk to us" →
// SALES_HREF; the softer "not ready" path → EARLY_HREF.

// THE one answer to "where does the workbench live" for the whole marketing site:
// the header, every module page's CTA, the marketplace and partner hand-offs all
// read it. It used to be four copies, two of them a hard-coded production URL, so
// a sign-up started on a laptop's sparx.works opened the LIVE app and would have
// made a real account there (sparx persona issue 002).
//
// `SPARX_APP_URL` is the platform's canonical name (see @wizeworks/links/server)
// and is set in every deployed environment. Unset, a development build goes to
// the local workbench and a production build to the live one. Client components
// import this too: there the server-only variable is absent, so they take the
// same NODE_ENV fallback, which matches what every deployment configures.
export const APP_BASE = (
  process.env.SPARX_APP_URL ??
  (process.env.NODE_ENV === 'production' ? 'https://app.sparx.works' : 'http://localhost:3011')
).replace(/\/$/, '');

/** Self-serve signup, the primary conversion action. `ref` tags the source
 *  section so signups can be attributed (e.g. `hero`, `final`, `pricing`). */
export const signupHref = (ref: string) => `${APP_BASE}/sign-up?ref=${ref}`;

/** Talk-to-sales / book-a-call — the enterprise landing page owns the form. */
export const SALES_HREF = '/enterprise';

/** Early-access waitlist — the secondary, lower-commitment path. */
export const EARLY_HREF = '/early';

/** The platform overview — the "see how it works" secondary destination. */
export const PLATFORM_HREF = '/platform';
