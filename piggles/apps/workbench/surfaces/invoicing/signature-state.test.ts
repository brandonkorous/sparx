import { describe, expect, it } from 'vitest';

import type { DocumentSignature } from '../crm/workspace-data';
import { canTakeBack, effectiveStatus, expiryLine, seenLine } from './signature-state';

// A signature request said "Waiting for them" about a link that had died, and
// said nothing at all about whether the customer had opened it. Both facts were on
// the row. Measured 2026-09-28: `expireStale` has exactly one reference in the
// repository, its own definition, and its comment claims a schedule that does not
// exist — so the only thing that ever flipped a pending row to expired was the
// customer opening a link that no longer worked (issue 868).

const NOW = Date.parse('2026-09-28T12:00:00Z');
const day = (iso: string) => iso.slice(0, 10);

function sig(over: Partial<DocumentSignature> = {}): DocumentSignature {
  return {
    id: 's1',
    signerName: 'Dana Whitfield',
    signerEmail: 'dana@example.test',
    status: 'pending',
    requestedAt: '2026-09-01T09:00:00Z',
    expiresAt: '2026-10-08T09:00:00Z',
    viewedAt: null,
    signedAt: null,
    declinedAt: null,
    declineReason: null,
    ...over,
  };
}

describe('what the request is really doing', () => {
  it('calls a pending request with a dead link expired', () => {
    // THE DEFECT. Nothing sweeps, so the stored word can be weeks stale and the
    // owner reads "Waiting for them" about a link nobody can use.
    expect(effectiveStatus(sig({ expiresAt: '2026-09-01T09:00:00Z' }), NOW)).toBe('expired');
    expect(effectiveStatus(sig({ expiresAt: '2026-10-08T09:00:00Z' }), NOW)).toBe('pending');
  });

  it('leaves every other status exactly as it was recorded', () => {
    // These are things that HAPPENED. A date cannot make them untrue, and a read
    // that second-guessed them would be re-writing history on screen.
    for (const status of ['signed', 'declined', 'revoked', 'expired'] as const) {
      expect(effectiveStatus(sig({ status, expiresAt: '2020-01-01T00:00:00Z' }), NOW)).toBe(status);
    }
  });

  it('stops offering to take back a request that already stopped working', () => {
    // The server would ACCEPT the revoke: the row still says pending, so it would
    // record a withdrawal of something nobody could use anyway.
    expect(canTakeBack(sig(), NOW)).toBe(true);
    expect(canTakeBack(sig({ expiresAt: '2026-09-01T09:00:00Z' }), NOW)).toBe(false);
    expect(canTakeBack(sig({ status: 'signed' }), NOW)).toBe(false);
  });
});

describe('whether they have looked at it', () => {
  it('says so, with the day, when they have', () => {
    expect(seenLine(sig({ viewedAt: '2026-09-20T10:00:00Z' }), NOW, day)).toBe(
      'They opened it 2026-09-20'
    );
  });

  it('tells "not yet" apart from "never"', () => {
    // Not the same news. One is a customer thinking about it; the other is a
    // customer who never got the email, and the link is now dead.
    expect(seenLine(sig(), NOW, day)).toMatch(/not opened it yet/);
    expect(seenLine(sig({ expiresAt: '2026-09-01T09:00:00Z' }), NOW, day)).toMatch(
      /never opened it/
    );
  });

  it('says nothing about a request that has been answered', () => {
    expect(
      seenLine(sig({ status: 'signed', signedAt: '2026-09-10T10:00:00Z' }), NOW, day)
    ).toBeNull();
    expect(seenLine(sig({ status: 'declined' }), NOW, day)).toBeNull();
    expect(seenLine(sig({ status: 'revoked' }), NOW, day)).toBeNull();
  });
});

describe('when the link dies', () => {
  it('says the date while it still works', () => {
    expect(expiryLine(sig(), NOW, day)).toBe('The link works until 2026-10-08');
  });

  it('says it in the past once it has', () => {
    expect(expiryLine(sig({ expiresAt: '2026-09-01T09:00:00Z' }), NOW, day)).toBe(
      'The link stopped working on 2026-09-01'
    );
  });

  it('says nothing once it has been signed', () => {
    expect(expiryLine(sig({ status: 'signed' }), NOW, day)).toBeNull();
    expect(expiryLine(sig({ status: 'revoked' }), NOW, day)).toBeNull();
  });

  it('writes no em dash and no developer words', () => {
    const said = [
      seenLine(sig(), NOW, day),
      seenLine(sig({ viewedAt: '2026-09-20T10:00:00Z' }), NOW, day),
      seenLine(sig({ expiresAt: '2026-09-01T09:00:00Z' }), NOW, day),
      expiryLine(sig(), NOW, day),
      expiryLine(sig({ expiresAt: '2026-09-01T09:00:00Z' }), NOW, day),
    ].filter((line): line is string => line !== null);
    expect(said).toHaveLength(5);
    for (const line of said) {
      expect(line).not.toContain('—');
      expect(line).not.toMatch(/\btoken\b|expiresAt|viewedAt|\bstatus\b|pending/i);
    }
  });
});
