import { describe, expect, it, vi } from 'vitest';

/**
 * A connection that is not there is a 404 (persona issue 226).
 *
 * `getInstallation` returned null for an id that was not this business's, the
 * route sent that back as a 200, and the console's integration pane waited for
 * ever on data that was never coming: "Just a moment…" for a minute and more.
 */

let row: Record<string, unknown> | null = null;

vi.mock('@wizeworks/db', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (tx: unknown) => unknown) =>
    Promise.resolve(fn({ providerInstallation: { findFirst: () => Promise.resolve(row) } })),
}));

const { getInstallation } = await import('./provider-service');
const { CommerceNotFoundError } = await import('../errors');

describe('getInstallation', () => {
  it('throws not found for an id that is not here', async () => {
    row = null;
    await expect(
      getInstallation({ tenantId: 't-juniper' }, '00000000-0000-4000-8000-000000000000')
    ).rejects.toBeInstanceOf(CommerceNotFoundError);
  });
});
