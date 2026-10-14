// A record type may have no extra details (sparx persona issue 241).
//
// The shared field rule needs at least one field, which is right for a CMS
// content type. A record type starts with none: the form says so, the service
// defaults to an empty list, and a record with no details has its own state.
// Saving "Review copy" with no details came back "The problem is with Fields".

import { describe, expect, it } from 'vitest';

import { CreateObjectDefInput, UpdateObjectDefInput } from './object-defs';

describe('a record type with no extra details', () => {
  it('can be made', () => {
    const made = CreateObjectDefInput.safeParse({
      key: 'reviewcopy',
      label: 'Review copy',
      labelPlural: 'Review copies',
      propertySchema: { fields: [] },
    });
    expect(made.success).toBe(true);
  });

  it('can have its last detail removed', () => {
    expect(UpdateObjectDefInput.safeParse({ propertySchema: { fields: [] } }).success).toBe(true);
  });

  it('still checks each detail it does have', () => {
    const bad = UpdateObjectDefInput.safeParse({
      propertySchema: { fields: [{ key: '', label: '', type: 'text' }] },
    });
    expect(bad.success).toBe(false);
  });
});
