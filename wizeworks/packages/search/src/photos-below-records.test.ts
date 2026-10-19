// A photo comes below the record it shows (sparx persona issue 292).
//
// Gillett's photos are named for the part on them, so typing the part number
// 4062328 found "4062328_1.png" above the O-ring, and "injector" a photo above every
// injector: a photo's file name is its title, the field weighted highest. "Search
// everything" now sorts a photo below any record that also matches; a search only
// photos match (a file name) still finds them.

import { describe, expect, it, vi } from 'vitest';
import type { Client } from 'typesense';

const sent: Record<string, unknown>[] = [];
const client = {
  collections: (_name: string) => ({
    retrieve: () => Promise.resolve({ fields: [] }),
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

describe('the order of "Search everything"', () => {
  it('sorts a photo below any record before it compares how well each matched', async () => {
    await searchAll({ tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508', q: '4062328' });
    const sort = String(sent[0]?.sort_by).split(',');
    expect(sort[0]).toBe('_eval([(entity_type:media):0');
    expect(sort[1]).toBe('(entity_type:!=media):1]):desc');
    expect(sort[2]).toBe('_text_match:desc');
  });
});
