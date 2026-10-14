// The confirm-your-email link lands on a page that exists (sparx persona issue
// 157). Sign-up sends it with a `callbackURL`, and getpiggles.com, which hosts
// the sign-in system, redirects there once the address is confirmed. The band
// in this console sends owners to the same page for a new link. With no page,
// a link that worked ended on a 404. Read from the files, not imported: the
// account app is its own app.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { sendsOnArrival } from '../../../account/lib/verify-email-landing';

const REPO = path.resolve(__dirname, '../../../../..');
const SIGN_UP = path.join(REPO, 'wizeworks/packages/auth/src/sign-up.ts');
const ACCOUNT_APP = path.join(REPO, 'piggles/apps/account/app');

describe('the confirm-your-email link', () => {
  it('comes back to a page the account app has', () => {
    expect(fs.existsSync(SIGN_UP), SIGN_UP).toBe(true);
    expect(fs.existsSync(ACCOUNT_APP), ACCOUNT_APP).toBe(true);
    const match = /sendVerificationEmail\(\{[\s\S]*?callbackURL:\s*'([^']+)'/.exec(
      fs.readFileSync(SIGN_UP, 'utf8')
    );
    expect(match, 'sign-up sends the link with a callbackURL').not.toBeNull();
    const landing = (match?.[1] ?? '').split('?')[0] ?? '';
    expect(
      fs.existsSync(path.join(ACCOUNT_APP, landing, 'page.tsx')),
      `account/app${landing}`
    ).toBe(true);
  });
});

// "Send the link again" opened a page that asked for a second press (piggles
// persona issue 978). The band now opens it marked `send=1`, and the page sends.

describe('the band’s "Send the link again"', () => {
  it('opens the page marked to send', () => {
    const band = fs.readFileSync(
      path.join(__dirname, '../../components/verify-email-banner.tsx'),
      'utf8'
    );
    expect(band).toContain('/verify-email?send=1');
  });

  it('sends on arrival for a signed-in owner whose address is not confirmed', () => {
    expect(sendsOnArrival({ signedIn: true, verified: false, send: '1' })).toBe(true);
  });

  it('sends nothing when signed out, already confirmed, or not sent from the band', () => {
    expect(sendsOnArrival({ signedIn: false, verified: false, send: '1' })).toBe(false);
    expect(sendsOnArrival({ signedIn: true, verified: true, send: '1' })).toBe(false);
    expect(sendsOnArrival({ signedIn: true, verified: false, send: null })).toBe(false);
  });
});
