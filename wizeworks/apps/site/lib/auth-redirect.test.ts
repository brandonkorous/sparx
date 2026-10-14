// A signed-in buyer is not asked to sign in again (sparx persona issue 189).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { signedInDestination } from './auth-redirect';

describe('signedInDestination', () => {
  it('sends a signed-in buyer on to where the link was going', () => {
    expect(signedInDestination('authenticated', '/account/b2b')).toBe('/account/b2b');
  });

  it('sends them to their account when the link named nowhere', () => {
    expect(signedInDestination('authenticated', null)).toBe('/account');
  });

  it('never leaves the site', () => {
    expect(signedInDestination('authenticated', '//evil.test/x')).toBe('/account');
    expect(signedInDestination('authenticated', 'https://evil.test')).toBe('/account');
  });

  it('shows the form until a session is confirmed', () => {
    for (const status of ['loading', 'anonymous', 'unreachable'] as const) {
      expect(signedInDestination(status, '/account')).toBeNull();
    }
  });

  it('the sign-in form asks it', () => {
    const panel = readFileSync(
      fileURLToPath(new URL('../components/auth-panel.tsx', import.meta.url)),
      'utf8'
    );
    expect(panel).toContain('signedInDestination(status,');
  });
});
