// callService — placing calls and recording what happened (docs/144 §5.6).
//
// THE PROBLEM THIS SOLVES is not "dialling from a browser". It is that phone
// calls are the highest-signal thing in most sales relationships and the least
// likely to be written down, because logging one means opening a screen after
// the conversation is already over. When the platform places the call it
// already knows who, when and how long — so the only thing left for a person to
// add is what was said, and that is a sentence rather than a form.
//
// THREE THINGS HERE ARE EASY TO GET WRONG:
//
//  1. A CALL THAT WAS PLACED IS NOT A CALL THAT HAPPENED. It can ring out, hit
//     voicemail, or fail at the carrier, and those states arrive minutes later
//     over a webhook. So the timeline entry is written when the call REACHES A
//     TERMINAL STATE, never when it is placed — otherwise a record shows a
//     conversation that never started.
//
//  2. WEBHOOKS ARRIVE MORE THAN ONCE. Providers retry aggressively and
//     duplicate delivery is normal rather than an error. Dedupe is on the
//     provider's call id with a unique index, so a re-delivery updates the row
//     it belongs to instead of creating a second call that never happened.
//
//  3. THE PROVIDER'S OUTCOME IS A GUESS. It is inferred from a status code and
//     a duration, and a six-second "completed" call is a voicemail greeting
//     about as often as it is a very short conversation. A person can always
//     overrule it.
//
// This service does no crypto and holds no vendor credentials — it takes an
// already-resolved caller, the same split every other credential-bearing
// service in this package uses.

import { PlaceCallInput, UpdateCallInput, type CallOutcome } from '@wizeworks/crm-schemas';
import { withTenant } from '@wizeworks/db';
import type { CallRecord, Prisma } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { publishCrmEvent } from '../events';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError, CrmValidationError } from '../errors';

/**
 * How a call is actually placed.
 *
 * Injected rather than imported, exactly as the outbound-mail sink is: this
 * package has no transport dependency, so it unit-tests without standing a
 * vendor up, and the delivery path can change without a service rewrite.
 */
export interface CallPlacer {
  place(params: {
    tenantId: string;
    /**
     * The site the customer belongs to, so the phone system used is the one
     * THAT site connected — falling back to the tenant-wide one when it has
     * none of its own. Null for a customer that is not site-scoped.
     *
     * A tenant running two unrelated businesses has two numbers, and dialling a
     * customer of one from the other's number is a call they will not recognise
     * and may not answer.
     */
    propertyId: string | null;
    to: string;
    from: string;
    bridgeTo: string;
  }): Promise<{
    success: boolean;
    providerCallId?: string;
    provider?: string;
    errorMessage?: string;
  }>;
}

/** The default refuses rather than pretending. A tenant with no phone system
 *  connected should be told to connect one, not left wondering why nothing
 *  rang. */
class UnconfiguredCallPlacer implements CallPlacer {
  place(): Promise<{ success: boolean; errorMessage: string }> {
    return Promise.resolve({
      success: false,
      errorMessage: 'No phone system is connected yet.',
    });
  }
}

let activePlacer: CallPlacer = new UnconfiguredCallPlacer();

export function setCallPlacer(placer: CallPlacer): void {
  activePlacer = placer;
}

/** Records what it was asked to dial, for tests. */
export class RecordingCallPlacer implements CallPlacer {
  readonly placed: {
    to: string;
    from: string;
    bridgeTo: string;
    propertyId: string | null;
  }[] = [];
  private sequence = 0;

  constructor(private readonly result: { success: boolean } = { success: true }) {}

  place(params: {
    to: string;
    from: string;
    bridgeTo: string;
    propertyId: string | null;
  }): Promise<{
    success: boolean;
    providerCallId?: string;
    provider?: string;
  }> {
    this.placed.push({
      to: params.to,
      from: params.from,
      bridgeTo: params.bridgeTo,
      propertyId: params.propertyId,
    });
    this.sequence += 1;
    return Promise.resolve({
      ...this.result,
      // A FRESH id per call, because a real provider mints one and
      // `crm_calls_provider_id_unique` enforces it. A fake that reused one id
      // would make the second call in any test collide — and, worse, would let
      // a genuine dedupe bug pass unnoticed by never exercising the index.
      // Randomized rather than counted so two placers in one suite cannot clash.
      ...(this.result.success
        ? {
            providerCallId: `test-${Math.random().toString(36).slice(2, 10)}-${String(this.sequence)}`,
          }
        : {}),
      provider: 'test',
    });
  }

  clear(): void {
    this.placed.length = 0;
  }
}

/* ── Reads ──────────────────────────────────────────────────────────────── */

export async function listFor(
  ctx: ServiceContext,
  args: { customerId?: string; dealId?: string; take?: number }
): Promise<CallRecord[]> {
  return withTenant(ctx, (tx) =>
    tx.callRecord.findMany({
      where: {
        ...(args.customerId ? { customerId: args.customerId } : {}),
        ...(args.dealId ? { dealId: args.dealId } : {}),
      },
      orderBy: { startedAt: 'desc' },
      take: args.take ?? 50,
    })
  );
}

export async function get(ctx: ServiceContext, callId: string): Promise<CallRecord> {
  const row = await withTenant(ctx, (tx) => tx.callRecord.findUnique({ where: { id: callId } }));
  if (!row) throw new CrmNotFoundError('CallRecord', callId);
  return row;
}

/* ── Placing ────────────────────────────────────────────────────────────── */

export interface PlaceCallResult {
  call: CallRecord;
  /** False when the vendor refused. The ROW still exists — an attempt that
   *  failed is a fact about the day, and losing it would leave a rep unsure
   *  whether they had tried. */
  placed: boolean;
  error?: string;
}

/** Which number a call goes out on, and which site owns it. */
export interface CallOrigin {
  /** The tenant's own number, in E.164 — what the customer sees ring. */
  fromNumber: string;
  /**
   * The site that number belongs to, which is NOT always the customer's own.
   *
   * Returned rather than assumed so the placer decrypts the credentials of the
   * account that owns this number. Resolving the number from one site and the
   * vendor account from another is how a call goes out with a caller ID the
   * account has no claim to — which carriers drop.
   */
  propertyId: string | null;
}

export interface PlaceCallOptions {
  /**
   * Which number to call FROM, given the site the customer belongs to.
   * Null when no phone system can be reached for them at all.
   *
   * A CALLBACK RATHER THAN A VALUE because the site is not knowable until the
   * customer has been read, and the customer is read here. A caller that
   * resolved a number up front would have to load the customer a second time to
   * know which site to resolve for — and, having no reason to, would resolve the
   * tenant-wide one and dial every site's customers from the same number. That
   * is the bug this shape removes.
   *
   * `customerPropertyId` IS NULL FOR A GLOBAL CUSTOMER — one deliberately shared
   * across every site (docs/58 D2), not one whose site is unknown. So null means
   * "you decide", and a caller with an active site should answer with THAT
   * site's number: the person dialling is working in a site, and the customer
   * belongs to all of them equally.
   *
   * The credential itself stays outside this package — the caller returns a
   * number, never a token.
   */
  resolveOrigin(customerPropertyId: string | null): Promise<CallOrigin | null>;
}

/**
 * Ring the rep, then bridge them to the customer.
 *
 * The customer's number comes from the RECORD, never from the request, for the
 * same reason an email address does: a typo in a body must not be able to dial
 * a stranger from the tenant's number.
 */
export async function placeCall(
  ctx: ServiceContext,
  rawInput: unknown,
  options: PlaceCallOptions
): Promise<PlaceCallResult> {
  const input = PlaceCallInput.parse(rawInput);

  const target = await withTenant(ctx, async (tx) => {
    const customer = await tx.customer.findUnique({
      where: { id: input.customerId },
      select: {
        id: true,
        phone: true,
        propertyId: true,
        doNotContact: true,
        deletedAt: true,
      },
    });
    if (!customer || customer.deletedAt) throw new CrmNotFoundError('Customer', input.customerId);
    if (!customer.phone) {
      throw new CrmValidationError('This customer has no phone number on their record.', [
        { field: 'customerId', message: 'No phone number to call.' },
      ]);
    }
    // Do-not-contact governs a phone call exactly as it governs an email.
    // Someone who asked not to be contacted did not mean "except by phone".
    if (customer.doNotContact) {
      throw new CrmValidationError('This customer has asked not to be contacted.', [
        { field: 'customerId', message: 'Do not contact is switched on for this person.' },
      ]);
    }
    return { id: customer.id, phone: customer.phone, propertyId: customer.propertyId };
  });

  // Resolved for the CUSTOMER'S site, not the tenant's default — see
  // PlaceCallOptions. Nothing has been written at this point, so refusing here
  // leaves no half-placed call behind.
  const origin = await options.resolveOrigin(target.propertyId);
  if (!origin) {
    throw new CrmValidationError(
      'No phone system is connected for this site, so the call cannot be placed from here. You can still log a call you made yourself.',
      [{ field: 'customerId', message: 'No phone system is connected for this site.' }]
    );
  }

  // Placed BEFORE the row is written, because the provider's call id is what
  // every later webhook arrives with — and a row without it could never be
  // matched to the call it represents.
  //
  // The site passed on is the ORIGIN'S, not the customer's: it is the one whose
  // vendor account owns `from`, and those two must be the same account.
  const outcome = await activePlacer.place({
    tenantId: ctx.tenantId,
    propertyId: origin.propertyId,
    to: target.phone,
    from: origin.fromNumber,
    bridgeTo: input.fromDeviceNumber,
  });

  const call = await withTenant(ctx, async (tx) => {
    const created = await tx.callRecord.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: target.propertyId,
        customerId: target.id,
        dealId: input.dealId ?? null,
        ticketId: input.ticketId ?? null,
        direction: 'out',
        fromNumber: origin.fromNumber,
        toNumber: target.phone,
        // A refused call is `failed` from the start: there is nothing to wait
        // for, and leaving it `placing` would show a call ringing forever.
        status: outcome.success ? 'ringing' : 'failed',
        providerCallId: outcome.providerCallId ?? null,
        provider: outcome.provider ?? null,
        userId: ctx.userId ?? null,
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.call.placed',
      entityType: 'CallRecord',
      entityId: created.id,
      diff: { after: { to: target.phone, placed: outcome.success } },
    });
    return created;
  });

  return {
    call,
    placed: outcome.success,
    ...(outcome.errorMessage ? { error: outcome.errorMessage } : {}),
  };
}

/* ── The provider calling back ──────────────────────────────────────────── */

export interface StatusUpdate {
  providerCallId: string;
  outcome: CallOutcome | null;
  durationSec: number | null;
  recordingUrl?: string | null;
}

/**
 * A call reached a terminal state.
 *
 * This is where the timeline entry gets written — not at placement — so a
 * record never shows a conversation that had not started. Idempotent by
 * construction: a re-delivered webhook finds the call already `completed` and
 * returns without writing a second timeline entry.
 */
export async function recordStatus(
  ctx: ServiceContext,
  update: StatusUpdate
): Promise<CallRecord | null> {
  const result = await withTenant(ctx, async (tx) => {
    const call = await tx.callRecord.findFirst({
      where: { providerCallId: update.providerCallId },
    });
    if (!call) return null;
    // Already finished — a retry, which providers send routinely. Returning
    // here is what stops the timeline gaining a duplicate entry per retry.
    if (call.status === 'completed' || call.status === 'failed') return call;

    const updated = await tx.callRecord.update({
      where: { id: call.id },
      data: {
        status: 'completed',
        outcome: update.outcome,
        durationSec: update.durationSec,
        endedAt: new Date(),
        // Only ever set when the tenant switched recording on — the provider
        // does not send a URL otherwise, and we do not invent one.
        ...(update.recordingUrl ? { recordingUrl: update.recordingUrl } : {}),
      },
    });

    const message = await writeTimelineEntry(tx, ctx, updated);
    return tx.callRecord.update({
      where: { id: updated.id },
      data: { engagementMessageId: message.id },
    });
  });

  if (result?.status === 'completed') {
    await publishCrmEvent({
      tenantId: ctx.tenantId,
      topic: 'crm.engagement.logged',
      payload: {
        kind: 'call',
        callId: result.id,
        customerId: result.customerId,
        outcome: result.outcome,
      },
      dedupeKey: `crm.call.completed:${result.id}`,
    });
  }
  return result;
}

/**
 * Correct or annotate a finished call.
 *
 * The notes are the point of the whole feature — everything else the platform
 * already knew. The outcome is editable because the provider's version of it is
 * inferred rather than observed.
 */
export async function update(
  ctx: ServiceContext,
  callId: string,
  rawInput: unknown
): Promise<CallRecord> {
  const input = UpdateCallInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const before = await tx.callRecord.findUnique({ where: { id: callId } });
    if (!before) throw new CrmNotFoundError('CallRecord', callId);

    const updated = await tx.callRecord.update({
      where: { id: callId },
      data: {
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.outcome !== undefined ? { outcome: input.outcome } : {}),
        ...(input.durationSec !== undefined ? { durationSec: input.durationSec } : {}),
      },
    });

    // Keep the timeline honest. An edit that changed the notes but left the
    // record's own history showing the old ones would make the timeline a
    // second, wrong source of truth.
    if (before.engagementMessageId) {
      await tx.engagementMessage.updateMany({
        where: { id: before.engagementMessageId },
        data: {
          ...(input.notes !== undefined ? { bodyText: input.notes } : {}),
          ...(input.outcome !== undefined ? { outcome: input.outcome } : {}),
          ...(input.durationSec !== undefined ? { durationSec: input.durationSec } : {}),
        },
      });
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.call.updated',
      entityType: 'CallRecord',
      entityId: callId,
      diff: {
        before: { outcome: before.outcome, durationSec: before.durationSec },
        after: { outcome: updated.outcome, durationSec: updated.durationSec },
      },
    });
    return updated;
  });
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

/** The conversation + message a finished call becomes, so it reads on the
 *  timeline beside the emails and notes rather than in a separate list. */
async function writeTimelineEntry(
  tx: Prisma.TransactionClient,
  ctx: ServiceContext,
  call: CallRecord
): Promise<{ id: string }> {
  const thread = await tx.engagementThread.create({
    data: {
      tenantId: ctx.tenantId,
      propertyId: call.propertyId,
      subject: describeCall(call.direction, call.outcome),
      customerId: call.customerId,
      dealId: call.dealId,
      ticketId: call.ticketId,
      status: 'closed',
      lastMessageAt: call.startedAt,
      messageCount: 1,
    },
  });

  const message = await tx.engagementMessage.create({
    data: {
      tenantId: ctx.tenantId,
      threadId: thread.id,
      kind: 'call',
      direction: call.direction,
      fromAddress: call.fromNumber,
      toAddresses: [call.toNumber],
      bodyText: call.notes,
      sentAt: call.startedAt,
      sentByUserId: call.userId,
      durationSec: call.durationSec,
      outcome: call.outcome,
    },
  });

  if (call.customerId) {
    await tx.crmActivity.create({
      data: {
        tenantId: ctx.tenantId,
        customerId: call.customerId,
        dealId: call.dealId,
        // A call nobody answered is a different fact from a conversation, and a
        // business chasing someone needs to tell them apart at a glance.
        type: call.outcome === 'connected' ? 'call.logged' : 'call.missed',
        description: call.notes ?? describeCall(call.direction, call.outcome),
        actorId: call.userId,
        actorType: call.userId ? 'staff' : 'system',
        occurredAt: call.startedAt,
        linkedEntityType: 'CallRecord',
        linkedEntityId: call.id,
      },
    });
  }
  return message;
}

/** How a call reads when nobody has written a note yet: still a sentence,
 *  because "call · out · no_answer" is a log line, not history. */
export function describeCall(direction: string, outcome: string | null): string {
  const who = direction === 'out' ? 'Called them' : 'They called';
  switch (outcome) {
    case 'connected':
      return who;
    case 'no_answer':
      return `${who} — no answer`;
    case 'voicemail':
      return `${who} — left a voicemail`;
    case 'busy':
      return `${who} — line was busy`;
    case 'wrong_number':
      return `${who} — wrong number`;
    default:
      return who;
  }
}
