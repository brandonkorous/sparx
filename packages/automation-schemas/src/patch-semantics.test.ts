// See @sparx/crm-schemas' patch-semantics.test.ts for the full story: a
// `.default()` survives `.partial()`, so a PATCH schema built from a create
// schema fabricates values the caller never sent, and the update service writes
// them. Here that meant renaming an automation RESET ITS CONDITIONS to the empty
// group — turning "email customers who spent over $500" into "email everyone".

import { describe, expect, it } from 'vitest';

import { UpdateAutomationInput } from './automation';

describe('UpdateAutomationInput', () => {
  it('parses an empty patch into an empty object', () => {
    expect(UpdateAutomationInput.parse({})).toEqual({});
  });

  it('does not fabricate conditions when only the name changes', () => {
    expect(UpdateAutomationInput.parse({ name: 'Renamed' })).toEqual({ name: 'Renamed' });
  });

  it('still accepts an explicit conditions replacement', () => {
    const conditions = { logic: 'AND' as const, conditions: [] };
    expect(UpdateAutomationInput.parse({ conditions })).toEqual({ conditions });
  });
});
