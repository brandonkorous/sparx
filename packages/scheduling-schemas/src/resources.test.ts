// The partial-update footgun, on the schema that had it worst.
//
// `.partial()` makes every field optional but does NOT strip the `.default()`s, so a
// PATCH that omits a defaulted field parses back WITH the create default re-applied.
// `updateResource` spreads the parsed input straight into the Prisma `data`, so every
// re-applied default was WRITTEN — renaming a resource reset its timezone to UTC, its
// capacity to 1 and its skill tags to []. `UpdateResourceInput` now overrides each
// defaulted field as plain-optional so "omitted = untouched" actually holds.
//
// The same guard exists on categories/collections (commerce-schemas) and products.
// This is the third instance; treat a new `.default()` on any Create input as a bug
// in its Update sibling until proven otherwise.

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CreateResourceInput, UpdateResourceInput } from './resources';

const ID = '11111111-1111-4111-8111-111111111111';
const SITE = '22222222-2222-4222-8222-222222222222';

describe('UpdateResourceInput', () => {
  it('leaves every omitted field absent, so a rename touches nothing else', () => {
    const parsed = UpdateResourceInput.parse({ id: ID, name: 'Chair 1' });
    expect(parsed).toEqual({ id: ID, name: 'Chair 1' });
    // Named individually: these are the fields that were being silently rewritten.
    for (const key of [
      'timezone',
      'exclusive',
      'capacity',
      'skillTags',
      'bookableOnline',
      'isActive',
      'propertyIds',
    ] as const) {
      expect(parsed[key], `${key} must stay absent on a partial update`).toBeUndefined();
    }
  });

  it('reproduces the bug when the overrides are removed', () => {
    // The schema exactly as it shipped before the fix — plain `.partial()`.
    const Before = CreateResourceInput.partial().extend({ id: z.string().uuid() });
    const parsed = Before.parse({ id: ID, name: 'Chair 1' });
    expect(parsed.timezone).toBe('UTC');
    expect(parsed.capacity).toBe(1);
    expect(parsed.skillTags).toEqual([]);
    expect(parsed.propertyIds).toEqual([]);
  });

  it('still carries an explicitly-sent site scope', () => {
    expect(UpdateResourceInput.parse({ id: ID, propertyIds: [SITE] }).propertyIds).toEqual([SITE]);
  });

  it('treats an explicit empty list as "every site", distinct from omitted', () => {
    expect(UpdateResourceInput.parse({ id: ID, propertyIds: [] }).propertyIds).toEqual([]);
  });
});

describe('CreateResourceInput', () => {
  it('defaults a new resource to every site', () => {
    expect(CreateResourceInput.parse({ kind: 'staff', name: 'Sam' }).propertyIds).toEqual([]);
  });

  it('accepts a scoped resource', () => {
    expect(
      CreateResourceInput.parse({ kind: 'staff', name: 'Sam', propertyIds: [SITE] }).propertyIds
    ).toEqual([SITE]);
  });
});
