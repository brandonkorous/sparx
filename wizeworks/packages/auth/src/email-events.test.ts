import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetPublisherForTest } from '@wizeworks/events';
import { publishAuthEmail, type PublishAuthEmailInput } from './email-events';

// With EVENT_BROKER unset, `resolveTransport` selects the logging stub, which
// writes a line and DROPS the event. That is the state a fresh checkout is in,
// and it is the state in which every passwordless route into the product used
// to report a delivery it had not made.
//
// No network is touched: the stub is the whole transport under test.

const BROKER_KEYS = ['EVENT_BROKER', 'EVENT_BROKER_URL', 'SPARX_DEV_WORKER_ROUTES'] as const;
const saved: Record<string, string | undefined> = {};

const email = (template: PublishAuthEmailInput['template']): PublishAuthEmailInput => ({
  tenantId: '2e78fb6c-a823-4698-bcb9-58a4f17710a0',
  actorId: null,
  template,
  to: 'someone@example.com',
  props: {},
});

beforeEach(() => {
  for (const key of BROKER_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  _resetPublisherForTest();
  // The stub logs the envelope it is discarding; nothing here is asserting on
  // that, and a test run should not print it.
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  for (const key of BROKER_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  _resetPublisherForTest();
  vi.restoreAllMocks();
});

const AWAITED = ['magic-link', 'password-reset', 'email-verification', 'login-otp'] as const;
const NOTICES = ['password-changed', 'new-device-signin', 'invitation-accepted'] as const;

describe('publishAuthEmail on a transport that discards', () => {
  for (const template of AWAITED) {
    it(`refuses to report a ${template} as sent`, async () => {
      await expect(publishAuthEmail(email(template))).rejects.toThrow(/EVENT_BROKER/);
    });
  }

  it('names the variable to set rather than only the failure', async () => {
    // The person hitting this is a developer locked out of a dev account. The
    // fix has to be in the message, or it costs an afternoon — which it did.
    await expect(publishAuthEmail(email('magic-link'))).rejects.toThrow(/EVENT_BROKER=nats/);
  });

  for (const template of NOTICES) {
    it(`still lets the ${template} notice through`, async () => {
      // These report on something that ALREADY happened. Failing the action
      // because its confirmation could not be queued would be worse than the
      // missing confirmation.
      await expect(publishAuthEmail(email(template))).resolves.toBeUndefined();
    });
  }
});
