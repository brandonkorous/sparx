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

// A form with an empty optional field sends `null`, not `undefined`: the editor
// holds `heroMediaId: string | null` and `seoTitle: ''`, and turns the blank into
// null on the way out. Rejecting that made the Groups pane unsaveable until any
// banner, social picture and BOTH search fields were filled in (issue 202).
describe('clearing an optional field', () => {
  const CLEARABLE = {
    description: null,
    heroMediaId: null,
    seoTitle: null,
    seoDescription: null,
    ogImageId: null,
  };

  it('collection: null clears, on create and on update', () => {
    expect(CreateCollectionInput.safeParse({ name: 'New in', ...CLEARABLE }).success).toBe(true);
    const parsed = UpdateCollectionInput.parse({ name: 'New in', ...CLEARABLE });
    // Null must SURVIVE — the service writes what it is given, and dropping it
    // here would silently turn "remove the banner" into "leave it alone".
    expect(parsed.heroMediaId).toBeNull();
    expect(parsed.seoTitle).toBeNull();
  });

  it('category: the same, plus its own icon', () => {
    const input = { name: 'Knitwear', iconMediaId: null, ...CLEARABLE };
    expect(CreateCategoryInput.safeParse(input).success).toBe(true);
    expect(UpdateCategoryInput.parse(input).iconMediaId).toBeNull();
  });

  it('still refuses a value of the wrong TYPE — nullable is not anything-goes', () => {
    expect(UpdateCollectionInput.safeParse({ heroMediaId: 'not-a-uuid' }).success).toBe(false);
    expect(UpdateCollectionInput.safeParse({ seoTitle: 42 }).success).toBe(false);
  });
});
