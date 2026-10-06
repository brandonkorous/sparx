// Taking the platform's newer version of a seeded rule: the decisions, without a
// database. The integration suite (`take-platform-version.test.ts`) proves the
// service wiring; these pin when the switch is allowed and what it reads.

import { describe, expect, it } from 'vitest';

import {
  pendingPlatformDocument,
  PLATFORM_VERSION_REFUSAL_MESSAGE,
  platformVersionRefusal,
  readSeedDocument,
  type SeedDocument,
  seedDocumentFingerprint,
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

/** A seeded row with a newer version waiting and nothing in the way. */
const waiting = {
  origin: 'system',
  systemKey: 'crm.welcome-new-customers',
  platformUpdateAt: new Date('2026-10-01T00:00:00Z'),
  platformDocument: doc() as unknown,
  draft: null as unknown,
};

describe('pendingPlatformDocument', () => {
  it('keeps the platform document exactly while a newer version is waiting', () => {
    const spec = doc({ description: 'Newer' });
    expect(pendingPlatformDocument({ platformUpdateAt: new Date(), specDocument: spec })).toBe(
      spec
    );
  });

  it('keeps nothing when nothing is waiting', () => {
    expect(pendingPlatformDocument({ platformUpdateAt: null, specDocument: doc() })).toBeNull();
  });
});

describe('readSeedDocument', () => {
  it('reads a stored document back to the same rule', () => {
    const stored = JSON.parse(JSON.stringify(doc())) as unknown;
    const read = readSeedDocument(stored);
    expect(read).not.toBeNull();
    expect(seedDocumentFingerprint(read!)).toBe(seedDocumentFingerprint(doc()));
  });

  it('reads a missing goal and description as none, the way the row stores them', () => {
    const { goal: _goal, description: _description, ...rest } = doc();
    const read = readSeedDocument(rest);
    expect(read?.goal).toBeNull();
    expect(read?.description).toBeNull();
  });

  it('refuses anything that is not a whole rule', () => {
    expect(readSeedDocument(null)).toBeNull();
    expect(readSeedDocument([])).toBeNull();
    expect(readSeedDocument('a rule')).toBeNull();
    expect(readSeedDocument({ ...doc(), triggerType: '' })).toBeNull();
    expect(readSeedDocument({ ...doc(), actions: 'tag them' })).toBeNull();
    expect(readSeedDocument({ ...doc(), maxDepth: '3' })).toBeNull();
    expect(readSeedDocument({ ...doc(), description: 7 })).toBeNull();
  });
});

describe('platformVersionRefusal', () => {
  it('allows the switch when a newer version is waiting and nothing is in the way', () => {
    expect(platformVersionRefusal(waiting)).toBeNull();
  });

  it('refuses a rule the business made, even one copied from a seeded rule', () => {
    expect(platformVersionRefusal({ ...waiting, origin: 'user', systemKey: null })).toBe(
      'not-seeded'
    );
    expect(platformVersionRefusal({ ...waiting, systemKey: null })).toBe('not-seeded');
  });

  it('refuses when nothing is waiting, including after it was already taken', () => {
    expect(
      platformVersionRefusal({ ...waiting, platformUpdateAt: null, platformDocument: null })
    ).toBe('up-to-date');
  });

  it('says "not ready" for a flagged row whose document has not been written yet', () => {
    expect(platformVersionRefusal({ ...waiting, platformDocument: null })).toBe('not-ready');
  });

  it('asks for unpublished changes to be published or discarded first', () => {
    expect(platformVersionRefusal({ ...waiting, draft: { name: 'x' } })).toBe('has-draft');
  });

  it('answers every refusal with a sentence that never names a brand', () => {
    for (const sentence of Object.values(PLATFORM_VERSION_REFUSAL_MESSAGE)) {
      expect(sentence).not.toMatch(/sparx|piggles/i);
      expect(sentence).toMatch(/\.$/);
    }
  });
});
