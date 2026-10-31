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
// happen. It now asks api-rest, which answers with the same function it uses to
// decide whether to register the provider at all, so the button and the
// provider can never disagree. The credentials live only there (docs/154).

import { platformRequest } from '@wizeworks/auth-client-server';

/** True only when api-rest, which holds the Google credentials, says it can
 *  sign somebody in with Google. If it cannot be asked, sign-in cannot work
 *  either, so the button is left off rather than drawn dead. */
export async function googleSignInAvailable(): Promise<boolean> {
  try {
    const { social } = await platformRequest<{ social: string[] }>('sign-in-options');
    return social.includes('google');
  } catch {
    return false;
  }
}
