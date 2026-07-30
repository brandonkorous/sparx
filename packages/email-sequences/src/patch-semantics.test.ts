// See @sparx/crm-schemas' patch-semantics.test.ts for the full story: a
// `.default()` survives `.partial()`, so a PATCH schema built from a create
// schema fabricates values the caller never sent, and the update service writes
// them. Here that meant renaming a sequence DELETED EVERY STEP in it — `steps`
// defaults to `[]` on create, so the whole email flow was emptied by an edit
// that only touched the title.

import { describe, expect, it } from 'vitest';

import { UpdateSequenceInput } from './schemas';

describe('UpdateSequenceInput', () => {
  it('parses an empty patch into an empty object', () => {
    expect(UpdateSequenceInput.parse({})).toEqual({});
  });

  it('does not wipe the steps when only the name changes', () => {
    expect(UpdateSequenceInput.parse({ name: 'Welcome series' })).toEqual({
      name: 'Welcome series',
    });
  });

  it('still accepts an explicit empty steps list', () => {
    expect(UpdateSequenceInput.parse({ steps: [] })).toEqual({ steps: [] });
  });
});
