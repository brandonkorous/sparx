import { describe, expect, it } from 'vitest';
import { partnerSeenLine, neverUsedTheirAccess } from './partner-seen-line';

// The shortest possible stand-ins, so the assertions are about the SENTENCE and
// not about date formatting.
const on = (iso: string): string => iso.slice(0, 10);
const ago = (): string => '3d ago';

const GRANTED = '2026-07-21T09:00:00.000Z';

describe('what a partner has done with the key', () => {
  it('says plainly when an outsider has never signed in', () => {
    // The case that exists right now: 2 grants, every module, every site, handed
    // over in July, never used.
    const line = partnerSeenLine(
      { createdAt: GRANTED, lastLoginAt: null, lastActiveAt: null },
      on,
      ago
    );
    expect(line).toBe('Given access 2026-07-21 · has never signed in');
  });

  it('says when they last did sign in', () => {
    const line = partnerSeenLine(
      { createdAt: GRANTED, lastLoginAt: '2026-09-25T11:00:00.000Z', lastActiveAt: null },
      on,
      ago
    );
    expect(line).toBe('Given access 2026-07-21 · last signed in 3d ago · 2026-09-25');
  });

  it('does not claim never about somebody with work behind them', () => {
    // Signed in before the platform started recording it. Saying "never" here
    // would be a flat falsehood about a real person, which is issue 853 again.
    const line = partnerSeenLine(
      { createdAt: GRANTED, lastLoginAt: null, lastActiveAt: '2026-09-24T10:00:00.000Z' },
      on,
      ago
    );
    expect(line).toBe('Given access 2026-07-21 · last signed in not known');
    expect(line).not.toMatch(/never/);
  });

  it('always says when access was given, whatever else it knows', () => {
    const cases = [
      { createdAt: GRANTED, lastLoginAt: null, lastActiveAt: null },
      { createdAt: GRANTED, lastLoginAt: null, lastActiveAt: '2026-09-24T10:00:00.000Z' },
      { createdAt: GRANTED, lastLoginAt: '2026-09-25T11:00:00.000Z', lastActiveAt: null },
    ];
    for (const seen of cases) {
      expect(partnerSeenLine(seen, on, ago)).toContain('Given access 2026-07-21');
    }
  });

  it('flags a key that has never been used, and only that', () => {
    expect(
      neverUsedTheirAccess({ createdAt: GRANTED, lastLoginAt: null, lastActiveAt: null })
    ).toBe(true);
    // Has activity, so they signed in before it was recorded. Not a dormant key.
    expect(
      neverUsedTheirAccess({
        createdAt: GRANTED,
        lastLoginAt: null,
        lastActiveAt: '2026-09-24T10:00:00.000Z',
      })
    ).toBe(false);
    expect(
      neverUsedTheirAccess({
        createdAt: GRANTED,
        lastLoginAt: '2026-09-25T11:00:00.000Z',
        lastActiveAt: null,
      })
    ).toBe(false);
  });

  it('never leaves an em dash or a raw timestamp in the sentence', () => {
    const line = partnerSeenLine(
      { createdAt: GRANTED, lastLoginAt: '2026-09-25T11:00:00.000Z', lastActiveAt: null },
      on,
      ago
    );
    expect(line).not.toContain('—');
    expect(line).not.toContain('T11:00:00');
  });
});
