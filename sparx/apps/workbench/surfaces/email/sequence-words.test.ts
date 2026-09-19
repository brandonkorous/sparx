import { describe, expect, it } from 'vitest';
import {
  nothingAddsAnyone,
  sequenceNotice,
  sequenceRowState,
  turnOnWords,
  type Enrollers,
} from './sequence-words';

// A SEQUENCE THAT IS "ON" AND CANNOT REACH ONE PERSON.
//
// A sequence sends nothing by itself: an automation with the action "Add to an
// email sequence" has to put a person in, or somebody has to add them by hand.
// The editor with the Turn on button never said so, and after turning it on it
// reported "People enrolled from now on will start receiving the emails."
//
// Measured 2026-09-18 against the platform database:
//   automations                        2,411
//   automations that enroll anybody        0
//   email sequences                       15   (every one a draft)
//   enrollments, ever                      0
//
// So that sentence described nobody, and would have gone on describing nobody.

const none: Enrollers = { total: 0, live: 0 };
const wiredButOff: Enrollers = { total: 2, live: 0 };
const working: Enrollers = { total: 1, live: 1 };

describe('whether anything can add a person today', () => {
  it('reads the automations that are ON, not the ones that exist', () => {
    // Two rules pointed at it and both switched off is the same outcome as none.
    expect(nothingAddsAnyone(wiredButOff)).toBe(true);
    expect(nothingAddsAnyone(none)).toBe(true);
    expect(nothingAddsAnyone(working)).toBe(false);
  });
});

describe('the statement at the top of the editor', () => {
  it('is there in the draft state, which is the state every sequence is in', () => {
    const notice = sequenceNotice('draft', none);
    expect(notice.title).toContain('draft');
    expect(notice.body).toContain('Nothing adds anyone');
  });

  it('names both ways in whenever nothing is wired up', () => {
    for (const status of ['draft', 'active'] as const) {
      const body = sequenceNotice(status, none).body;
      expect(body).toContain('Add to an email sequence');
      expect(body).toContain('Enrolled people');
    }
  });

  it('turns amber only when it is ON and cannot reach anybody', () => {
    expect(sequenceNotice('active', none).color).toBe('warning');
    expect(sequenceNotice('active', wiredButOff).color).toBe('warning');
    expect(sequenceNotice('active', working).color).toBe('info');
    // A draft that reaches nobody is not a problem, it is a draft.
    expect(sequenceNotice('draft', none).color).toBe('info');
  });

  it('tells "nothing points at it" apart from "the rule is switched off"', () => {
    const nothing = sequenceNotice('active', none);
    const off = sequenceNotice('active', wiredButOff);
    expect(nothing.title).not.toBe(off.title);
    // Because the remedies are different: build one, versus turn one on.
    expect(off.body).toContain('none of them is switched on');
  });

  it('never says the same thing in two different states', () => {
    const said = [
      sequenceNotice('draft', none),
      sequenceNotice('draft', wiredButOff),
      sequenceNotice('draft', working),
      sequenceNotice('active', none),
      sequenceNotice('active', wiredButOff),
      sequenceNotice('active', working),
      sequenceNotice('archived', none),
    ].map((n) => `${n.title}|${n.body}`);
    expect(new Set(said).size).toBe(said.length);
  });

  it('counts automations in words, never "automation(s)"', () => {
    expect(sequenceNotice('active', working).body).toContain('1 automation ');
    expect(sequenceNotice('active', wiredButOff).body).toContain('2 automations');
    for (const n of [none, wiredButOff, working]) {
      expect(sequenceNotice('active', n).body).not.toContain('(s)');
    }
  });

  it('makes the VERB agree with the count, not just the noun', () => {
    // The assertion above reads `toContain('1 automation ')` and stops on the
    // space — one character before the word that was wrong. Five sentences read
    // "1 automation add people to it" on screen while it passed, and ONE is the
    // commonest number there is: it is what the first rule somebody builds looks
    // like. [[feedback_a_test_that_cannot_go_red]]
    expect(sequenceNotice('active', working).body).toContain('1 automation adds people');
    expect(sequenceNotice('active', { total: 3, live: 3 }).body).toContain(
      '3 automations add people'
    );

    expect(sequenceNotice('draft', working).body).toContain('1 automation already adds people');
    expect(sequenceNotice('draft', { total: 2, live: 2 }).body).toContain(
      '2 automations already add people'
    );

    expect(sequenceNotice('draft', { total: 1, live: 0 }).body).toContain('1 automation points at');
    expect(sequenceNotice('active', { total: 1, live: 0 }).body).toContain(
      '1 automation points at'
    );
    expect(sequenceNotice('active', wiredButOff).body).toContain('2 automations point at');

    expect(turnOnWords('Welcome series', working).description).toContain(
      '1 automation adds people'
    );
    expect(turnOnWords('Welcome series', { total: 4, live: 4 }).description).toContain(
      '4 automations add people'
    );
  });

  it('never leaves a singular subject next to a plural verb', () => {
    // The general form of the bug, so a SIXTH sentence written later cannot
    // reintroduce it quietly. Every sentence that can say "1 automation" is
    // listed here, and the word that follows is read back whole.
    const one: Enrollers = { total: 1, live: 1 };
    const oneOff: Enrollers = { total: 1, live: 0 };
    const sentences = [
      sequenceNotice('draft', one).body,
      sequenceNotice('draft', oneOff).body,
      sequenceNotice('active', one).body,
      sequenceNotice('active', oneOff).body,
      turnOnWords('Welcome series', one).description,
      turnOnWords('Welcome series', oneOff).description,
    ].filter((body) => body.includes('1 automation'));

    // Five, not six: turning ON a sequence that one PAUSED rule points at says
    // "nothing adds anyone" and gives the two ways in, so it never counts.
    expect(sentences).toHaveLength(5);

    const verbs = sentences.map((body) => {
      const rest = body.split('1 automation ')[1] ?? '';
      // "already adds" is two words; every other case is one.
      return rest.startsWith('already ') ? 'already adds' : (rest.split(/[\s.,]/)[0] ?? '');
    });

    expect(verbs).toEqual(['already adds', 'points', 'adds', 'points', 'adds']);
  });
});

describe('the badge on a row', () => {
  it('does not wear the working green when it is on and adds nobody', () => {
    expect(sequenceRowState('active', none)).toEqual({
      tone: 'warning',
      label: 'On, adds nobody',
    });
    expect(sequenceRowState('active', working)).toEqual({ tone: 'success', label: 'On' });
  });

  it('warns the same way when the rules exist but are all switched off', () => {
    // From the row's point of view the outcome is identical: nobody arrives.
    expect(sequenceRowState('active', wiredButOff)).toEqual({
      tone: 'warning',
      label: 'On, adds nobody',
    });
  });

  it('leaves a draft alone: a draft is not failing at anything', () => {
    expect(sequenceRowState('draft', none).tone).toBe('info');
    expect(sequenceRowState('draft', none).label).toBe('Draft');
  });
});

describe('the toast when she turns it on', () => {
  it('does not promise delivery when nothing can add a person', () => {
    const said = turnOnWords('Welcome series', none);
    expect(said.type).toBe('warning');
    expect(said.title).toContain('nothing adds anyone');
    expect(said.description).toContain('Add to an email sequence');
  });

  it('says who is feeding it when something is', () => {
    const said = turnOnWords('Welcome series', working);
    expect(said.type).toBe('success');
    expect(said.title).toBe('Welcome series is on');
    expect(said.description).toContain('1 automation');
  });

  it('carries the sequence her own name for it', () => {
    expect(turnOnWords('Autumn nudge', working).title).toContain('Autumn nudge');
    expect(turnOnWords('Autumn nudge', none).title).toContain('Autumn nudge');
  });
});
