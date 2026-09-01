import 'server-only';

// Is "Continue with Google" a real button on this deployment?
//
// ── WHY THIS IS ASKED AT ALL ────────────────────────────────────────────────
//
// The platform registers the Google provider CONDITIONALLY. On a deployment
// without the credentials, `/api/auth/sign-in/social` answers with an error — so
// a button rendered anyway is a button that cannot work, offered on the screen
// where a person is least able to tell a broken product from their own mistake.
//
// Rendering it only when it is real is the whole of the fix. There is no fallback
// and no "temporarily unavailable" state, because a sign-in page with one working
// way in reads as normal and a sign-in page with a dead button reads as broken.
//
// ── AND THE CONDITION IS ASKED ONCE ─────────────────────────────────────────
//
// This file used to RE-STATE the env test that `@wizeworks/auth`'s server config
// makes, which is two copies of one condition and therefore a drift waiting to
// happen. It now asks that package, which asks the same function when it decides
// whether to register the provider at all — so the button and the provider can
// never disagree. Adding a second provider is one entry in
// `@wizeworks/auth`'s `social-providers`, and this becomes a list.

import { socialProviderConfigured } from '@wizeworks/auth';

export function googleSignInAvailable(): boolean {
  return socialProviderConfigured('google');
}
