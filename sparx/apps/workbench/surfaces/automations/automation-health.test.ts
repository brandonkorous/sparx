import { describe, expect, it } from 'vitest';
import { automationHealth, lastAttempt } from './automation-health';

/**
 * "ON", IN GREEN, OVER A RULE THAT HAS NEVER ONCE WORKED.
 *
 * Automations, 2026-09-16. Devi's list, as it stood:
 *
 *     Invoice overdue (7 days)      ⚠8  8   yesterday   [On]
 *     Return approved: email        ⚠4  4   last week   [On]
 *     Return received: email        ⚠3  4   last week   [On]
 *
 * Twenty-two of her thirty-one runs had failed, and every row said On. Three
 * rules on her shop had `runCount: 0` — triggered, failed, never once done the
 * thing. A customer whose return she approved was promised a confirmation email
 * and got nothing, four times, while the screen said the rule was running.
 *
 * Platform-wide: 73 failed runs across 4 tenants, 71 of them "no executor
 * registered for action", the most recent yesterday. And **zero** automations in
 * the entire database carry the `error` status the "Needs attention" badge
 * waits for — because nothing sets it. The engine says so itself: "that
 * pause-on-repeated-failure policy is a later (UI) slice."
 *
 * The counters were on the row the whole time, and already drawn two columns to
 * the left of the badge that contradicted them.
 */
describe('automationHealth', () => {
  it('says a rule is not working when it has never once succeeded', () => {
    const health = automationHealth('active', 0, 4);
    expect(health?.label).toBe('Not working');
    expect(health?.tone).toBe('error');
    expect(health?.detail).toContain('4 times');
  });

  it('reads naturally when it has only been tried once', () => {
    expect(automationHealth('active', 0, 1)?.detail).toContain('once');
  });

  it('warns without crying wolf when it mostly works', () => {
    const health = automationHealth('active', 6, 2);
    expect(health?.label).toBe('Some failures');
    expect(health?.tone).toBe('warning');
    // Attempts are the two counters ADDED: `runCount` excludes failures.
    expect(health?.detail).toContain('2 of its 8 attempts');
  });

  it('never tells her to open what she already has open', () => {
    // The EDITOR badged a failing rule a green "On" while the list beside it
    // said "Some failures" — the same defect this module was written to kill,
    // fixed in two of the three places that show it. The editor now reads the
    // same rule, so its sentence has to stand where she is standing: no "open
    // it", and no naming a control, because the screen it appears on puts the
    // button to the failures right beside the words.
    // [[feedback_a_fix_leaves_its_neighbour_behind]]
    for (const health of [automationHealth('active', 0, 4), automationHealth('active', 6, 2)]) {
      expect(health?.inside).not.toContain('Open');
      expect(health?.detail).toContain('Open it');
    }
  });

  it('says what the failures COST her, not just that they happened', () => {
    // "8 of its 16 attempts failed" is a number. The thing she is actually
    // being told is that eight customers were promised something and got
    // nothing.
    expect(automationHealth('active', 8, 8)?.inside).toContain(
      'some of what it promises did not happen'
    );
    expect(automationHealth('active', 0, 4)?.inside).toContain(
      'Nothing it promises has happened yet'
    );
  });

  it('counts the same way in both sentences', () => {
    const health = automationHealth('active', 6, 2);
    expect(health?.inside).toContain('2 of its 8 attempts');
    expect(automationHealth('active', 0, 1)?.inside).toContain('once');
    expect(automationHealth('active', 0, 4)?.inside).toContain('4 times');
  });

  it('says nothing about a rule that has never failed', () => {
    expect(automationHealth('active', 12, 0)).toBeNull();
  });

  it('says nothing about a rule nobody has run', () => {
    expect(automationHealth('active', 0, 0)).toBeNull();
  });

  it('leaves a paused or draft rule alone', () => {
    // It is not trying, so its old failures are history rather than news.
    expect(automationHealth('paused', 0, 4)).toBeNull();
    expect(automationHealth('draft', 0, 4)).toBeNull();
  });
});

describe('lastAttempt', () => {
  it('reports a failure as the last attempt, rather than "not run yet"', () => {
    const last = lastAttempt(null, '2026-08-28T11:00:26Z');
    expect(last?.failed).toBe(true);
    expect(last?.at).toBe('2026-08-28T11:00:26Z');
  });

  it('prefers whichever actually happened last', () => {
    expect(lastAttempt('2026-09-10T00:00:00Z', '2026-08-01T00:00:00Z')?.failed).toBe(false);
    expect(lastAttempt('2026-08-01T00:00:00Z', '2026-09-10T00:00:00Z')?.failed).toBe(true);
  });

  it('says nothing when the rule really has never been set off', () => {
    expect(lastAttempt(null, null)).toBeNull();
  });

  it('reports a clean run as a clean run', () => {
    expect(lastAttempt('2026-09-10T00:00:00Z', null)).toEqual({
      at: '2026-09-10T00:00:00Z',
      failed: false,
    });
  });
});
