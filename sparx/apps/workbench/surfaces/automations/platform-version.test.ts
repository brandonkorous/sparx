// What the business is shown before switching a rule sparx set up to sparx's newer
// version: which parts change, under the editor's own names, and what stays.
//
// The words for each part are the flow map's (`ruleWords` in the presentation
// module, which is JSX and cannot load here), so this hands in a plain stand-in
// and pins the comparison itself: what counts as a difference and what does not.

import { describe, expect, it } from 'vitest';
import type { PlatformDocument } from './automations-data';
import {
  PLATFORM_UPDATE_TEXT,
  PLATFORM_VERSION_WORDS,
  platformVersionChanges,
  statusKept,
  type RuleWords,
} from './platform-version';

const words: RuleWords = {
  trigger: (triggerType) => `When ${triggerType}`,
  conditions: (group, none) =>
    group.conditions.length === 0 ? [none] : group.conditions.map((c) => JSON.stringify(c)),
  steps: (actions) =>
    (Array.isArray(actions) ? (actions as { type: string }[]) : []).map(
      (a, i) => `${String(i + 1)}. ${a.type}`
    ),
};

const theirs: PlatformDocument = {
  description: 'Say hello',
  triggerType: 'order.placed',
  triggerConfig: { eventType: 'order.placed' },
  conditions: { logic: 'AND', conditions: [] },
  actions: [{ type: 'crm.add_tag', config: { tags: ['new'] } }],
  goal: null,
  maxDepth: 3,
};

describe('platformVersionChanges', () => {
  it('lists nothing when the two are the same rule, whatever the key order', () => {
    const reordered: PlatformDocument = {
      ...theirs,
      conditions: { conditions: [], logic: 'AND' },
      actions: [{ config: { tags: ['new'] }, type: 'crm.add_tag' }],
    };
    expect(platformVersionChanges(reordered, theirs, words)).toEqual([]);
  });

  it('lists only the parts that differ, in the editor’s order and under its names', () => {
    const newer: PlatformDocument = {
      ...theirs,
      description: 'Say hello, better',
      triggerType: 'order.paid',
      triggerConfig: { eventType: 'order.paid' },
    };
    const changes = platformVersionChanges(theirs, newer, words);
    expect(changes.map((c) => c.label)).toEqual(['What starts it', 'Description']);
    expect(changes[0]).toMatchObject({
      yours: ['When order.placed'],
      theirs: ['When order.paid'],
      hidden: false,
    });
    expect(changes[1]).toMatchObject({ yours: ['Say hello'], theirs: ['Say hello, better'] });
  });

  it('reads every step on each side when the steps change', () => {
    const newer: PlatformDocument = {
      ...theirs,
      actions: [
        { type: 'crm.add_tag', config: { tags: ['new'] } },
        { type: 'crm.add_note', config: { body: 'Welcomed' } },
      ],
    };
    const [steps] = platformVersionChanges(theirs, newer, words);
    expect(steps?.label).toBe('What it does');
    expect(steps?.yours).toEqual(['1. crm.add_tag']);
    expect(steps?.theirs).toEqual(['1. crm.add_tag', '2. crm.add_note']);
  });

  it('says when a change hides inside a step that reads the same', () => {
    const mine: PlatformDocument = {
      ...theirs,
      actions: [{ type: 'crm.add_note', config: { body: 'Ours' } }],
    };
    const newer: PlatformDocument = {
      ...theirs,
      actions: [{ type: 'crm.add_note', config: { body: 'Theirs' } }],
    };
    const [steps] = platformVersionChanges(mine, newer, words);
    expect(steps?.hidden).toBe(true);
  });

  it('treats an empty goal as no goal, and a blank description as none', () => {
    const blank: PlatformDocument = {
      ...theirs,
      description: '  ',
      goal: { logic: 'AND', conditions: [] },
    };
    const none: PlatformDocument = { ...theirs, description: null };
    expect(platformVersionChanges(blank, none, words)).toEqual([]);
  });

  it('shows "Runs every time" for the side with no conditions', () => {
    const newer: PlatformDocument = {
      ...theirs,
      conditions: {
        logic: 'AND',
        conditions: [{ field: 'order.total', operator: 'gt', value: 1 }],
      },
    };
    const [only] = platformVersionChanges(theirs, newer, words);
    expect(only?.label).toBe('Only if');
    expect(only?.yours).toEqual(['Runs every time']);
    expect(only?.theirs).toHaveLength(1);
  });

  it('names a changed chaining limit and a new goal', () => {
    const newer: PlatformDocument = {
      ...theirs,
      maxDepth: 5,
      goal: { logic: 'AND', conditions: [{ field: 'order.paid', operator: 'eq', value: true }] },
    };
    const changes = platformVersionChanges(theirs, newer, words);
    expect(changes.map((c) => c.label)).toEqual([
      'What it’s aiming for',
      'How deep rules may chain',
    ]);
    expect(changes[0]?.yours).toEqual(['No goal set']);
    expect(changes[1]).toMatchObject({ yours: ['3'], theirs: ['5'] });
  });
});

describe('what the switch promises', () => {
  it('names the name it keeps and the on/off it leaves alone', () => {
    expect(PLATFORM_VERSION_WORDS.confirmKeeps('Say hi', 'paused')).toContain(
      'Say hi, and it stays paused'
    );
    expect(statusKept('active')).toBe('it stays switched on');
    expect(statusKept('draft')).toBe('it stays switched off');
    expect(PLATFORM_VERSION_WORDS.confirmKeeps('Say hi', 'active')).toContain('history');
  });

  it('writes plain sentences: no dashes standing in for punctuation', () => {
    const sentences: string[] = [
      ...Object.values(PLATFORM_UPDATE_TEXT),
      ...Object.values(PLATFORM_VERSION_WORDS).filter((w) => typeof w === 'string'),
      PLATFORM_VERSION_WORDS.confirmTitle('Say hi'),
      PLATFORM_VERSION_WORDS.confirmKeeps('Say hi', 'active'),
    ];
    for (const s of sentences) expect(s).not.toMatch(/[–—]/);
  });
});
