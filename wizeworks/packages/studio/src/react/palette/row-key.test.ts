import { describe, expect, it } from 'vitest';
import { rowKey } from './palette';

// Browsing renders one list per group, so an item key unique within its group is
// enough. Search flattens every group into ONE list, where two different things
// may legitimately share a name.

describe('rowKey', () => {
  const item = (key: string) => ({ key }) as Parameters<typeof rowKey>[1];

  it('separates the same key in two groups, which is what search flattens together', () => {
    expect(rowKey('Data', item('timeline'))).not.toBe(rowKey('How it works', item('timeline')));
  });

  it('separates two items inside one group', () => {
    expect(rowKey('Data', item('timeline'))).not.toBe(rowKey('Data', item('stat')));
  });

  it('is stable for the same row, so a re-render keeps its identity', () => {
    expect(rowKey('Data', item('timeline'))).toBe(rowKey('Data', item('timeline')));
  });

  it('still produces a key when the group is unknown', () => {
    expect(rowKey(undefined, item('timeline'))).toBe(':timeline');
  });
});
