// Shared, side-effect-free constant for the onboarding flow-origin cookie. Lives in
// its own module (not the `'use server'` actions file, whose exports must all be
// async functions) so BOTH the story Stripe-connect action that SETS it and the
// shared `/onboarding/stripe-callback` route that READS it can import the one name.

/** Short-lived cookie recording which onboarding front end started a Stripe Connect
 *  OAuth round-trip, so the shared callback returns the merchant to the right place
 *  (`story` → `/story`, absent → `/onboarding`). */
export const ONBOARDING_FLOW_COOKIE = 'sparx_onb_flow';
