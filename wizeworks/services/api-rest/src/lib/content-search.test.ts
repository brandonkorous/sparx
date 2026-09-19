// ONE TABLE, TWO NAMES IN THE SEARCH INDEX.
//
// `content_entries` is projected by two projectors that split on a single
// column: `typeKey = 'page'` becomes a `cms_page` document, everything else a
// `cms_entry` one. A route that saves a content entry holds an id and nothing
// else, so it cannot know which of the two it just changed.
//
// Before 2026-09-18 the routes signalled neither, and `check:search-entities`
// nonetheless reported `cms_page` as signalled, because it matched the word in
// an SEO audit snapshot that uses the same key for something else entirely.
// A page published this morning was not findable this afternoon, and the check
// said it was fine.
//
// These tests hold the rule that fixes it: BOTH names, every time, including the
// delete. [[feedback_a_fix_leaves_its_neighbour_behind]]

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Signal {
  tenantId: string;
  actorId?: string | null;
  entityType: string;
  recordId: string;
  op?: string;
}

const signals: Signal[] = [];

vi.mock('@wizeworks/events', () => ({
  indexEntity: (input: Signal) => {
    signals.push(input);
    return Promise.resolve();
  },
}));

const { indexContentEntry } = await import('./content-search.js');

const TENANT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ACTOR = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ENTRY = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

beforeEach(() => {
  signals.length = 0;
});

describe('telling the search index a content entry changed', () => {
  it('names BOTH kinds, because the route cannot know which one this row is', async () => {
    await indexContentEntry({ tenantId: TENANT, actorId: ACTOR }, ENTRY);
    expect(signals.map((s) => s.entityType).sort()).toEqual(['cms_entry', 'cms_page']);
  });

  it('carries the same record and tenant on both', async () => {
    await indexContentEntry({ tenantId: TENANT, actorId: ACTOR }, ENTRY);
    for (const signal of signals) {
      expect(signal.recordId).toBe(ENTRY);
      expect(signal.tenantId).toBe(TENANT);
      expect(signal.actorId).toBe(ACTOR);
    }
  });

  it('upserts by default', async () => {
    await indexContentEntry({ tenantId: TENANT }, ENTRY);
    expect(signals.map((s) => s.op)).toEqual(['upsert', 'upsert']);
  });

  it('removes BOTH documents on a delete', async () => {
    // A page deleted while only `cms_entry` was told would go on being findable
    // under its other name, and clicking the hit would open nothing.
    await indexContentEntry({ tenantId: TENANT }, ENTRY, 'delete');
    expect(signals.map((s) => `${s.entityType}:${String(s.op)}`).sort()).toEqual([
      'cms_entry:delete',
      'cms_page:delete',
    ]);
  });

  it('sends a null actor rather than undefined when nobody is named', async () => {
    // A background writer has no person behind it. The event's actor is nullable
    // and an absent key is not the same thing as a stated "nobody".
    await indexContentEntry({ tenantId: TENANT }, ENTRY);
    for (const signal of signals) expect(signal.actorId).toBeNull();
  });
});
