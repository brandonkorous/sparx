// The voice abstraction (docs/144 §5.6).
//
// The cases that matter are the ones where a vendor's vocabulary and ours
// disagree, and the ones where a person typed a phone number the way people
// type phone numbers.

import { describe, expect, it } from 'vitest';

import { looksLikePhone, toE164 } from './provider';
import { canPlaceCalls, resolveVoiceProvider } from './registry';
import { ConsoleVoiceProvider } from './providers/console';
import { outcomeFor, TwilioVoiceProvider } from './providers/twilio';

describe('phone numbers', () => {
  it('accepts what a person actually types', () => {
    expect(toE164('(555) 010-9999')).toBe('+15550109999');
    expect(toE164('555-010-9999')).toBe('+15550109999');
    expect(toE164('+44 20 7946 0958')).toBe('+442079460958');
    // A number already carrying a country code is not given a second one.
    expect(toE164('15550109999')).toBe('+15550109999');
  });

  it('refuses what cannot be dialled', () => {
    expect(toE164('')).toBeNull();
    expect(toE164('12345')).toBeNull();
    expect(toE164('not a phone')).toBeNull();
    expect(looksLikePhone(null)).toBe(false);
    expect(looksLikePhone('+15550109999')).toBe(true);
  });

  it('honours a non-US default region', () => {
    expect(toE164('20 7946 0958', '44')).toBe('+442079460958');
  });
});

describe('provider selection', () => {
  it('falls back to console rather than failing when a tenant has no phone system', () => {
    // The whole path still runs — the call is logged against the record — so a
    // tenant who has not connected a vendor is not blocked from using the CRM.
    expect(resolveVoiceProvider(null)).toBeInstanceOf(ConsoleVoiceProvider);
    expect(resolveVoiceProvider({ provider: 'twilio' })).toBeInstanceOf(ConsoleVoiceProvider);
    expect(canPlaceCalls({ provider: 'twilio', accountSid: 'AC1' })).toBe(false);
  });

  it('uses the tenant’s own credentials when they are complete', () => {
    const credentials = {
      provider: 'twilio',
      accountSid: 'AC1',
      authToken: 'secret',
      fromNumber: '+15550100000',
    };
    expect(canPlaceCalls(credentials)).toBe(true);
    expect(resolveVoiceProvider(credentials)).toBeInstanceOf(TwilioVoiceProvider);
  });

  it('ignores a provider name it does not recognize instead of throwing', () => {
    // A typo in a config value must not stop somebody being able to call.
    expect(
      resolveVoiceProvider({ provider: 'twillio', accountSid: 'a', authToken: 'b' })
    ).toBeInstanceOf(ConsoleVoiceProvider);
  });
});

describe('Twilio status → our vocabulary', () => {
  it('reads a zero-length "completed" call as nobody answering', () => {
    // `completed` means the call ENDED, not that anyone spoke. Recording it as
    // a conversation would tell a rep they already spoke to someone they did not.
    expect(outcomeFor('completed', 0)).toBe('no_answer');
    expect(outcomeFor('completed', 45)).toBe('connected');
  });

  it('maps the terminal statuses and ignores the rest', () => {
    expect(outcomeFor('busy', null)).toBe('busy');
    expect(outcomeFor('no-answer', null)).toBe('no_answer');
    expect(outcomeFor('failed', null)).toBe('no_answer');
    // Not terminal — nothing to record yet.
    expect(outcomeFor('ringing', null)).toBeNull();
    expect(outcomeFor('in-progress', null)).toBeNull();
    expect(outcomeFor('queued', null)).toBeNull();
  });

  it('parses a real webhook body', () => {
    const provider = new TwilioVoiceProvider({ accountSid: 'AC1', authToken: 'x' });
    expect(
      provider.parseStatus({ CallSid: 'CA123', CallStatus: 'completed', CallDuration: '92' })
    ).toEqual({
      providerCallId: 'CA123',
      outcome: 'connected',
      durationSec: 92,
      recordingUrl: null,
    });
  });

  it('returns null for a body it cannot use', () => {
    const provider = new TwilioVoiceProvider({ accountSid: 'AC1', authToken: 'x' });
    expect(provider.parseStatus({})).toBeNull();
    expect(provider.parseStatus({ CallSid: 'CA123', CallStatus: 'ringing' })).toBeNull();
  });
});

describe('the console provider', () => {
  it('reports success with a recognizably fake id', async () => {
    // Prefixed so a console-placed call is obvious in the database rather than
    // looking like a real id nobody can find in a vendor dashboard.
    const result = await new ConsoleVoiceProvider().place({
      to: '+15550109999',
      from: '+15550100000',
      bridgeTo: '+15550101111',
    });
    expect(result.success).toBe(true);
    expect(result.providerCallId).toMatch(/^console-/);
  });
});
