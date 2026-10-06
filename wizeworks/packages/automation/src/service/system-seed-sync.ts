// How a platform re-sync treats a seeded (system) automation a business may have
// changed.
//
// A system automation is installed into the tenant as a real row, and most of them
// are NOT locked: the business can reword the description, change the trigger, add a
// condition, rename it, or pause it. The re-sync (module activation, the daily
// reconcile, the release) used to overwrite all of that with the stock rule: a paused
// "Welcome new customers" was switched back on every day, an edited one was put
// back, and a renamed one was not found at all, so a second copy was installed
// beside it and both ran.
//
// The rules here, in order:
//   1. A LOCKED seed is the platform's. The business cannot edit it, so the
//      platform's version always wins, status included.
//   2. A rule whose live document already equals the platform's is in sync.
//   3. A rule whose live document still equals what the platform LAST SEEDED is
//      untouched, so the platform's newer version replaces it. This is how a fix to
//      a seed reaches every business that never changed the rule.
//   4. Anything else is the business's own version. It is left exactly as they
//      published it, and the row records that a newer platform version exists.
// `status` on an existing unlocked row is never written: paused stays paused.
//
// "What the platform last seeded" is a fingerprint of the rule document stored on
// the row when the platform writes it (`seeded_fingerprint`), the same idea as the
// pristine-default fingerprints in builder's email-default-refresh: content, not a
// flag, decides whether a person has touched it.

import { createHash } from 'node:crypto';

/** The part of a rule the business authors and the platform seeds: everything the
 *  engine runs. The NAME is deliberately not in it. Renaming a seeded rule is a
 *  label change, and it must not cut that rule off from the platform's fixes. */
export interface SeedDocument {
  description: string | null;
  triggerType: string;
  triggerConfig: unknown;
  conditions: unknown;
  actions: unknown;
  goal: unknown;
  maxDepth: number;
}

/** Sort object keys and drop `undefined`, so a document hashes the same whether it
 *  came from a seed literal or back out of a jsonb column (which reorders keys). */
function canon(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v).sort()) {
      const child = (v as Record<string, unknown>)[k];
      if (child === undefined) continue;
      out[k] = canon(child);
    }
    return out;
  }
  return v;
}

/** sha256 of the canonical rule document. A JSON round trip first, so the value is
 *  exactly what Postgres would hand back (no `undefined`, no class instances). */
export function seedDocumentFingerprint(doc: SeedDocument): string {
  const plain = JSON.parse(
    JSON.stringify({
      description: doc.description ?? null,
      triggerType: doc.triggerType,
      triggerConfig: doc.triggerConfig ?? null,
      conditions: doc.conditions ?? null,
      actions: doc.actions ?? null,
      goal: doc.goal ?? null,
      maxDepth: doc.maxDepth,
    })
  ) as unknown;
  return createHash('sha256')
    .update(JSON.stringify(canon(plain)))
    .digest('hex');
}

/**
 * What the history says about a row seeded before fingerprints were stored.
 *
 * Such a row has no record of what the platform last wrote, so the evidence is its
 * version history instead. The seed path never bumps `version`; only a business
 * publishing an edit does.
 *  - `never-published`: version 1. Only the platform has ever written it.
 *  - `platform-overwrote`: the business published an edit, and a later re-sync
 *    overwrote it (the live document no longer matches their latest version). What
 *    is live is the platform's, so it is treated as untouched. Their edit is still
 *    in the version history, where they can restore it.
 *  - `tenant-version-live`: the business's latest published version is what runs.
 *  - `no-snapshot`: a published version with no snapshot to compare. Unknown, so it
 *    is treated as theirs: the cost of a wrong guess here is overwriting someone's
 *    work, which is the defect this module exists to stop.
 */
export type LegacySeedEvidence =
  'never-published' | 'platform-overwrote' | 'tenant-version-live' | 'no-snapshot';

export type SeedSyncOutcome =
  /** Write the platform's document onto the row. */
  | 'apply'
  /** The live document already equals the platform's. */
  | 'in-sync'
  /** The business changed it. Leave the document alone. */
  | 'tenant-owned';

export function decideSeedSync(input: {
  /** The seed is locked (from the SPEC: the platform's current intent). */
  locked: boolean;
  specFingerprint: string;
  liveFingerprint: string;
  /** What the platform last wrote to this row; null on a row seeded before
   *  fingerprints were stored. */
  seededFingerprint: string | null;
  /** Only read when `seededFingerprint` is null. */
  legacy?: LegacySeedEvidence;
}): SeedSyncOutcome {
  if (input.liveFingerprint === input.specFingerprint) return 'in-sync';
  if (input.locked) return 'apply';
  if (input.seededFingerprint !== null) {
    return input.liveFingerprint === input.seededFingerprint ? 'apply' : 'tenant-owned';
  }
  return input.legacy === 'never-published' || input.legacy === 'platform-overwrote'
    ? 'apply'
    : 'tenant-owned';
}

/**
 * The name the row should carry after a re-sync.
 *
 * A name that is the seed's current name or one it used to ship under is the
 * platform's label, so a platform rename carries onto it. Any other name is one the
 * business chose, and it stays. A locked rule cannot be renamed by the business, so
 * it always takes the platform's.
 */
export function syncedSeedName(input: {
  rowName: string;
  specName: string;
  previousNames?: readonly string[];
  locked: boolean;
}): string {
  if (input.locked) return input.specName;
  const platformNamed =
    input.rowName === input.specName || (input.previousNames ?? []).includes(input.rowName);
  return platformNamed ? input.specName : input.rowName;
}

/**
 * When the platform first had a newer version of this rule that was NOT applied
 * because the business had changed it; null when there is nothing pending.
 *
 * Pending means the platform's current document differs from the one it last seeded
 * onto this row. If the platform has not changed since, the business's edit is
 * simply theirs and there is nothing to tell them. The earliest time is kept, so a
 * second platform change does not reset how long one has been waiting.
 */
export function platformUpdatePendingSince(input: {
  outcome: SeedSyncOutcome;
  specFingerprint: string;
  seededFingerprint: string | null;
  current: Date | null;
  now: Date;
}): Date | null {
  if (input.outcome !== 'tenant-owned') return null;
  if (input.seededFingerprint === input.specFingerprint) return null;
  return input.current ?? input.now;
}

/**
 * The platform's newer document to keep on the row, or null.
 *
 * Kept exactly while a newer version is waiting (`platformUpdateAt` set), so the
 * API, which cannot load the seed catalog, can show it and switch the rule to it.
 * Every re-sync rewrites it, so it follows the platform's current version.
 */
export function pendingPlatformDocument(input: {
  platformUpdateAt: Date | null;
  specDocument: SeedDocument;
}): SeedDocument | null {
  return input.platformUpdateAt ? input.specDocument : null;
}

/** A stored platform document read back out of jsonb, or null when the value is
 *  missing or is not a whole rule document. */
export function readSeedDocument(value: unknown): SeedDocument | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.triggerType !== 'string' || v.triggerType === '') return null;
  if (typeof v.maxDepth !== 'number' || !Array.isArray(v.actions)) return null;
  if (v.description !== null && v.description !== undefined && typeof v.description !== 'string') {
    return null;
  }
  return {
    description: typeof v.description === 'string' ? v.description : null,
    triggerType: v.triggerType,
    triggerConfig: v.triggerConfig ?? {},
    conditions: v.conditions ?? { logic: 'AND', conditions: [] },
    actions: v.actions,
    goal: v.goal ?? null,
    maxDepth: v.maxDepth,
  };
}

/**
 * Why a rule cannot be switched to the platform's newer version right now.
 *
 *  - `not-seeded`: the business made this rule, so there is no platform version.
 *  - `up-to-date`: nothing is waiting (never was, or it was already taken).
 *  - `not-ready`: a newer version is flagged but its document has not been written
 *    yet (a row flagged before the document was stored, until the next re-sync).
 *  - `has-draft`: the business has unpublished changes. Switching publishes, and a
 *    draft left behind would put their old version back the moment they published
 *    it, so they publish or discard it first.
 */
export type PlatformVersionRefusal = 'not-seeded' | 'up-to-date' | 'not-ready' | 'has-draft';

export function platformVersionRefusal(row: {
  origin: string;
  systemKey: string | null;
  platformUpdateAt: Date | null;
  platformDocument: unknown;
  draft: unknown;
}): PlatformVersionRefusal | null {
  if (row.origin !== 'system' || !row.systemKey) return 'not-seeded';
  if (!row.platformUpdateAt) return 'up-to-date';
  if (!readSeedDocument(row.platformDocument)) return 'not-ready';
  if (row.draft !== null && row.draft !== undefined) return 'has-draft';
  return null;
}

/** The sentence each refusal answers with. Brand-neutral: both consoles show it. */
export const PLATFORM_VERSION_REFUSAL_MESSAGE: Readonly<Record<PlatformVersionRefusal, string>> = {
  'not-seeded':
    'This automation was not set up for you, so there is no newer version of it to switch to.',
  'up-to-date': 'There is no newer version of this automation to switch to.',
  'not-ready':
    'The newer version of this automation is still being prepared. It will be ready to switch to within a day.',
  'has-draft':
    'This automation has unpublished changes. Publish or discard them first, then switch to the newer version.',
};
