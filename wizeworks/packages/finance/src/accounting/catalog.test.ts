// What the accounting screen can offer, on an installation with no QuickBooks or
// Xero app registered (this test's environment, and every local one).
//
// The FILE for every destination is built in export.ts and the export route
// makes it on request. The catalog still registered QuickBooks Desktop and Sage
// 50 as "a one-click layout is not ready yet", and the console's picker offered
// only `available` entries, so a business could download one layout,
// Spreadsheet, while being told six times that the export "already imports"
// into packages it could not choose (Piggles persona issue 938).

import { describe, expect, it, vi } from 'vitest';

vi.mock('@wizeworks/db', () => ({ withTenant: vi.fn(), prisma: {} }));

const { accountingCatalog, assertProviderKnown } = await import('./connections');

const byProvider = new Map(accountingCatalog().map((entry) => [entry.provider, entry]));

describe('the accounting catalog', () => {
  it('has a file layout for every destination it lists', () => {
    for (const entry of byProvider.values()) {
      expect(entry.exportColumns.length, entry.provider).toBeGreaterThan(0);
    }
  });

  it('offers the file-only layouts as ready', () => {
    expect(byProvider.get('quickbooks_desktop')?.availability).toBe('available');
    expect(byProvider.get('sage50')?.availability).toBe('available');
  });

  it('points a sync that is not switched on at the layout that works', () => {
    for (const entry of byProvider.values()) {
      if (entry.availability === 'available') continue;
      expect(entry.unavailableReason, entry.provider).toContain('under Laid out for');
    }
  });

  it('keeps account codes for a layout whose sync is not switched on', () => {
    expect(() => assertProviderKnown('xero')).not.toThrow();
    expect(() => assertProviderKnown('freshbooks')).not.toThrow();
  });
});
