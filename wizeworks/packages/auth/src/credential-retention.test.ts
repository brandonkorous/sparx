// A password survives signing in by email on an account whose address was
// never confirmed. Runs a REAL Better Auth instance (memory adapter) with the
// same hook server.ts registers, because the behavior being guarded lives in
// Better Auth itself (revokeUnprovenAccountAccess), not in our code.

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

async function signUpUnconfirmed(auth: ReturnType<typeof makeInstance>['auth'], email: string) {
  const res = await auth.api.signUpEmail({ body: { email, password: PASSWORD, name: 'Dana' } });
  expect(res.user.emailVerified).toBe(false);
  return res.user.id;
}

async function credentialAccounts(auth: ReturnType<typeof makeInstance>['auth'], userId: string) {
  const ctx = await auth.$context;
  const accounts = await ctx.internalAdapter.findAccounts(userId);
  return accounts.filter((a) => a.providerId === 'credential');
}

describe('keepAccountsOnEmailProof', () => {
  it('keeps the password through a magic-link sign-in on an unconfirmed account', async () => {
    const { auth, outbox } = makeInstance();
    const email = 'dana@example.com';
    const userId = await signUpUnconfirmed(auth, email);

    await auth.api.signInMagicLink({ body: { email }, headers: new Headers() });
    expect(outbox.magicLinkToken).toBeTruthy();
    await auth.api.magicLinkVerify({
      query: { token: outbox.magicLinkToken ?? '' },
      headers: new Headers(),
    });

    expect(await credentialAccounts(auth, userId)).toHaveLength(1);
    // The address IS confirmed now: the link proved the mailbox.
    const ctx = await auth.$context;
    expect((await ctx.internalAdapter.findUserById(userId))?.emailVerified).toBe(true);
    // And the password still signs her in.
    const signIn = await auth.api.signInEmail({ body: { email, password: PASSWORD } });
    expect(signIn.user.id).toBe(userId);
  });

  it('keeps the password through an emailed-code sign-in on an unconfirmed account', async () => {
    const { auth, outbox } = makeInstance();
    const email = 'lee@example.com';
    const userId = await signUpUnconfirmed(auth, email);

    await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } });
    expect(outbox.otp).toBeTruthy();
    await auth.api.signInEmailOTP({ body: { email, otp: outbox.otp ?? '' } });

    expect(await credentialAccounts(auth, userId)).toHaveLength(1);
    const signIn = await auth.api.signInEmail({ body: { email, password: PASSWORD } });
    expect(signIn.user.id).toBe(userId);
  });

  it('does not stop any other account deletion', async () => {
    expect(await keepAccountsOnEmailProof({}, { path: '/unlink-account' })).toBeUndefined();
    expect(await keepAccountsOnEmailProof({}, null)).toBeUndefined();
  });
});
