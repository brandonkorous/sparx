import { describe, expect, it } from 'vitest';
import { parseUnread } from './inbox-filters';

describe('the inbox Unread toggle, from a link', () => {
  it('turns on only for the literal the toggle itself would send', () => {
    expect(parseUnread('true')).toBe(true);
    // Anything else is "no narrowing". A guess here would open an inbox that
    // silently hides answered conversations behind a toggle nobody pressed.
    for (const raw of [undefined, '', 'false', '1', 'yes', true]) {
      expect(parseUnread(raw), String(raw)).toBe(false);
    }
  });
});
