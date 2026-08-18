// Guard for a whole class of silent data loss: a PATCH schema that fabricates
// values the caller never sent.
//
// `.partial()` makes a field optional but does NOT strip its `.default()`, so
// `CreateX.partial().parse({})` returns every defaulted field filled in. Every
// update service writes the fields that are `!== undefined` — so a one-field
// PATCH quietly overwrote everything that had a create-default. Real damage this
// caught: editing a customer's phone number cleared `doNotContact` and wiped
// their tags; renaming a B2B account zeroed its credit limit and reactivated it;
// renaming a pipeline demoted it from default.
//
// The test is deliberately GENERIC — it walks every exported `Update*Input` in
// the package rather than naming them, so a schema added tomorrow is covered
// without anyone remembering this file exists.

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import * as schemas from './index';

// Patch schemas that legitimately REQUIRE a field, so `{}` doesn't parse. They
// can't fabricate anything (parsing failed), and listing them here keeps the
// exemption visible: a new name showing up in this list is a prompt to check
// whether it really is required, not a place to silence a failure.
const REQUIRES_A_FIELD = new Set(['UpdateFulfillmentInput']);

function patchSchemas(): [string, z.ZodType][] {
  // Widened to `unknown` before filtering: the barrel exports helpers as well as
  // schemas, so `Object.entries` types each value as a union that includes a plain
  // function — and a type predicate is only legal when its type is assignable to
  // the parameter's. `unknown` is what the `instanceof` check below actually
  // assumes, so saying so is honest rather than a cast around a real mismatch.
  const entries = Object.entries(schemas) as [string, unknown][];
  return entries
    .filter(
      (entry): entry is [string, z.ZodType] =>
        /^Update[A-Za-z0-9]*Input$/.test(entry[0]) && entry[1] instanceof z.ZodType
    )
    .sort((a, b) => a[0].localeCompare(b[0]));
}

describe('patch schemas never fabricate values', () => {
  it('finds the patch schemas to check', () => {
    // Sanity: if the export naming convention changes, this suite would silently
    // pass by checking nothing.
    expect(patchSchemas().length).toBeGreaterThan(10);
  });

  it.each(patchSchemas())('%s parses {} into {}', (name, schema) => {
    const result = schema.safeParse({});

    if (!result.success) {
      expect(
        REQUIRES_A_FIELD.has(name),
        `${name} rejects an empty patch. If that is intended, add it to REQUIRES_A_FIELD.`
      ).toBe(true);
      return;
    }

    expect(REQUIRES_A_FIELD.has(name), `${name} accepts {} — drop it from REQUIRES_A_FIELD.`).toBe(
      false
    );
    // The assertion that matters: an empty patch must stay empty. A key here is a
    // value the service would write over the record.
    expect(Object.keys(result.data as Record<string, unknown>)).toEqual([]);
  });
});

describe('TagListPatch', () => {
  it('keeps TagList validation but drops the default', () => {
    expect(schemas.TagList.parse(undefined)).toEqual([]);
    expect(schemas.TagListPatch.safeParse(undefined).success).toBe(false);
    expect(schemas.TagListPatch.parse(['vip', 'net-30'])).toEqual(['vip', 'net-30']);
    expect(schemas.TagListPatch.safeParse(['not a tag']).success).toBe(false);
  });
});

describe('the specific losses that prompted this guard', () => {
  it('a customer rename does not clear consent, stage, or tags', () => {
    const patch = schemas.UpdateCustomerInput.parse({ firstName: 'Dana' });
    expect(patch).toEqual({ firstName: 'Dana' });
  });

  it('a deal rename does not zero its value or tags', () => {
    const patch = schemas.UpdateDealInput.parse({ title: 'Renamed' });
    expect(patch).toEqual({ title: 'Renamed' });
  });

  it('a B2B account note does not reset credit limit or status', () => {
    const patch = schemas.UpdateCompanyInput.parse({ notes: 'Called Tuesday' });
    expect(patch).toEqual({ notes: 'Called Tuesday' });
  });

  it('still lets a caller set a defaulted field explicitly', () => {
    expect(schemas.UpdateCustomerInput.parse({ doNotContact: true })).toEqual({
      doNotContact: true,
    });
    expect(schemas.UpdateDealInput.parse({ value: 0 })).toEqual({ value: 0 });
  });
});
