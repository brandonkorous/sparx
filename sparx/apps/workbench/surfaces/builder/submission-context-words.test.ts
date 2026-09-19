// A LABEL SAYING "THEIR IP ADDRESS" MAKES WHATEVER IS BESIDE IT EVIDENCE.
//
// Measured 2026-09-17: 7 of the 7 form submissions on the platform carry an
// address that means "nowhere was recorded", and all 7 carry a raw user agent.
// So on every form reply anybody has ever opened, both of these rows were noise,
// and the first presented a placeholder as a fact about a stranger.

import { describe, expect, it } from 'vitest';

import { contextRow } from './submission-context-words';

/** The caller's renderer for everything that is not one of the two special
 *  fields. Plain here; the real one formats dates on the shop's clock. */
const plain = (_key: string, value: unknown) => (typeof value === 'string' ? value : String(value));

describe('the address', () => {
  it('draws no row at all for a placeholder', () => {
    // Every one of these is what some layer writes when it has nothing to
    // write. A row reading "Their IP address · ::1" is worse than no row.
    for (const nowhere of ['::1', '::', '127.0.0.1', '0.0.0.0', '::ffff:127.0.0.1', 'unknown']) {
      expect(contextRow('ip', nowhere, plain), nowhere).toBe(null);
    }
  });

  it('draws the row when there is a real address', () => {
    expect(contextRow('ip', '203.0.113.42', plain)).toEqual({
      label: 'Their IP address',
      value: '203.0.113.42',
    });
  });

  it('keeps the client, not the proxies it came through', () => {
    expect(contextRow('ip', '203.0.113.42, 10.0.0.1, 10.0.0.2', plain)?.value).toBe('203.0.113.42');
  });
});

describe('the browser', () => {
  it('never prints the raw string', () => {
    const agent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';
    const row = contextRow('userAgent', agent, plain);
    expect(row?.value).toBe('Chrome on Windows');
    expect(row?.value).not.toContain('Mozilla');
  });

  it('says so honestly when it cannot tell', () => {
    // Still a ROW, unlike the address: "Unknown device" is an answer to "what
    // were they using", where a placeholder address is not an answer to "where
    // were they".
    expect(contextRow('userAgent', 'curl/8.4.0', plain)).toEqual({
      label: 'Their browser',
      value: 'Unknown device',
    });
    expect(contextRow('userAgent', null, plain)?.value).toBe('Unknown device');
  });
});

describe('everything else', () => {
  it('uses the friendly label where there is one', () => {
    expect(contextRow('referrer', 'https://example.com/shop', plain)?.label).toBe(
      'Page they came from'
    );
  });

  it('humanises a key nobody has named, so a new field still shows up', () => {
    // `humanizeKey` is the console's own, shared with the answers list above
    // this card, so the two read the same way. It title-cases each word.
    expect(contextRow('utmCampaign', 'autumn-drop', plain)).toEqual({
      label: 'Utm Campaign',
      value: 'autumn-drop',
    });
  });

  it('does not say the received time twice', () => {
    // "Received" is already drawn above this list.
    expect(contextRow('submittedAt', '2026-09-01T04:34:00Z', plain)).toBe(null);
  });

  it('draws no row for a blank value', () => {
    expect(contextRow('referrer', '   ', plain)).toBe(null);
  });
});
