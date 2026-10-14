// The refusal names a place that exists (sparx persona issue 157). It said
// "resend the link from the dashboard"; the old console with that banner is
// gone, and the workbench now carries the notice and its "Send the link again".

import { describe, expect, it } from 'vitest';
import { VERIFY_EMAIL_MESSAGE } from './verified-email-guard';

describe('the confirm-your-email refusal', () => {
  it('points at the notice the console really shows', () => {
    expect(VERIFY_EMAIL_MESSAGE).not.toMatch(/dashboard/i);
    expect(VERIFY_EMAIL_MESSAGE).toContain('Send the link again');
  });
});
