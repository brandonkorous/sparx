// callService — placing calls and recording what happened (docs/144 §5.6).
//
// The four things this file holds, none of which are visible from a signature:
//
//   • A CALL THAT WAS PLACED IS NOT A CALL THAT HAPPENED. The timeline entry is
//     written when the provider says the call ENDED, never at placement — else a
//     record shows a conversation that never started.
//   • WEBHOOKS ARRIVE MORE THAN ONCE. Providers retry aggressively; a redelivery
//     must not add a second entry to the timeline.
//   • THE NUMBER COMES FROM THE RECORD. A request body cannot dial a stranger,
//     and do-not-contact governs a phone call exactly as it governs an email.
//   • AN EDIT KEEPS THE TIMELINE HONEST. Correcting a call's notes or outcome
//     has to update what the timeline shows, or the timeline becomes a second,
//     wrong source of truth.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@sparx/db';
import {
  callService,
  customerService,
  RecordingCallPlacer,
  setCallPlacer,
} from '../../src/services/index.js';
import { disposeTestContext, makeTestContext, type TestContext } from '../helpers.js';

/** Timeline rows, read under the tenant (crm_activities is FORCE RLS). */
async function activitiesFor(tenantId: string, customerId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    return tx.crmActivity.findMany({ where: { customerId }, orderBy: { occurredAt: 'asc' } });
  });
}

async function messagesFor(tenantId: string, threadCustomerId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    const threads = await tx.engagementThread.findMany({
      where: { customerId: threadCustomerId },
      include: { messages: true },
    });
    return threads.flatMap((thread) => thread.messages);
  });
}

const FROM = '+15550100000';

describe('callService', () => {
  let test: TestContext;
  let placer: RecordingCallPlacer;
  let customerId: string;
  let silentId: string;

  beforeAll(async () => {
    test = await makeTestContext('owner');

    const customer = await customerService.create(test.ctx, {
      type: 'retail',
      email: 'caller@customer.test',
      phone: '+15550109999',
      firstName: 'Dana',
      lastName: 'Reed',
    });
    customerId = customer.id;

    const silent = await customerService.create(test.ctx, {
      type: 'retail',
      email: 'nocontact@customer.test',
      phone: '+15550108888',
      firstName: 'Quiet',
      lastName: 'Person',
      doNotContact: true,
    });
    silentId = silent.id;
  });

  afterAll(async () => {
    await disposeTestContext(test);
  });

  beforeEach(() => {
    placer = new RecordingCallPlacer();
    setCallPlacer(placer);
    test.publisher.clear();
  });

  it('rings the rep first and dials the number on the record', async () => {
    const result = await callService.placeCall(
      test.ctx,
      { customerId, fromDeviceNumber: '+15550101111' },
      { fromNumber: FROM }
    );

    expect(result.placed).toBe(true);
    // The rep's phone is what is DIALLED; the customer is who gets bridged in.
    expect(placer.placed[0]).toEqual({
      bridgeTo: '+15550101111',
      to: '+15550109999',
      from: FROM,
    });
    expect(result.call.status).toBe('ringing');
    expect(result.call.direction).toBe('out');
  });

  it('does not write a timeline entry until the call has ended', async () => {
    const before = await activitiesFor(test.ctx.tenantId, customerId);
    await callService.placeCall(
      test.ctx,
      { customerId, fromDeviceNumber: '+15550101111' },
      { fromNumber: FROM }
    );
    const after = await activitiesFor(test.ctx.tenantId, customerId);
    // A call that is still ringing is not yet a conversation. Recording one
    // here would show a customer conversation that never happened.
    expect(after.length).toBe(before.length);
  });

  it('refuses to call someone who asked not to be contacted', async () => {
    await expect(
      callService.placeCall(
        test.ctx,
        { customerId: silentId, fromDeviceNumber: '+15550101111' },
        { fromNumber: FROM }
      )
    ).rejects.toThrow(/asked not to be contacted/i);
    expect(placer.placed).toHaveLength(0);
  });

  it('still records the attempt when the phone system refuses', async () => {
    // An attempt that failed is a fact about the day. Losing it would leave a
    // rep unsure whether they had already tried.
    setCallPlacer(new RecordingCallPlacer({ success: false }));
    const result = await callService.placeCall(
      test.ctx,
      { customerId, fromDeviceNumber: '+15550101111' },
      { fromNumber: FROM }
    );
    expect(result.placed).toBe(false);
    // `failed` from the start — there is nothing to wait for, and leaving it
    // `ringing` would show a call ringing forever.
    expect(result.call.status).toBe('failed');
  });

  it('writes the timeline entry when the call ends, and only then', async () => {
    const placed = await callService.placeCall(
      test.ctx,
      { customerId, fromDeviceNumber: '+15550101111' },
      { fromNumber: FROM }
    );

    const finished = await callService.recordStatus(test.ctx, {
      providerCallId: placed.call.providerCallId ?? '',
      outcome: 'connected',
      durationSec: 92,
    });

    expect(finished?.status).toBe('completed');
    expect(finished?.durationSec).toBe(92);
    expect(finished?.engagementMessageId).toBeTruthy();

    const messages = await messagesFor(test.ctx.tenantId, customerId);
    const call = messages.find((m) => m.kind === 'call' && m.durationSec === 92);
    expect(call).toBeTruthy();

    const activities = await activitiesFor(test.ctx.tenantId, customerId);
    expect(activities.some((a) => a.type === 'call.logged')).toBe(true);
  });

  it('records a call nobody answered as a different fact from a conversation', async () => {
    const placed = await callService.placeCall(
      test.ctx,
      { customerId, fromDeviceNumber: '+15550101111' },
      { fromNumber: FROM }
    );
    await callService.recordStatus(test.ctx, {
      providerCallId: placed.call.providerCallId ?? '',
      outcome: 'no_answer',
      durationSec: 0,
    });

    const activities = await activitiesFor(test.ctx.tenantId, customerId);
    // A business chasing somebody needs to tell "we spoke" from "we tried".
    expect(activities.some((a) => a.type === 'call.missed')).toBe(true);
  });

  it('ignores a re-delivered webhook instead of doubling the timeline', async () => {
    const placed = await callService.placeCall(
      test.ctx,
      { customerId, fromDeviceNumber: '+15550101111' },
      { fromNumber: FROM }
    );
    const update = {
      providerCallId: placed.call.providerCallId ?? '',
      outcome: 'connected' as const,
      durationSec: 30,
    };

    await callService.recordStatus(test.ctx, update);
    const afterFirst = await messagesFor(test.ctx.tenantId, customerId);

    // Providers retry aggressively; duplicate delivery is normal, not an error.
    await callService.recordStatus(test.ctx, update);
    await callService.recordStatus(test.ctx, update);
    const afterRetries = await messagesFor(test.ctx.tenantId, customerId);

    expect(afterRetries.length).toBe(afterFirst.length);
  });

  it('returns null for a callback about a call it has never heard of', async () => {
    const result = await callService.recordStatus(test.ctx, {
      providerCallId: 'not-a-call-we-placed',
      outcome: 'connected',
      durationSec: 10,
    });
    expect(result).toBeNull();
  });

  it('lets a person overrule what the phone system guessed', async () => {
    const placed = await callService.placeCall(
      test.ctx,
      { customerId, fromDeviceNumber: '+15550101111' },
      { fromNumber: FROM }
    );
    // A six-second "completed" call is a voicemail greeting about as often as it
    // is a very short conversation, so the provider's guess must be correctable.
    await callService.recordStatus(test.ctx, {
      providerCallId: placed.call.providerCallId ?? '',
      outcome: 'no_answer',
      durationSec: 6,
    });

    const corrected = await callService.update(test.ctx, placed.call.id, {
      outcome: 'voicemail',
      notes: 'Left a message about the quote.',
    });
    expect(corrected.outcome).toBe('voicemail');

    // And the timeline follows, or it becomes a second, wrong source of truth.
    const messages = await messagesFor(test.ctx.tenantId, customerId);
    const entry = messages.find((m) => m.id === corrected.engagementMessageId);
    expect(entry?.outcome).toBe('voicemail');
    expect(entry?.bodyText).toBe('Left a message about the quote.');
  });

  it('lists a record’s calls newest first', async () => {
    const calls = await callService.listFor(test.ctx, { customerId });
    expect(calls.length).toBeGreaterThan(1);
    for (let i = 1; i < calls.length; i += 1) {
      expect(calls[i - 1]!.startedAt.getTime()).toBeGreaterThanOrEqual(
        calls[i]!.startedAt.getTime()
      );
    }
  });

  it('refuses to call a customer with no phone number', async () => {
    const noPhone = await customerService.create(test.ctx, {
      type: 'retail',
      email: 'nophone@customer.test',
      firstName: 'No',
      lastName: 'Phone',
    });
    await expect(
      callService.placeCall(
        test.ctx,
        { customerId: noPhone.id, fromDeviceNumber: '+15550101111' },
        { fromNumber: FROM }
      )
    ).rejects.toThrow(/no phone number/i);
  });
});
