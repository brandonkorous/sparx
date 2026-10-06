// The re-sync rules for a seeded automation a business may have changed. The
// service applies these against a real row; the integration suite proves the
// wiring. These pin the decisions themselves.

import { describe, expect, it } from 'vitest';

import {
  decideSeedSync,
  platformUpdatePendingSince,
  type SeedDocument,
  seedDocumentFingerprint,
  syncedSeedName,
} from '../../src/service/system-seed-sync';

const doc = (over: Partial<SeedDocument> = {}): SeedDocument => ({
  description: 'Say hello',
  triggerType: 'customer.created',
  triggerConfig: { eventType: 'customer.created' },
  conditions: { logic: 'AND', conditions: [] },
  actions: [{ type: 'crm.add_tag', config: { tag: 'new' } }],
  goal: null,
  maxDepth: 3,
  ...over,
});

const SEEDED = seedDocumentFingerprint(doc());
const NEWER = seedDocumentFingerprint(doc({ description: 'Say hello, better' }));
const EDITED = seedDocumentFingerprint(doc({ description: 'Our own words' }));

describe('seedDocumentFingerprint', () => {
  it('ignores key order, the way a jsonb column hands a document back', () => {
    const reordered = doc({
      triggerConfig: { eventType: 'customer.created' },
      conditions: { conditions: [], logic: 'AND' },
      actions: [{ config: { tag: 'new' }, type: 'crm.add_tag' }],
    });
    expect(seedDocumentFingerprint(reordered)).toBe(SEEDED);
  });

  it('treats a missing goal and a null goal as the same document', () => {
    expect(seedDocumentFingerprint(doc({ goal: undefined }))).toBe(SEEDED);
  });

  it('changes when anything the engine runs changes', () => {
    expect(seedDocumentFingerprint(doc({ maxDepth: 4 }))).not.toBe(SEEDED);
    expect(seedDocumentFingerprint(doc({ conditions: { logic: 'OR', conditions: [] } }))).not.toBe(
      SEEDED
    );
    expect(seedDocumentFingerprint(doc({ actions: [] }))).not.toBe(SEEDED);
  });
});

describe('decideSeedSync', () => {
  it('an untouched copy takes the platform version', () => {
    expect(
      decideSeedSync({
        locked: false,
        specFingerprint: NEWER,
        liveFingerprint: SEEDED,
        seededFingerprint: SEEDED,
      })
    ).toBe('apply');
  });

  it('an edited copy is left alone', () => {
    expect(
      decideSeedSync({
        locked: false,
        specFingerprint: NEWER,
        liveFingerprint: EDITED,
        seededFingerprint: SEEDED,
      })
    ).toBe('tenant-owned');
  });

  it('a copy that already matches the platform is in sync, whoever wrote it', () => {
    expect(
      decideSeedSync({
        locked: false,
        specFingerprint: NEWER,
        liveFingerprint: NEWER,
        seededFingerprint: SEEDED,
      })
    ).toBe('in-sync');
  });

  it('a locked seed always takes the platform version', () => {
    expect(
      decideSeedSync({
        locked: true,
        specFingerprint: NEWER,
        liveFingerprint: EDITED,
        seededFingerprint: SEEDED,
      })
    ).toBe('apply');
  });

  describe('a row seeded before fingerprints existed', () => {
    const legacy = (evidence: Parameters<typeof decideSeedSync>[0]['legacy']) =>
      decideSeedSync({
        locked: false,
        specFingerprint: NEWER,
        liveFingerprint: EDITED,
        seededFingerprint: null,
        legacy: evidence,
      });

    it('never published by the business: the platform wrote it, so it updates', () => {
      expect(legacy('never-published')).toBe('apply');
    });

    it('a re-sync already put the stock rule back over their edit: still platform', () => {
      expect(legacy('platform-overwrote')).toBe('apply');
    });

    it('their published version is what runs: theirs', () => {
      expect(legacy('tenant-version-live')).toBe('tenant-owned');
    });

    it('no evidence either way: theirs, because a wrong guess overwrites their work', () => {
      expect(legacy('no-snapshot')).toBe('tenant-owned');
      expect(legacy(undefined)).toBe('tenant-owned');
    });
  });
});

describe('syncedSeedName', () => {
  const base = { specName: 'Welcome new customers', previousNames: ['Welcome customers'] };

  it('carries a platform rename onto a row still wearing a platform name', () => {
    expect(syncedSeedName({ ...base, rowName: 'Welcome customers', locked: false })).toBe(
      'Welcome new customers'
    );
  });

  it('keeps a name the business chose', () => {
    expect(syncedSeedName({ ...base, rowName: 'Say hi', locked: false })).toBe('Say hi');
  });

  it('a locked rule always wears the platform name', () => {
    expect(syncedSeedName({ ...base, rowName: 'Say hi', locked: true })).toBe(
      'Welcome new customers'
    );
  });
});

describe('platformUpdatePendingSince', () => {
  const now = new Date('2026-10-03T12:00:00Z');
  const earlier = new Date('2026-09-01T12:00:00Z');

  it('flags an edited copy whose platform version moved on', () => {
    expect(
      platformUpdatePendingSince({
        outcome: 'tenant-owned',
        specFingerprint: NEWER,
        seededFingerprint: SEEDED,
        current: null,
        now,
      })
    ).toEqual(now);
  });

  it('keeps the first time it was flagged', () => {
    expect(
      platformUpdatePendingSince({
        outcome: 'tenant-owned',
        specFingerprint: NEWER,
        seededFingerprint: SEEDED,
        current: earlier,
        now,
      })
    ).toEqual(earlier);
  });

  it('says nothing when the platform has not changed since it seeded the row', () => {
    expect(
      platformUpdatePendingSince({
        outcome: 'tenant-owned',
        specFingerprint: SEEDED,
        seededFingerprint: SEEDED,
        current: earlier,
        now,
      })
    ).toBeNull();
  });

  it('clears once the platform version is what runs', () => {
    expect(
      platformUpdatePendingSince({
        outcome: 'apply',
        specFingerprint: NEWER,
        seededFingerprint: SEEDED,
        current: earlier,
        now,
      })
    ).toBeNull();
  });
});
