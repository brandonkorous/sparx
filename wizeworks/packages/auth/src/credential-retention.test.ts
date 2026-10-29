// What is left after signing in by email on an account whose address was never
// confirmed: the Google link stays, a password set before the proof does not.
// Runs a REAL Better Auth instance (memory adapter) with the same hook
// server.ts registers, because the behavior being guarded lives in Better Auth
// itself (revokeUnprovenAccountAccess), not in our code.

import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { emailOTP, magicLink } from 'better-auth/plugins';
import { describe, expect, it } from 'vitest';

import { keepAccountsOnEmailProof } from './credential-retention';

const PASSWORD = 'correct horse battery staple';

function makeInstance() {
  const db: Record<string, unknown[]> = {
    user: [],
    session: [],
    account: [],
    verification: [],
  };
  const outbox: { magicLinkToken?: string; otp?: string } = {};

  const auth = betterAuth({
    baseURL: 'http://localhost:3011',
    secret: 'test-secret-test-secret-test-secret-test-secret',
    database: memoryAdapter(db),
    emailAndPassword: { enabled: true, requireEmailVerification: false, autoSignIn: true },
    rateLimit: { enabled: false },
    databaseHooks: { account: { delete: { before: keepAccountsOnEmailProof } } },
    plugins: [
      magicLink({
        storeToken: 'hashed',
        sendMagicLink: ({ token }) => {
          outbox.magicLinkToken = token;
          return Promise.resolve();
        },
      }),
      emailOTP({
        storeOTP: 'hashed',
        sendVerificationOTP: ({ otp }) => {
          outbox.otp = otp;
          return Promise.resolve();
        },
      }),
    ],
  });
  return { auth, outbox };
}

type Auth = ReturnType<typeof makeInstance>['auth'];

/** An unconfirmed account holding a password AND a Google link. */
async function signUpUnconfirmed(auth: Auth, email: string) {
  const res = await auth.api.signUpEmail({ body: { email, password: PASSWORD, name: 'Dana' } });
  expect(res.user.emailVerified).toBe(false);
  const ctx = await auth.$context;
  await ctx.internalAdapter.linkAccount({
    userId: res.user.id,
    providerId: 'google',
    accountId: `google-${res.user.id}`,
  });
  return res.user.id;
}

async function providers(auth: Auth, userId: string) {
  const ctx = await auth.$context;
  const accounts = await ctx.internalAdapter.findAccounts(userId);
  return accounts.map((a) => a.providerId).sort();
}

async function passwordSignInWorks(auth: Auth, email: string) {
  try {
    await auth.api.signInEmail({ body: { email, password: PASSWORD } });
    return true;
  } catch {
    return false;
  }
}

describe('keepAccountsOnEmailProof', () => {
  it('drops the unproven password and keeps Google through a magic-link sign-in', async () => {
    const { auth, outbox } = makeInstance();
    const email = 'dana@example.com';
    const userId = await signUpUnconfirmed(auth, email);
    expect(await providers(auth, userId)).toEqual(['credential', 'google']);

    await auth.api.signInMagicLink({ body: { email }, headers: new Headers() });
    expect(outbox.magicLinkToken).toBeTruthy();
    await auth.api.magicLinkVerify({
      query: { token: outbox.magicLinkToken ?? '' },
      headers: new Headers(),
    });

    expect(await providers(auth, userId)).toEqual(['google']);
    // The address IS confirmed now: the link proved the mailbox.
    const ctx = await auth.$context;
    expect((await ctx.internalAdapter.findUserById(userId))?.emailVerified).toBe(true);
    // A password picked before that proof no longer signs anybody in.
    expect(await passwordSignInWorks(auth, email)).toBe(false);
  });

  it('drops the unproven password and keeps Google through an emailed-code sign-in', async () => {
    const { auth, outbox } = makeInstance();
    const email = 'lee@example.com';
    const userId = await signUpUnconfirmed(auth, email);

    await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } });
    expect(outbox.otp).toBeTruthy();
    await auth.api.signInEmailOTP({ body: { email, otp: outbox.otp ?? '' } });

    expect(await providers(auth, userId)).toEqual(['google']);
    expect(await passwordSignInWorks(auth, email)).toBe(false);
  });

  it('does not stop any other account deletion', async () => {
    const google = { providerId: 'google' };
    expect(await keepAccountsOnEmailProof(google, { path: '/unlink-account' })).toBeUndefined();
    expect(await keepAccountsOnEmailProof(google, null)).toBeUndefined();
  });
});
