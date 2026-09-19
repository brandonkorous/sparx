// A FAILED FETCH MUST NOT BECOME A FACT ABOUT HER BUSINESS.
//
// Juniper Row has nine customer groups. The Special prices pane read them
// through `query.data?.items ?? []` and said "You have no customer groups yet.
// Create one under Customers" whenever that fetch did not come back.

import { describe, expect, it } from 'vitest';

import { choiceListNote } from './choice-list-note';

const GROUPS = {
  none: 'You have no customer groups yet. Create one under Customers, then choose it here.',
  noun: 'customer groups',
};

describe('when the list could not be read', () => {
  it('never says she has none', () => {
    const said = choiceListNote({ isPending: false, isError: true, count: 0 }, GROUPS);
    expect(said).not.toContain('no customer groups');
    expect(said).not.toContain('Create one');
  });

  it('says what went wrong, and that it is not about her business', () => {
    expect(choiceListNote({ isPending: false, isError: true, count: 0 }, GROUPS)).toBe(
      'Your customer groups could not be loaded just now. That is a problem reaching the ' +
        'server, not something missing from your business. Close this and open it again.'
    );
  });

  it('still says so even if a stale count is sitting in hand', () => {
    // A refetch can fail with old data still cached. The count is not evidence
    // of anything once the read it came from has been superseded by a failure.
    expect(choiceListNote({ isPending: false, isError: true, count: 9 }, GROUPS)).toContain(
      'could not be loaded'
    );
  });
});

describe('when the list really is empty', () => {
  it('uses the caller sentence, because only the caller knows where to go', () => {
    expect(choiceListNote({ isPending: false, isError: false, count: 0 }, GROUPS)).toBe(
      GROUPS.none
    );
  });
});

describe('when there is nothing to say', () => {
  it('says nothing while the list is still coming', () => {
    // The control shows its own placeholder; a note that flashes on every open
    // is noise.
    expect(choiceListNote({ isPending: true, isError: false, count: 0 }, GROUPS)).toBe(null);
  });

  it('says nothing over a list that has options in it', () => {
    expect(choiceListNote({ isPending: false, isError: false, count: 9 }, GROUPS)).toBe(null);
  });
});
