// Canonical marketing → app hand-off links. ONE source so every CTA on the
// marketing site points at a real destination and carries a `ref` for signup
// attribution (docs/80 L-PLAT). The app origin mirrors nav.tsx and
// lib/marketplace.ts's hand-off origin — keep them in sync.
//
// Launch posture: self-serve signup is LIVE (the primary front door), and the
// early-access waitlist stays as a visible secondary path for people who aren't
// ready to spin up an account yet. Primary CTAs → signupHref(); "talk to us" →
// SALES_HREF; the softer "not ready" path → EARLY_HREF.

const APP_BASE = 'https://app.sparx.works';

/** Self-serve signup, the primary conversion action. `ref` tags the source
 *  section so signups can be attributed (e.g. `hero`, `final`, `pricing`). */
export const signupHref = (ref: string) => `${APP_BASE}/sign-up?ref=${ref}`;

/** Talk-to-sales / book-a-call — the enterprise landing page owns the form. */
export const SALES_HREF = '/enterprise';

/** Early-access waitlist — the secondary, lower-commitment path. */
export const EARLY_HREF = '/early';

/** The platform overview — the "see how it works" secondary destination. */
export const PLATFORM_HREF = '/platform';
