// Better Auth 1.7 compares its tables with the Prisma schema before its first
// database call and refuses every request on a mismatch. The staff instance
// shipped with one (@wizeworks/auth schema-check.test.ts); this runs the SAME
// check on the shopper instance's real configuration. No database is reached.

import { describe, expect, it } from 'vitest';

import { getCustomerAuth } from './server';

describe('Better Auth schema check (shoppers)', () => {
  it('finds nothing in the Prisma schema that would block an insert', async () => {
    const ctx = (await getCustomerAuth().$context) as {
      explicitSchemaCheck?: () => Promise<void> | void;
    };
    expect(ctx.explicitSchemaCheck).toBeTypeOf('function');
    await expect(Promise.resolve(ctx.explicitSchemaCheck?.())).resolves.toBeUndefined();
  });
});
