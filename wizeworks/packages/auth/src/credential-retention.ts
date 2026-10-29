// What survives signing in by email on an account whose address was never
// confirmed.
//
// Better Auth 1.7 added `revokeUnprovenAccountAccess`: when a magic link or an
// emailed code signs somebody into an account whose email was never confirmed,
// it DELETES every account row on that user (the password, the Google link) and
// signs out every session, because nothing linked before the email was proven
// is known to belong to the mailbox owner. There is no option to turn it off.
//
// For the PASSWORD that is exactly right, and it is kept. sparx runs with
// `requireEmailVerification: false` so a new business is live in minutes
// (docs/15), which means anybody can sign up with an address they do not own
// and pick its password. When the real owner later signs in by link or code,
// they land in that account; if the stranger's password survived, the stranger
// could still sign in to whatever the owner builds there. The owner loses
// nothing they cannot remake: they are signed in, and "forgot password" sets a
// new one.
//
// The GOOGLE link is different, and the hook keeps it. Linking is limited to
// the trusted provider and to the SAME address (server.ts `accountLinking`, no
// `allowDifferentEmails`), and Google only reports an address it has verified,
// so that link already proves the mailbox. Deleting it would only disconnect a
// sign-in the owner set up themselves.
//
// Everything else the helper does still happens: the address is marked
// confirmed (the link or code proved the mailbox) and older sessions are signed
// out. A person removing a linked account themselves goes through a different
// path and is unaffected.
//
// If this guard ever stops matching (a renamed endpoint, a moved hook), the
// test beside it fails, because it signs a real instance in by magic link and
// email code and checks which accounts are left.

/** The endpoints that run Better Auth's unproven-account cleanup. */
export const EMAIL_PROOF_SIGN_IN_PATHS: ReadonlySet<string> = new Set([
  '/magic-link/verify',
  '/sign-in/email-otp',
]);

/** Better Auth's provider id for an email + password account. */
const PASSWORD_PROVIDER = 'credential';

interface HookContext {
  path?: string;
}

/**
 * `databaseHooks.account.delete.before`: returns `false` (which tells Better
 * Auth to skip the delete) for a linked sign-in, never a password, when the
 * deletion comes from an email-proof sign-in.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Better Auth's hook signature is async.
export async function keepAccountsOnEmailProof(
  account: { providerId?: string } | null | undefined,
  ctx: HookContext | null | undefined
): Promise<false | undefined> {
  if (!ctx?.path || !EMAIL_PROOF_SIGN_IN_PATHS.has(ctx.path)) return undefined;
  if (account?.providerId === PASSWORD_PROVIDER) return undefined;
  return false;
}
