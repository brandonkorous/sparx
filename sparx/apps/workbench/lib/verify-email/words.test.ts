import { describe, expect, it } from 'vitest';
import { linkSentWords, verifyEmailNotice, verifyLandingWords } from './words';

/**
 * AN UNCONFIRMED OWNER IS TOLD, AND CAN GET A NEW LINK (sparx persona issue 157).
 *
 * Doty's "Send now" was refused with "resend the link from the dashboard". There
 * is no dashboard, the console said nothing, and the link sent at sign-up landed
 * on "That link doesn't open anything" even when it worked.
 */
describe('the confirm-your-email notice', () => {
  const doty = { email: 'p01.doty@gillettdiesel.test', emailVerified: false };

  it('shows for an unconfirmed owner, names the address, and offers a new link', () => {
    const notice = verifyEmailNotice(doty);
    expect(notice?.body).toContain('p01.doty@gillettdiesel.test');
    expect(notice?.action).toBe('Send the link again');
    expect(JSON.stringify(notice)).not.toMatch(/dashboard/i);
  });

  it('says nothing once confirmed, or before it is known', () => {
    expect(verifyEmailNotice({ ...doty, emailVerified: true })).toBeNull();
    expect(verifyEmailNotice(undefined)).toBeNull();
  });

  it('says where the new link went', () => {
    expect(linkSentWords(doty.email)).toContain(doty.email);
  });
});

describe('the page the link comes back to', () => {
  it('says the address is confirmed only when the session says so', () => {
    expect(verifyLandingWords({ verified: true, error: null })).toMatchObject({ confirmed: true });
    // No ?error is not proof: a console sends owners here for a new link.
    expect(verifyLandingWords({ verified: false, error: null }).confirmed).toBe(false);
  });

  it('tells an expired link apart from a broken one, and neither reads as confirmed', () => {
    const expired = verifyLandingWords({ verified: false, error: 'TOKEN_EXPIRED' });
    const broken = verifyLandingWords({ verified: false, error: 'INVALID_TOKEN' });
    expect(expired.confirmed).toBe(false);
    expect(broken.confirmed).toBe(false);
    expect(expired.title).toMatch(/expired/);
    expect(broken.title).not.toBe(expired.title);
  });
});
