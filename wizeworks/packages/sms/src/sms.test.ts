import { describe, expect, it } from 'vitest';

import { ConsoleSmsProvider } from './providers/console';
import { TwilioSmsProvider } from './providers/twilio';
import { hasTwilioConfig, resolveSmsProvider } from './registry';
import { looksLikePhone } from './provider';

describe('ConsoleSmsProvider', () => {
  it('reports success with a synthetic id', async () => {
    const result = await new ConsoleSmsProvider().send({ to: '+15555550123', body: 'hi' });
    expect(result.success).toBe(true);
    expect(result.messageId).toMatch(/^console_/);
  });
});

describe('resolveSmsProvider', () => {
  it('defaults to the console provider with no config', () => {
    expect(resolveSmsProvider({}).id).toBe('console');
  });

  it('uses Twilio only when selected AND fully configured', () => {
    // Selected but missing creds → console (fail safe, never a broken send).
    expect(resolveSmsProvider({ SMS_PROVIDER: 'twilio' }).id).toBe('console');
    const full = {
      SMS_PROVIDER: 'twilio',
      TWILIO_ACCOUNT_SID: 'AC123',
      TWILIO_AUTH_TOKEN: 'tok',
      TWILIO_FROM: '+15555550100',
    };
    expect(hasTwilioConfig(full)).toBe(true);
    const provider = resolveSmsProvider(full);
    expect(provider.id).toBe('twilio');
    expect(provider).toBeInstanceOf(TwilioSmsProvider);
  });

  it('accepts a messaging service sid in place of a from number', () => {
    expect(
      hasTwilioConfig({
        TWILIO_ACCOUNT_SID: 'AC1',
        TWILIO_AUTH_TOKEN: 't',
        TWILIO_MESSAGING_SERVICE_SID: 'MG1',
      })
    ).toBe(true);
  });
});

describe('looksLikePhone', () => {
  it('accepts E.164-ish numbers and rejects junk', () => {
    expect(looksLikePhone('+15555550123')).toBe(true);
    expect(looksLikePhone('(555) 555-0123')).toBe(true);
    expect(looksLikePhone('not-a-phone')).toBe(false);
    expect(looksLikePhone(null)).toBe(false);
  });
});
