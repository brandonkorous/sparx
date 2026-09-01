// Which social sign-ins this deployment actually has.
//
// ONE condition, asked here, used by everything: the server config that registers
// the provider, and every screen that offers a button for it.
//
// It was two. `server.ts` spread `socialProviders` (and the One Tap plugin) only
// when both Google creds were present, and each console re-stated the same test
// to decide whether to draw the button. Two copies of one condition drift, and
// the drift is invisible in the worst place: on a deployment missing the env, a
// button that is certain to fail sits on the sign-in screen — where somebody is
// least able to tell a broken product from their own mistake.
//
// A capability query rather than a boolean, because the platform will grow a
// second provider and the answer is then a list rather than a yes.

/** A social sign-in the platform knows how to register. */
export type SocialProvider = 'google';

/** Env pairs that must BOTH be present for a provider to work. Adding one is an
 *  entry here and nothing else — the server registers what this returns, and the
 *  screens offer what this returns. */
const CREDENTIALS: Record<SocialProvider, readonly [string, string]> = {
  google: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
};

/**
 * The providers this deployment can genuinely sign somebody in with.
 *
 * Reads `process.env` at call time rather than at module load: a server render
 * asks per request, and a module-level snapshot would freeze whatever the
 * environment looked like when the bundle was first imported.
 */
export function configuredSocialProviders(env: NodeJS.ProcessEnv = process.env): SocialProvider[] {
  return (Object.keys(CREDENTIALS) as SocialProvider[]).filter((provider) =>
    CREDENTIALS[provider].every((key) => Boolean(env[key]))
  );
}

/** Whether ONE provider is available — the shape a sign-in screen wants. */
export function socialProviderConfigured(
  provider: SocialProvider,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return configuredSocialProviders(env).includes(provider);
}
