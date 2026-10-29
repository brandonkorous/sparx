// Better Auth 1.7 compares its tables with the Prisma schema before its first
// database call, and refuses to run when a column it never writes is required
// with no default: every request that touches auth then throws. That took down
// both Piggles sign-in apps the moment 1.7 shipped (jwks.platformBrand,
// tenant.email). This runs the SAME check on the real configuration, against the
// generated client's data model, so a new required column fails here and not
// in production. No database is reached.

import { describe, expect, it } from 'vitest';

import { auth } from './server';

describe('Better Auth schema check', () => {
  it('finds nothing in the Prisma schema that would block an insert', async () => {
    const ctx = (await auth.$context) as { explicitSchemaCheck?: () => Promise<void> | void };
    expect(ctx.explicitSchemaCheck).toBeTypeOf('function');
    await expect(Promise.resolve(ctx.explicitSchemaCheck?.())).resolves.toBeUndefined();
  });

  it('keeps the organization on the tenant table, logo and metadata renamed', async () => {
    // auth-owned-columns.ts adds a field to `organization`; the merge takes the
    // last plugin's model name, so a slip there would point it at a table that
    // does not exist.
    const { tables } = (await auth.$context) as {
      tables: Record<string, { modelName: string; fields: Record<string, { fieldName?: string }> }>;
    };
    expect(tables.organization?.modelName).toBe('tenant');
    expect(tables.organization?.fields.logo?.fieldName).toBe('orgLogo');
    expect(tables.organization?.fields.metadata?.fieldName).toBe('orgMetadata');
    expect(tables.jwks?.modelName).toBe('jwks');
  });
});
