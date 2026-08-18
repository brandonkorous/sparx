import { describe, expect, it } from 'vitest';

import {
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateCollectionInput,
  UpdateCollectionInput,
} from './categories';

// Model B per-site scoping (docs/49 §3) on collections + categories — the 4th/5th
// instance of the same junction pattern products use. These guard the exact
// data-loss footgun the product schema test guards: a partial UPDATE that omits
// `propertyIds` must NOT come back with the create-default `[]`, or every metadata
// save would silently wipe an item's site-scope links.

describe('CreateCategoryInput / CreateCollectionInput — propertyIds defaults to []', () => {
  it('category: an absent propertyIds takes the [] create default', () => {
    const parsed = CreateCategoryInput.parse({ name: 'Bowls' });
    expect(parsed.propertyIds).toEqual([]);
  });

  it('collection: an absent propertyIds takes the [] create default', () => {
    const parsed = CreateCollectionInput.parse({ name: 'Fan Favorites' });
    expect(parsed.propertyIds).toEqual([]);
  });

  it('honors an explicit set on create', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(CreateCategoryInput.parse({ name: 'X', propertyIds: [id] }).propertyIds).toEqual([id]);
    expect(CreateCollectionInput.parse({ name: 'X', propertyIds: [id] }).propertyIds).toEqual([id]);
  });
});

describe('UpdateCategoryInput / UpdateCollectionInput — partial update never re-applies the [] default', () => {
  it('category: omitting propertyIds leaves the key ABSENT (no scope clobber)', () => {
    const parsed = UpdateCategoryInput.parse({ name: 'Renamed', description: 'edited' });
    // The service guards on `input.propertyIds !== undefined`, so a re-applied
    // default here would delete every link on a plain rename.
    expect('propertyIds' in parsed).toBe(false);
    expect(Object.keys(parsed).sort()).toEqual(['description', 'name']);
  });

  it('collection: omitting propertyIds leaves the key ABSENT', () => {
    const parsed = UpdateCollectionInput.parse({ name: 'Renamed' });
    expect('propertyIds' in parsed).toBe(false);
    expect(Object.keys(parsed)).toEqual(['name']);
  });

  it('an explicit empty array is a real "show on all sites" intent and passes through', () => {
    expect(UpdateCategoryInput.parse({ propertyIds: [] }).propertyIds).toEqual([]);
    expect(UpdateCollectionInput.parse({ propertyIds: [] }).propertyIds).toEqual([]);
  });

  it('honors a specific set on update', () => {
    const id = '22222222-2222-4222-8222-222222222222';
    expect(UpdateCategoryInput.parse({ propertyIds: [id] }).propertyIds).toEqual([id]);
    expect(UpdateCollectionInput.parse({ propertyIds: [id] }).propertyIds).toEqual([id]);
  });
});
