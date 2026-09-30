import { describe, expect, it } from 'vitest';

import type { CustomerMatch } from './data';
import { hasHistory, whoBadge, whoNote } from './who-line';

// The panel answered one question and there were two answers, so a repeat buyer
// read "Visitor". Measured 2026-09-28: 8 conversations on the database, 8 with a
// null customer_id, because the public widget is the only creator and passes
// none. The middle state is what this file holds the words for (issue 864).

const ALL: CustomerMatch[] = ['record', 'email', 'none'];

describe('what the panel calls them', () => {
  it('has a badge for every state, and no two say the same thing', () => {
    const labels = ALL.map((m) => whoBadge(m).label);
    expect(labels.filter((l) => l.trim() === '')).toEqual([]);
    expect(new Set(labels).size).toBe(ALL.length);
  });

  it('never calls a possible customer a customer', () => {
    // THE REGRESSION THIS FILE EXISTS FOR. Collapsing the email match back into
    // "Customer" is the original defect wearing a new coat: the screen would
    // state as fact something a visitor typed into a box.
    expect(whoBadge('email').label).not.toBe(whoBadge('record').label);
    expect(whoBadge('email').label).toMatch(/possible/i);
  });

  it('leaves the unknown state colorless rather than grey', () => {
    // A colorless badge is sanctioned and needs no approval; `neutral` is not
    // ours to choose. Passing null here is what stops `color="neutral"` coming
    // back to this one call site.
    expect(whoBadge('none').color).toBeNull();
    expect(whoBadge('record').color).toBe('module');
    expect(whoBadge('email').color).toBe('info');
  });
});

describe('the sentence that keeps it honest', () => {
  it('explains the email match and names who it matched', () => {
    const note = whoNote('email', 'Jordan Hiker', 'Rosa Delgado');
    expect(note).toContain('Rosa Delgado');
    expect(note).toMatch(/email address you already have/);
  });

  it('does not print the same name twice', () => {
    const note = whoNote('email', 'Rosa Delgado', 'Rosa Delgado');
    expect(note).not.toBeNull();
    expect((note ?? '').match(/Rosa Delgado/g)).toBeNull();
  });

  it('still says something when the address book has no name for them', () => {
    expect(whoNote('email', 'Jordan Hiker', null)).toMatch(/already have/);
    expect(whoNote('email', 'Jordan Hiker', '   ')).toMatch(/already have/);
  });

  it('says nothing when there is nothing to explain', () => {
    expect(whoNote('record', 'Rosa Delgado', 'Rosa Delgado')).toBeNull();
    expect(whoNote('none', 'Anonymous visitor', null)).toBeNull();
  });

  it('writes no em dash and no developer words', () => {
    const said = ALL.flatMap((m) => [
      whoNote(m, 'Jordan Hiker', 'Rosa Delgado'),
      whoNote(m, 'Jordan Hiker', null),
    ]).filter((s): s is string => s !== null);
    expect(said.length).toBeGreaterThan(0);
    for (const line of said) {
      expect(line).not.toContain('—');
      expect(line).not.toMatch(/\bCRM\b|customer_id|record|linked|match/i);
    }
  });
});

describe('the history and the badge cannot disagree', () => {
  it('shows a spend history exactly when the badge claims a customer', () => {
    // The panel draws order count, lifetime value and the recent orders under
    // this. If the two ever came apart, a history would sit under a badge that
    // says the shop has never met this person.
    const disagreements: string[] = [];
    for (const match of ALL) {
      const claims = whoBadge(match).label !== whoBadge('none').label;
      if (claims !== hasHistory(match)) {
        disagreements.push(
          `${match}: badge says ${String(claims)}, history says ${String(hasHistory(match))}`
        );
      }
    }
    expect(disagreements).toEqual([]);
  });
});
