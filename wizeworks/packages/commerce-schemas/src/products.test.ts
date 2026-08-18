import { describe, expect, it } from 'vitest';

import { CreateProductInput, UpdateProductInput } from './products';

describe('CreateProductInput — defaults fill on create', () => {
  it('an absent field takes its create default', () => {
    const parsed = CreateProductInput.parse({ title: 'Strawberry Dream' });
    expect(parsed.status).toBe('draft');
    expect(parsed.tags).toEqual([]);
    expect(parsed.categoryIds).toEqual([]);
    expect(parsed.collectionIds).toEqual([]);
    expect(parsed.propertyIds).toEqual([]);
    expect(parsed.fulfillmentType).toBe('physical');
    expect(parsed.requiresShipping).toBe(true);
  });
});

describe('UpdateProductInput — partial update never re-applies create defaults', () => {
  // Regression guard for the data-loss bug: in this Zod version `.partial()` does
  // NOT strip `.default()`, so a partial body that omits these fields used to come
  // back filled with the create-defaults (status:'draft', categoryIds:[], …). The
  // product service guards each write on `input.X !== undefined`, so the injected
  // defaults silently reverted status → draft and WIPED category / collection /
  // site-scope links on every Overview save. The schema must yield ONLY the keys
  // the caller actually sent.
  it('omitted defaulted fields stay undefined (no status/links clobber)', () => {
    const parsed = UpdateProductInput.parse({
      title: 'Strawberry Dream',
      handle: 'strawberry-fields',
      description: 'Local strawberries & dragon fruit.',
    });

    expect('status' in parsed).toBe(false);
    expect('tags' in parsed).toBe(false);
    expect('categoryIds' in parsed).toBe(false);
    expect('collectionIds' in parsed).toBe(false);
    expect('propertyIds' in parsed).toBe(false);
    expect('fulfillmentType' in parsed).toBe(false);
    expect('hazmatClass' in parsed).toBe(false);
    expect('requiresShipping' in parsed).toBe(false);
    expect(Object.keys(parsed).sort()).toEqual(['description', 'handle', 'title']);
  });

  it('still honors the fields a caller DOES send', () => {
    const parsed = UpdateProductInput.parse({
      status: 'active',
      categoryIds: ['11111111-1111-4111-8111-111111111111'],
      propertyIds: [],
    });
    expect(parsed.status).toBe('active');
    expect(parsed.categoryIds).toEqual(['11111111-1111-4111-8111-111111111111']);
    // An explicit empty array is a real "clear" intent and must pass through.
    expect(parsed.propertyIds).toEqual([]);
  });
});
