// Keep a person's password and linked sign-ins when they sign in by email.
//
// Better Auth 1.7 added `revokeUnprovenAccountAccess`: when a magic link or an
// emailed code signs somebody into an account whose email was never confirmed,
// it DELETES every account row on that user (the password, the Google link) and
// signs out every session, on the theory that nothing linked before the email
// was proven can be trusted. There is no option to turn it off.
//
// Here that theory deletes real people's passwords. sparx runs with
// `requireEmailVerification: false` so a new business is live in minutes
// (docs/15), which means most accounts are unconfirmed: an owner who signed up
// with a password and has not clicked the confirmation email yet, then uses
// "email me a link" once, would find their password gone and Google
// disconnected, with nothing on screen saying why. Every one of those accounts
// was created by this platform's own sign-up, which already decided an
// unconfirmed address may sign in.
//
// So the account-delete hook vetoes exactly those deletions, and only on the
// two email-proof sign-in endpoints. Everything else the helper does still
// happens: the address is marked confirmed (the link or code proved the
// mailbox) and older sessions are signed out. A person deleting a linked
// account themselves goes through a different path and is unaffected.
//
// If this guard ever stops matching (a renamed endpoint, a moved hook), the
// test beside it fails, because it signs a real instance in by magic link and
// email code and then checks the password still works.

/** The endpoints that run Better Auth's unproven-account cleanup. */
export const EMAIL_PROOF_SIGN_IN_PATHS: ReadonlySet<string> = new Set([
  '/magic-link/verify',
  '/sign-in/email-otp',
]);

interface HookContext {
  path?: string;
}

/**
 * `databaseHooks.account.delete.before`: returns `false` (which tells Better
 * Auth to skip the delete) when the deletion comes from an email-proof sign-in.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Better Auth's hook signature is async.
export async function keepAccountsOnEmailProof(
  _account: unknown,
  ctx: HookContext | null | undefined
): Promise<false | undefined> {
  if (ctx?.path && EMAIL_PROOF_SIGN_IN_PATHS.has(ctx.path)) return false;
  return undefined;
}
