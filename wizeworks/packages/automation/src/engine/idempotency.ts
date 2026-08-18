// Idempotency key derivation (docs/81 §7).
//
// Pub/Sub is at-least-once, so a redelivered message must collapse onto the same
// `automation_runs` row. The UNIQUE is `(automation_id, dedupe_key)`, so the key
// only has to identify the *event* — `handleTrigger` upserts once per matched
// automation. A redelivered message is byte-identical, so a stable hash of the
// envelope is a sufficient key.
//
// Scheduled triggers synthesize an envelope per matched row; those carry an
// explicit `__dedupe` (automation + entity + schedule-window) so re-running the
// daily tick can't double-fire. When present it wins over the content hash.

import { createHash } from 'node:crypto';

import type { TriggerEnvelope } from '../engine-types';

export function dedupeOf(envelope: TriggerEnvelope): string {
  const data = envelope.data as Record<string, unknown> | null | undefined;
  const explicit = data && typeof data.__dedupe === 'string' ? data.__dedupe : null;
  if (explicit) return explicit.slice(0, 200);

  const canonical = stableStringify({
    type: envelope.type,
    tenantId: envelope.tenantId,
    actorId: envelope.actorId,
    occurredAt: envelope.occurredAt,
    data: envelope.data,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

/** Deterministic JSON with sorted object keys, so logically-equal envelopes hash equal. */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return Object.keys(val as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (val as Record<string, unknown>)[k];
          return acc;
        }, {});
    }
    return val as unknown;
  });
}
