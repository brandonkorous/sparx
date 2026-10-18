import { describe, expect, it } from 'vitest';

import { resendRefusal } from './resend-confirmation-words';

// Sparx persona issue 336: why "Email the confirmation again" sent nothing, in
// the owner's words.
describe('resendRefusal', () => {
  it('says an order with no email has nowhere to go', () => {
    expect(resendRefusal({ sent: false, reason: 'no-email', to: null })).toBe(
      'This order has no email address to send to.'
    );
  });

  it('names the address on the do-not-email list, and why it is there', () => {
    expect(resendRefusal({ sent: false, reason: 'suppressed', to: 'a@b.test' })).toBe(
      'a@b.test is on your do-not-email list, because an email to it bounced or was marked as spam.'
    );
  });

  it('says when the confirmation email is not set up', () => {
    expect(resendRefusal({ sent: false, reason: 'no-template', to: 'a@b.test' })).toBe(
      'Your order confirmation email is not set up yet.'
    );
  });
});
