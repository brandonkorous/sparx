import { describe, expect, it } from 'vitest';
import { parseEvent } from './handler';

// What goes on the wire, built the way `publish()` in @sparx/api-core builds it.
//
// This file exists because of the exact bug it now prevents: the worker parsed
// the payload shape at the TOP LEVEL while every published event wraps it in an
// envelope, so `parseEvent` returned null for every real message. The consumer
// treats null as "off-schema, ack and move on" — by design, because redelivering
// something that can never parse just burns the retry budget — so imports were
// dropped in complete silence. The API returned 202, the job row said `pending`
// forever, nothing logged an error, and no test failed.
//
// That is why the fixture below is written as the envelope rather than as the
// payload: a test that asserts `parseEvent(payload)` works would have passed
// throughout, and is what "covered" would have looked like.

const TENANT = '00000000-0000-0000-0000-0000000000aa';
const JOB = { jobId: '3f1d5b6e-7c2a-4a1b-9c8d-2e5f7a9b1c3d', entityType: 'products' };

/** What `parseEvent` hands back: the payload plus the tenant lifted off the
 *  envelope, because the job row cannot be read without it. */
const PARSED = { ...JOB, tenantId: TENANT };

function published(data: unknown): unknown {
  return {
    type: 'import.job.created',
    tenantId: TENANT,
    actorId: null,
    occurredAt: '2026-08-12T00:00:00.000Z',
    data,
  };
}

describe('parseEvent', () => {
  it('accepts the event exactly as it is published', () => {
    expect(parseEvent(published(JOB))).toEqual(PARSED);
  });

  it('rejects the bare payload, which is what nothing ever sends', () => {
    // Kept as an assertion rather than left unsaid: accepting both shapes would
    // make this worker tolerant of a publisher that had gone wrong, which is how
    // the mismatch would hide again.
    expect(parseEvent(JOB)).toBeNull();
  });

  it('ignores an event of another type that happened to reach this consumer', () => {
    expect(parseEvent({ ...(published(JOB) as object), type: 'order.placed' })).toBeNull();
  });

  it('rejects an envelope whose payload is missing or malformed', () => {
    expect(parseEvent(published({ entityType: 'products' }))).toBeNull();
    expect(parseEvent(published({ jobId: 'not-a-uuid', entityType: 'products' }))).toBeNull();
    expect(parseEvent(published({ ...JOB, entityType: '' }))).toBeNull();
    expect(parseEvent(null)).toBeNull();
  });

  it('survives an envelope that gained a field it does not read', () => {
    // Events grow. A worker that broke on an added field would turn a routine
    // producer change into a silent outage of exactly the kind above.
    const event = { ...(published(JOB) as object), traceId: 'abc', schemaVersion: 2 };
    expect(parseEvent(event)).toEqual(PARSED);
  });

  it('accepts an envelope with no actor, which is what a system-started import has', () => {
    const event = published(JOB) as Record<string, unknown>;
    delete event.actorId;
    expect(parseEvent(event)).toEqual(PARSED);
  });
});
