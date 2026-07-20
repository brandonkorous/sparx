// opLogService — the append-only op log (docs/126 §2, Phase 2).
//
// silicaui 0.30's `<Builder onChange(site, ops, meta)>` hands the host what the author
// DID as causal-ordered semantic operations. This service records them, assigning each
// a per-property monotonic sequence — the value a client `ackSeq()`s and, once the
// realtime relay lands (Phase 4), reconnects against.
//
// TWO invariants:
//   · ADDITIVE. Appending rides the SAME transaction as the snapshot write in
//     `siteService.sync`, so a rolled-back save leaves no orphan ops and the log can
//     never claim an edit the snapshot doesn't have.
//   · IDEMPOTENT PER BATCH. A retried flush (same `batchId`) is a no-op that returns the
//     sequence the first attempt reached — so a network retry never double-appends.
//
// It does NOT yet drive reads: `silica_draft_tree` remains the authoritative snapshot
// (docs/126 §5.5). Replaying ops onto a snapshot is a later cutover, not folded in here.

import type { BuilderOpEnvelope } from '@sparx/builder-schemas';
import type { Prisma, TxClient } from '@sparx/db';

import type { PropertyContext } from '../errors';

/** `op.target` → the (owner_kind, owner_id) the log is keyed on. `frame`/`site` are
 *  singletons per property and carry no id. */
function ownerOf(target: BuilderOpEnvelope['target']): {
  ownerKind: string;
  ownerId: string | null;
} {
  switch (target.scope) {
    case 'page':
      return { ownerKind: 'page', ownerId: target.id };
    case 'symbol':
      return { ownerKind: 'symbol', ownerId: target.id };
    case 'frame':
      return { ownerKind: 'frame', ownerId: null };
    case 'site':
      return { ownerKind: 'site', ownerId: null };
  }
}

/** The outcome of an append — the client acks `newSeq` so its `baseSeq` advances to
 *  what the server assigned. `alreadyApplied` marks an idempotent retry (the batch was
 *  already recorded), so the caller knows not to treat an unchanged high-water mark as
 *  a lost write. */
export interface AppendResult {
  newSeq: number;
  appended: number;
  alreadyApplied: boolean;
}

/**
 * Append a batch of ops to the property's log, inside the caller's transaction.
 *
 * `baseSeq` is what the client believed the high-water mark was. We do NOT reject on a
 * stale baseSeq here — the snapshot path already carries the `pageUpdatedAt` optimistic
 * lock (docs/126 Phase 1), and reconciling a behind client by replaying the ops it
 * missed is Phase 4's job, not this one. Phase 2 records faithfully and reports the new
 * high-water mark; it is the durable substrate the relay will read, not the relay.
 */
export async function appendOpsTx(
  tx: TxClient,
  ctx: PropertyContext,
  ops: readonly BuilderOpEnvelope[],
  batchId: string,
  _baseSeq: number
): Promise<AppendResult> {
  // Idempotent retry: a batch already recorded returns the sequence it reached rather
  // than appending a second copy. The unique (property, seq) index would catch a true
  // double-append, but checking the batch up front avoids the wasted INSERT + retry and
  // gives the caller a clean `alreadyApplied` signal.
  const existing = await tx.builderPageOp.findFirst({
    where: { propertyId: ctx.propertyId, batchId },
    orderBy: { seq: 'desc' },
    select: { seq: true },
  });
  if (existing) {
    return { newSeq: Number(existing.seq), appended: 0, alreadyApplied: true };
  }

  // The current high-water mark. A fresh property has none → 0, so the first op is seq 1.
  const top = await tx.builderPageOp.aggregate({
    where: { propertyId: ctx.propertyId },
    _max: { seq: true },
  });
  let seq = top._max.seq ? Number(top._max.seq) : 0;

  if (ops.length === 0) {
    // A flush can carry a snapshot change with no ops (a legacy/MCP path), or nothing.
    // Nothing to record; report the unchanged mark.
    return { newSeq: seq, appended: 0, alreadyApplied: false };
  }

  const rows = ops.map((op) => {
    const { ownerKind, ownerId } = ownerOf(op.target);
    seq += 1;
    return {
      tenantId: ctx.tenantId,
      propertyId: ctx.propertyId,
      seq: BigInt(seq),
      batchId,
      actorId: ctx.userId ?? null,
      ownerKind,
      ownerId,
      opKind: op.kind,
      op: op as unknown as Prisma.InputJsonValue,
    };
  });
  await tx.builderPageOp.createMany({ data: rows });
  return { newSeq: seq, appended: rows.length, alreadyApplied: false };
}

/** The property's current high-water sequence — what a freshly-connecting client asks
 *  for to know where the log stands. Read-only. */
export async function currentSeq(ctx: PropertyContext, tx: TxClient): Promise<number> {
  const top = await tx.builderPageOp.aggregate({
    where: { propertyId: ctx.propertyId },
    _max: { seq: true },
  });
  return top._max.seq ? Number(top._max.seq) : 0;
}

/** One recorded op, as a history reader sees it. */
export interface OpLogEntry {
  seq: number;
  batchId: string;
  actorId: string | null;
  ownerKind: string;
  ownerId: string | null;
  opKind: string;
  op: unknown;
  createdAt: string;
}

/**
 * Ops after a given sequence, in order — the reconnect-catch-up read (Phase 4) and the
 * per-owner history read.
 *
 * `sinceSeq` is EXCLUSIVE: pass the client's `baseSeq` to get exactly what it missed.
 * `owner` narrows to one tree's history; omit it for the whole property stream.
 */
export async function opsSince(
  tx: TxClient,
  ctx: PropertyContext,
  sinceSeq: number,
  owner?: { ownerKind: string; ownerId: string | null },
  limit = 1000
): Promise<OpLogEntry[]> {
  const rows = await tx.builderPageOp.findMany({
    where: {
      propertyId: ctx.propertyId,
      seq: { gt: BigInt(sinceSeq) },
      ...(owner ? { ownerKind: owner.ownerKind, ownerId: owner.ownerId } : {}),
    },
    orderBy: { seq: 'asc' },
    take: Math.min(Math.max(limit, 1), 5000),
    select: {
      seq: true,
      batchId: true,
      actorId: true,
      ownerKind: true,
      ownerId: true,
      opKind: true,
      op: true,
      createdAt: true,
    },
  });
  return rows.map((r) => ({
    seq: Number(r.seq),
    batchId: r.batchId,
    actorId: r.actorId,
    ownerKind: r.ownerKind,
    ownerId: r.ownerId,
    opKind: r.opKind,
    op: r.op,
    createdAt: r.createdAt.toISOString(),
  }));
}
