// The roster's "What they can reach" column, which used to answer half its own
// question.
//
// Access narrows on two axes. The column described one of them, so an editor
// held to one shop out of seven read "Everything their role allows" — true
// about the apps, silent about the only limit actually in force (issue 879).
//
// Each case is written so a plausible wrong version fails it:
//   · dropping the sites clause       → the site cases go red
//   · dropping the apps clause        → the apps cases go red
//   · treating an empty grant list as unrestricted → the "nothing chosen" cases
//     go red, and that is the dangerous one: it would print "everything" over
//     somebody who can reach nothing

import { describe, expect, it } from 'vitest';
import { describeReach, nameList, type ReachNames, type ReachSubject } from './reach';

const SITES: Record<string, string> = {
  s1: 'Juniper Row',
  s2: 'Juniper Row Sample Sale',
  s3: 'Juniper Row Press',
  s4: 'Juniper Row Trade',
};

const names: ReachNames = {
  moduleName: (slug) => ({ commerce: 'Sell', inventory: 'Stock', crm: 'Customers' })[slug] ?? slug,
  siteName: (id) => SITES[id] ?? 'A site since removed',
};

/** An ordinary editor with nothing narrowed, which every case starts from. */
const editor: ReachSubject = {
  role: 'editor',
  kind: 'member',
  moduleAccessMode: 'all',
  modules: [],
  propertyAccessMode: 'all',
  properties: [],
};

describe('describeReach - the column answers both questions', () => {
  it('says everything for the two roles the server refuses to limit', () => {
    expect(describeReach({ ...editor, role: 'owner' }, names)).toBe('Everything');
    expect(describeReach({ ...editor, role: 'admin' }, names)).toBe('Everything');
  });

  it('says what the role allows when nothing is narrowed', () => {
    expect(describeReach(editor, names)).toBe('Everything their role allows');
  });

  it('names the apps when only the apps are narrowed', () => {
    const person: ReachSubject = {
      ...editor,
      moduleAccessMode: 'selected',
      modules: ['commerce', 'inventory'],
    };
    expect(describeReach(person, names)).toBe('Sell, Stock');
  });

  it('names the site when only the site is narrowed', () => {
    // THE CASE THE COLUMN USED TO MISS ENTIRELY. Devi's Saturday assistant can
    // open every app, on one shop out of seven.
    const person: ReachSubject = {
      ...editor,
      propertyAccessMode: 'selected',
      properties: ['s2'],
    };
    expect(describeReach(person, names)).toBe(
      'Everything their role allows · Juniper Row Sample Sale only'
    );
  });

  it('carries both clauses when both are narrowed', () => {
    const person: ReachSubject = {
      ...editor,
      moduleAccessMode: 'selected',
      modules: ['commerce'],
      propertyAccessMode: 'selected',
      properties: ['s2'],
    };
    expect(describeReach(person, names)).toBe('Sell · Juniper Row Sample Sale only');
  });

  it('says so when a limit is on and nothing is ticked', () => {
    // Both are real, saveable states that leave somebody able to sign in and
    // reach nothing. Reading them as "unrestricted" is the inversion that would
    // hurt most, so both are pinned.
    expect(describeReach({ ...editor, moduleAccessMode: 'selected', modules: [] }, names)).toBe(
      'Nothing chosen yet'
    );
    expect(
      describeReach({ ...editor, propertyAccessMode: 'selected', properties: [] }, names)
    ).toBe('Everything their role allows · No sites chosen yet');
  });

  it('names a site that has since been deleted, rather than printing an id', () => {
    const person: ReachSubject = {
      ...editor,
      propertyAccessMode: 'selected',
      properties: ['gone-1234'],
    };
    expect(describeReach(person, names)).toBe(
      'Everything their role allows · A site since removed only'
    );
  });

  it('promises only the role for somebody who has not accepted yet', () => {
    // An invitation holds no grants, so any narrower claim would be invented.
    const invited: ReachSubject = { role: 'editor', kind: 'invitation' };
    expect(describeReach(invited, names)).toBe('Everything their role allows');
  });

  it('shortens sites sooner than apps, because business names run longer', () => {
    const person: ReachSubject = {
      ...editor,
      propertyAccessMode: 'selected',
      properties: ['s1', 's2', 's3', 's4'],
    };
    expect(describeReach(person, names)).toBe(
      'Everything their role allows · Juniper Row, Juniper Row Sample Sale and 2 more only'
    );
  });
});

describe('nameList', () => {
  it('lists everything while the list stays readable', () => {
    expect(nameList(['a', 'b', 'c'], 3)).toBe('a, b, c');
  });

  it('counts the rest once it does not', () => {
    expect(nameList(['a', 'b', 'c', 'd'], 3)).toBe('a, b, c and 1 more');
  });

  it('says nothing for an empty list rather than inventing a zero', () => {
    expect(nameList([], 3)).toBe('');
  });
});
