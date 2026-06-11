// Automation fan-in tee (docs/82 §3.3).
//
// Every publish path (api-core `publish`, the @sparx/events publisher, and the
// CRM pubsub-bridge's two bus wrappers) tees a copy of each event onto ONE topic
// — `automation.trigger` — after its normal per-type publish. The automation
// engine's worker is the SOLE subscriber: one firehose + one push subscription is
// cheaper and more additive than N per-type subscriptions or a (non-existent)
// wildcard, and the per-type topics stay for targeted consumers (indexer,
// webhooks, email/push workers).
//
// The fan-in message is the unchanged `SparxEvent` envelope. The original event
// type travels as a message attribute so the single subscriber routes without N
// topics, and `data.__automationDepth` (if a cascade emitter stamped it) rides
// along untouched for the engine's loop-guard (docs/81 §7) — handleTrigger reads
// it from the envelope, defaulting to 0.

import type { Topic } from '@google-cloud/pubsub';

/** The single fan-in topic. NOT an `EventType` — a meta-topic carrying every
 *  event. Provisioned in terraform/envs/prod/main.tf; the automation-worker's
 *  push subscription lives in automation.tf. */
export const AUTOMATION_FANIN_TOPIC = 'automation.trigger';

/** The loosely-typed envelope shape the tee accepts — a real `SparxEvent` (whose
 *  `type` is the closed `EventType`) plus the CRM bridge's `crm.*` / `order.*`
 *  envelopes (whose `type` is a plain string not yet in the canonical union). */
export interface FanInEnvelope {
  type: string;
  tenantId: string;
  actorId: string | null;
  occurredAt: string;
  data: unknown;
}

/** Read the loop-guard depth an emitter may have stamped onto the envelope's
 *  data. Absent (external events) ⇒ 0. */
function readDepth(data: unknown): number {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const d = (data as Record<string, unknown>).__automationDepth;
    if (typeof d === 'number' && Number.isFinite(d)) return d;
  }
  return 0;
}

/**
 * Tee one already-published event onto the automation fan-in. Best-effort by
 * contract: the CALLER swallows errors so a fan-in hiccup never fails the
 * per-type publish that preceded it (events are published post-commit — the
 * originating mutation is already durable).
 */
export async function teeToFanIn(fanInTopic: Topic, event: FanInEnvelope): Promise<void> {
  await fanInTopic.publishMessage({
    data: Buffer.from(JSON.stringify(event)),
    attributes: {
      type: event.type,
      tenantId: event.tenantId,
      __automationDepth: String(readDepth(event.data)),
    },
  });
}
