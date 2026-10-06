import { describe, expect, it } from 'vitest';
import { fleetListState } from './fleet-list-state';

describe('fleetListState', () => {
  it('waits while the lists are still coming', () => {
    expect(fleetListState({ isPending: true, isError: false }, 0)).toBe('loading');
  });

  it('says the read failed, not that the shop has no list', () => {
    expect(fleetListState({ isPending: false, isError: true }, 0)).toBe('failed');
  });

  it('says there is no list only when the lists were read and none can be picked from', () => {
    expect(fleetListState({ isPending: false, isError: false }, 0)).toBe('none');
  });

  it('offers the picker when there is a list to pick from', () => {
    expect(fleetListState({ isPending: false, isError: false }, 2)).toBe('ready');
  });
});
