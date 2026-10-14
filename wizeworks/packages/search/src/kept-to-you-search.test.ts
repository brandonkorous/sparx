// "Search everything" keeps to itself what its maker kept to herself (persona
// issue 264).
//
// Boards and reports went into the index for issue 261, every one of them, so a
// board Doty kept to himself came up when Mike typed its name. A board or report
// document now says who may find it (`visible_to`), and every search of the
// index asks for what this person may see, while the documents of every other
// kind, which carry no such list, are found as before.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from 'typesense';

import { forgetLiveFields } from './live-fields';

const sent: Record<string, unknown>[] = [];
let liveFields: string[] = [];
const client = {
  collections: (_name: string) => ({
    retrieve: () => Promise.resolve({ fields: liveFields.map((name) => ({ name })) }),
    documents: () => ({
      search: (params: Record<string, unknown>) => {
        sent.push(params);
        return Promise.resolve({ found: 0, hits: [] });
      },
    }),
  }),
} as unknown as Client;
vi.mock('./client', () => ({ getClient: () => client }));

const { searchAll } = await import('./search');
const { entitiesSchema, PERSONAL_ENTITY_TYPES, VISIBLE_TO_EVERYONE } = await import('./schemas');

const T = '5944fe23-be83-4ce5-aafc-ef56b8594508';
const MIKE = '0d07a000-0000-4000-8000-000000000002';

beforeEach(() => {
  sent.length = 0;
  liveFields = ['tenant_id', 'entity_type', 'visible_to'];
  forgetLiveFields();
});

const filterSent = () => String(sent[0]?.filter_by);

describe('who a board or report is found by', () => {
  it('finds for a person what is shared and what is theirs, and every other kind as before', async () => {
    await searchAll({ tenantId: T, q: 'Monday', viewerId: MIKE });
    expect(filterSent()).toContain(
      `(entity_type:!=[\`report\`,\`dashboard\`] || visible_to:=[\`everyone\`,\`${MIKE}\`])`
    );
    expect(filterSent()).toContain(`tenant_id:=${T}`);
  });

  it('finds nothing private for a caller that is not a person', async () => {
    await searchAll({ tenantId: T, q: 'Monday' });
    expect(filterSent()).toContain(
      '(entity_type:!=[`report`,`dashboard`] || visible_to:=[`everyone`])'
    );
  });

  it('leaves boards and reports out entirely while the index cannot tell who may see them', async () => {
    liveFields = ['tenant_id', 'entity_type'];
    await searchAll({ tenantId: T, q: 'Monday', viewerId: MIKE });
    expect(filterSent()).toContain('entity_type:!=[`report`,`dashboard`]');
    expect(filterSent()).not.toContain('visible_to');
  });

  it('is a field the index adds to a live collection on its own', () => {
    const field = entitiesSchema().fields?.find((f) => f.name === 'visible_to');
    expect(field).toMatchObject({ type: 'string[]', optional: true });
    expect(PERSONAL_ENTITY_TYPES).toEqual(['report', 'dashboard']);
    expect(VISIBLE_TO_EVERYONE).toBe('everyone');
  });
});
