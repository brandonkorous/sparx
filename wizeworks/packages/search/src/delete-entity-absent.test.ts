// Taking a record out of search when it is already out (sparx persona issue
// 086).
//
// The indexer clears the kind a billing document is NOT on every event about
// it, and that entry usually never existed. A delete that threw on "not found"
// would fail every such event and retry it forever.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const remove = vi.fn();

vi.mock('./client', () => ({
  getClient: () => ({
    collections: () => ({ documents: () => ({ delete: remove }) }),
  }),
}));

const { deleteCustomer, deleteEntity } = await import('./indexer');

function failure(httpStatus: number): Error {
  return Object.assign(new Error(`status ${String(httpStatus)}`), { httpStatus });
}

beforeEach(() => {
  remove.mockReset();
});

describe('deleteEntity', () => {
  it('counts a record that is not there as already deleted', async () => {
    remove.mockRejectedValue(failure(404));
    await expect(deleteEntity('t', 'quote', 'r')).resolves.toBeUndefined();
  });

  it('still fails on anything else, so the event is retried', async () => {
    remove.mockRejectedValue(failure(503));
    await expect(deleteEntity('t', 'quote', 'r')).rejects.toThrow('status 503');
  });
});

// A trade account that is renamed or removed re-reads every person ever on its
// contact list, deleted ones included, and a deleted person's document is usually
// long gone.
describe('deleteCustomer', () => {
  it('counts a customer who is not there as already deleted', async () => {
    remove.mockRejectedValue(failure(404));
    await expect(deleteCustomer('t', 'c')).resolves.toBeUndefined();
  });

  it('still fails on anything else, so the event is retried', async () => {
    remove.mockRejectedValue(failure(503));
    await expect(deleteCustomer('t', 'c')).rejects.toThrow('status 503');
  });
});
