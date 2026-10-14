// A line that only shows on the live site sometimes says so on the canvas (persona
// issue 948): a journal's new list of authors read "Nobody has anything published
// yet" in the editor while it had four contributors.

import { describe, expect, it } from 'vitest';

import { gateNote } from './render-node';

describe('gateNote', () => {
  it('says a list’s empty line shows only while the list is empty', () => {
    expect(gateNote({ data: { kind: 'visible', ref: 'cmsAuthors', negate: true } })).toBe(
      'Shows on your site only while this list is empty.'
    );
  });

  it('says a gated part shows only when it has something to show', () => {
    expect(gateNote({ data: { kind: 'visible', ref: 'heroImage' } })).toContain(
      'only when it has something to show'
    );
  });

  it('says nothing about a node that always shows', () => {
    expect(gateNote({ data: { kind: 'value', ref: 'title' } })).toBeUndefined();
    expect(gateNote({})).toBeUndefined();
  });
});
