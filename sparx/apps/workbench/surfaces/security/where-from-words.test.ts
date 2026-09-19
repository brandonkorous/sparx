// A PLACEHOLDER MAY NOT BE PRINTED AS A PLACE.
//
// The Devices signed in card said "From ::" over a line whose only purpose is
// letting an owner recognize her own devices.

import { describe, expect, it } from 'vitest';

import { whereFrom, whereFromPrefix, whereFromSentence } from './where-from-words';

describe('addresses that are not places', () => {
  it('drops the one that was actually on screen', () => {
    expect(whereFrom('::')).toBe(null);
    expect(whereFromPrefix('::')).toBe('');
  });

  it('drops every other way a layer says it recorded nothing', () => {
    const nowhere = [
      '::1',
      '0.0.0.0',
      '127.0.0.1',
      '::ffff:127.0.0.1',
      '::ffff:0.0.0.0',
      'unknown',
      'null',
      'undefined',
    ];
    for (const value of nowhere) {
      expect(whereFrom(value), value).toBe(null);
    }
  });

  it('is not case sensitive about them', () => {
    expect(whereFrom('UNKNOWN')).toBe(null);
    expect(whereFrom('::FFFF:127.0.0.1')).toBe(null);
  });

  it('drops blank, whitespace, null and undefined alike', () => {
    for (const value of ['', '   ', null, undefined]) {
      expect(whereFrom(value), JSON.stringify(value)).toBe(null);
    }
  });
});

describe('addresses that are places', () => {
  it('keeps a real one', () => {
    expect(whereFrom('203.0.113.9')).toBe('203.0.113.9');
    expect(whereFromPrefix('203.0.113.9')).toBe('From 203.0.113.9 · ');
  });

  it('keeps a real IPv6 one', () => {
    // Only the all-zeros and loopback forms mean nothing. A routable v6 address
    // is an answer, and rejecting every v6 address would be the same bug in
    // reverse — silence where there IS evidence.
    expect(whereFrom('2001:db8::42')).toBe('2001:db8::42');
  });

  it('takes the client out of a forwarded chain, not the last proxy', () => {
    // `x-forwarded-for` is `client, proxy1, proxy2`. The hops are not where she
    // is sitting, and the last one is our own load balancer.
    expect(whereFrom('203.0.113.9, 70.41.3.18, 150.172.238.178')).toBe('203.0.113.9');
  });

  it('still drops a chain whose client entry is a placeholder', () => {
    expect(whereFrom('unknown, 70.41.3.18')).toBe(null);
  });

  it('trims the spaces a header leaves behind', () => {
    expect(whereFrom('  203.0.113.9  ')).toBe('203.0.113.9');
  });
});

describe('the sentence the sign-out dialog uses', () => {
  it('says it when there is something to say', () => {
    expect(whereFromSentence('203.0.113.9')).toBe('It was last seen from 203.0.113.9. ');
  });

  it('says nothing rather than "last seen from ::"', () => {
    // The dialog asks her to sign a device out. Telling her it was last seen
    // nowhere is worse than not mentioning where it was seen.
    expect(whereFromSentence('::')).toBe('');
    expect(whereFromSentence(null)).toBe('');
  });

  it('leaves no stray separator behind when it says nothing', () => {
    // The separator belongs to the clause. A prefix of "From ·" reads as a
    // missing value, which is the thing being fixed.
    expect(whereFromPrefix(null)).not.toContain('·');
    expect(whereFromSentence(null)).not.toContain('.');
  });
});
