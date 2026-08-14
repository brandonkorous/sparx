import 'server-only';

// Is "Continue with Google" a real button on this deployment?
//
// ── WHY THIS IS ASKED AT ALL ────────────────────────────────────────────────
//
// The platform registers the Google provider CONDITIONALLY: `packages/auth`'s
// server config spreads in `socialProviders` only when both `GOOGLE_CLIENT_ID`
// and `GOOGLE_CLIENT_SECRET` are present, and adds the One Tap plugin under the
// same condition. On a deployment without them, `/api/auth/sign-in/social`
// answers with an error — so a button rendered anyway is a button that cannot
// work, offered on the screen where a person is least able to tell a broken
// product from their own mistake.
//
// Rendering it only when it is real is the whole of the fix. There is no
// fallback and no "temporarily unavailable" state, because a sign-in page with
// one working way in reads as normal and a sign-in page with a dead button
// reads as broken.
//
// ── THE COUPLING, STATED OUT LOUD ───────────────────────────────────────────
//
// This repeats a condition that lives in `packages/auth/src/server.ts`, and a
// repeated condition drifts. The alternative was a capability query on the
// shared auth package, which is a change to shared code for one app's benefit —
// and the shared workbench has the same latent bug today (it renders its Google
// button unconditionally), so the right fix is a platform one made deliberately
// rather than a Piggles one made in passing. Tracked in piggles/docs/FOLLOW_UPS.
//
// If the platform ever grows a second provider, this becomes a map rather than a
// boolean, and it should still live in ONE place.
export function googleSignInAvailable(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
