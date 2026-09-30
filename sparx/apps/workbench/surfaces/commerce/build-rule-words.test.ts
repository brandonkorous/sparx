// What a build rule says out loud.
//
// Both panes that print a rule read this one function now, so what it says is
// worth pinning: a rule that adds something to the order has to NAME the thing
// and say HOW MANY, and a price rule with no amount on it must not describe a
// change that never happens (issue 797).

import { describe, expect, it } from 'vitest';
import { ruleSentence, type ConfiguratorOption, type ConfiguratorRule } from './products-data';

const SIZE: ConfiguratorOption = {
  key: 'size',
  label: 'Size',
  type: 'single_choice',
  required: true,
  defaultChoiceKeys: [],
  position: 0,
  choices: [
    { key: 'sm', label: 'Small', position: 0 },
    { key: 'lg', label: 'Large', position: 1 },
  ],
};

const ADD_ONS = [
  { variantId: 'v-gift', productTitle: 'Gift box' },
  { variantId: 'v-blank', productTitle: null },
];

function rule(actions: ConfiguratorRule['actions']): ConfiguratorRule {
  return {
    name: 'A rule',
    match: 'all',
    conditions: [{ optionKey: 'size', op: 'in', value: 'lg' }],
    actions,
    priority: 0,
  };
}

describe('ruleSentence', () => {
  it('names the extra a rule adds', () => {
    const said = ruleSentence(
      rule([{ kind: 'add_addon', variantId: 'v-gift', quantity: 1 }]),
      [SIZE],
      'USD',
      ADD_ONS
    );
    expect(said).toBe('When Size is Large, the order gets Gift box.');
  });

  it('counts the extras when a rule adds more than one', () => {
    const said = ruleSentence(
      rule([{ kind: 'add_addon', variantId: 'v-gift', quantity: 3 }]),
      [SIZE],
      'USD',
      ADD_ONS
    );
    expect(said).toBe('When Size is Large, the order gets 3 of Gift box.');
  });

  it('falls back to plain words when the extra has no title', () => {
    expect(
      ruleSentence(
        rule([{ kind: 'add_addon', variantId: 'v-blank', quantity: 2 }]),
        [SIZE],
        'USD',
        ADD_ONS
      )
    ).toBe('When Size is Large, the order gets 2 extras.');
  });

  it('falls back when the build carries no add-ons at all', () => {
    expect(
      ruleSentence(rule([{ kind: 'add_addon', variantId: 'v-gone', quantity: 1 }]), [SIZE], 'USD')
    ).toBe('When Size is Large, the order gets an extra.');
  });

  it('says the price is left alone rather than "changes by nothing"', () => {
    const said = ruleSentence(
      rule([{ kind: 'price_adjust', deltaCents: 0 }]),
      [SIZE],
      'USD',
      ADD_ONS
    );
    expect(said).toBe('When Size is Large, the price is left alone.');
    expect(said).not.toContain('nothing');
  });

  it('still prints a real price change, signed', () => {
    expect(
      ruleSentence(rule([{ kind: 'price_adjust', deltaCents: 500 }]), [SIZE], 'USD', ADD_ONS)
    ).toBe('When Size is Large, the price changes by +$5.00.');
    expect(
      ruleSentence(rule([{ kind: 'price_adjust', deltaCents: -500 }]), [SIZE], 'USD', ADD_ONS)
    ).toBe('When Size is Large, the price changes by \u2212$5.00.');
  });

  it('keeps the author\u2019s own label on a price rule that does nothing', () => {
    expect(
      ruleSentence(
        rule([{ kind: 'price_adjust', deltaCents: 0, label: 'No charge' }]),
        [SIZE],
        'USD',
        ADD_ONS
      )
    ).toBe('When Size is Large, the price is left alone (No charge).');
  });

  it('reads the questions and answers by their labels, never their keys', () => {
    expect(ruleSentence(rule([{ kind: 'hide', optionKey: 'size' }]), [SIZE], 'USD')).toBe(
      'When Size is Large, Size is not asked.'
    );
  });
});
