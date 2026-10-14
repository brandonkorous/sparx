// The link in the confirm-your-email message comes back to a page this console
// really has (sparx persona issue 157). Sign-up sends it with a `callbackURL`,
// and Better Auth on this origin redirects there once the address is
// confirmed. With no page at that path, a link that worked landed on "That link
// doesn't open anything".

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO = path.resolve(__dirname, '../../../../..');
const SIGN_UP = path.join(REPO, 'wizeworks/packages/auth/src/sign-up.ts');
const APP = path.resolve(__dirname, '../../app');

describe('the confirm-your-email link', () => {
  it('comes back to a page the console has', () => {
    expect(fs.existsSync(SIGN_UP), SIGN_UP).toBe(true);
    const source = fs.readFileSync(SIGN_UP, 'utf8');
    const match = /sendVerificationEmail\(\{[\s\S]*?callbackURL:\s*'([^']+)'/.exec(source);
    expect(match, 'sign-up sends the link with a callbackURL').not.toBeNull();
    const landing = (match?.[1] ?? '').split('?')[0] ?? '';
    expect(fs.existsSync(path.join(APP, landing, 'page.tsx')), `app${landing}/page.tsx`).toBe(true);
  });
});
