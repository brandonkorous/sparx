import { describe, expect, it } from 'vitest';
import { verifyEmailNotice } from './words';

/** An unconfirmed owner is told, and has a door to a new link (sparx persona
 *  issue 157, the same gap here). */
describe('the confirm-your-email band', () => {
  const owner = { email: 'marisol@juniperrow.test', emailVerified: false };

  it('shows for an unconfirmed owner and names the address', () => {
    const notice = verifyEmailNotice(owner);
    expect(notice?.sentence).toContain('marisol@juniperrow.test');
    expect(notice?.action).toBe('Send the link again');
    expect(JSON.stringify(notice)).not.toMatch(/dashboard/i);
  });

  it('says nothing once confirmed, or before it is known', () => {
    expect(verifyEmailNotice({ ...owner, emailVerified: true })).toBeNull();
    expect(verifyEmailNotice(undefined)).toBeNull();
  });
});
