import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getMe, readSession, register } from './customer-client';

/**
 * WHAT A GUEST LEFT WAITS FOR THE CONFIRM LINK (sparx persona issue 329).
 *
 * A stranger typed a guest buyer's email and a password on the sign-up form, and
 * her order and home address opened in his new account. Now the account is made,
 * but what was kept under the email waits until the inbox is shown to be theirs.
 * The site has to say "check your email" for that, and never treat it as signed in.
 */

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const ok = (data: unknown): Response =>
  new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('waiting on the confirm link', () => {
  it('reads the session as waiting, not as signed in', async () => {
    fetchMock.mockResolvedValue(ok({ customer: null, confirmEmail: { email: 'a@b.test' } }));
    expect(await readSession('gillettdiesel')).toEqual({
      kind: 'confirm-email',
      email: 'a@b.test',
    });
  });

  it('gives no profile to anything that asks who is signed in', async () => {
    fetchMock.mockResolvedValue(ok({ customer: null, confirmEmail: { email: 'a@b.test' } }));
    expect(await getMe('gillettdiesel')).toBeNull();
  });

  it('passes the sign-up answer on', async () => {
    fetchMock.mockResolvedValue(
      ok({ customer: null, confirmEmail: { email: 'a@b.test' }, recognized: false, cart: null })
    );
    const result = await register('gillettdiesel', { email: 'a@b.test', password: 'x'.repeat(8) });
    expect(result.customer).toBeNull();
    expect(result.confirmEmail).toEqual({ email: 'a@b.test' });
  });

  it('opens the confirm page in the auth core', () => {
    const core = readFileSync(join(__dirname, '../components/account/account-auth.tsx'), 'utf8');
    expect(core).toContain("case 'verify':");
    expect(core).toContain('<VerifyEmailForm />');
  });

  it('shows the notice in the sign-in panel instead of the form', () => {
    const panel = readFileSync(join(__dirname, '../components/auth-panel.tsx'), 'utf8');
    expect(panel).toContain('<ConfirmEmailNotice email={awaitingEmail} sent={awaitingLinkSent} />');
    expect(panel).toContain("if (outcome === 'confirm-email')");
  });
});
