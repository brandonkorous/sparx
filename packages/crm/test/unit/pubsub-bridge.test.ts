// CrmPubSubPublisher envelope-mapping + delegation test.
//
// No live Pub/Sub: we exercise the publisher's mapping + delegation contract
// by stubbing the TopicPublisher's network call and recording what the inner
// publisher receives. The bridge MUST (1) shape the CommerceEventEnvelope the
// indexer decodes, (2) always delegate to the inner publisher even when the
// Pub/Sub publish throws, and (3) never throw out of publish().

import { describe, expect, it, vi } from 'vitest';

import { CrmPubSubPublisher } from '../../src/pubsub-bridge';
import type { CrmEvent, Publisher } from '../../src/events';

class RecordingInner implements Publisher {
  readonly events: CrmEvent[] = [];
  publish(event: CrmEvent): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}

// Minimal stand-in for the internal TopicPublisher — records publishes.
interface CapturedPublish {
  envelope: {
    type: string;
    tenantId: string;
    actorId: string | null;
    occurredAt: string;
    data: unknown;
  };
  attributes: Record<string, string>;
}

function makeBridge(opts: { failPublish?: boolean } = {}) {
  const captured: CapturedPublish[] = [];
  const fanned: CapturedPublish['envelope'][] = [];
  const topics = {
    publish: vi.fn((envelope: CapturedPublish['envelope'], attributes: Record<string, string>) => {
      if (opts.failPublish) return Promise.reject(new Error('pubsub down'));
      captured.push({ envelope, attributes });
      return Promise.resolve();
    }),
    // The automation fan-in tee (docs/82 §3.3). Records separately so the
    // per-type `publish` assertions stay focused on the domain + index publishes.
    fanIn: vi.fn((envelope: CapturedPublish['envelope']) => {
      if (opts.failPublish) return Promise.reject(new Error('pubsub down'));
      fanned.push(envelope);
      return Promise.resolve();
    }),
  };
  const logged: object[] = [];
  const logger = {
    info: () => undefined,
    error: (obj: object) => logged.push(obj),
  };
  const inner = new RecordingInner();
  // The constructor is (topics, logger, inner) — topics is structurally typed
  // to TopicPublisher; the stub satisfies the only methods used.
  const pub = new CrmPubSubPublisher(topics as never, logger, inner);
  return { pub, captured, fanned, inner, logged };
}

const event: CrmEvent = {
  tenantId: 'tenant-1',
  topic: 'crm.customer.created',
  payload: { customerId: 'c1', type: 'b2b', email: 'a@b.test' },
  dedupeKey: 'crm.customer.created:c1',
  occurredAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('CrmPubSubPublisher', () => {
  it('maps a CrmEvent to the indexer envelope (topic == type)', async () => {
    const { pub, captured, fanned } = makeBridge();
    await pub.publish(event);
    expect(captured).toHaveLength(1);
    expect(captured[0]!.envelope).toEqual({
      type: 'crm.customer.created',
      tenantId: 'tenant-1',
      actorId: null,
      occurredAt: '2026-01-01T00:00:00.000Z',
      data: { customerId: 'c1', type: 'b2b', email: 'a@b.test' },
    });
    expect(captured[0]!.attributes).toEqual({
      type: 'crm.customer.created',
      tenantId: 'tenant-1',
      dedupeKey: 'crm.customer.created:c1',
    });
    // Every crm.* event also tees to the automation fan-in (docs/82 §3.3).
    expect(fanned).toHaveLength(1);
    expect(fanned[0]!.type).toBe('crm.customer.created');
  });

  it('always delegates to the inner publisher', async () => {
    const { pub, inner } = makeBridge();
    await pub.publish(event);
    expect(inner.events).toEqual([event]);
  });

  it('swallows a Pub/Sub failure and still delegates (never fails the request)', async () => {
    const { pub, inner, logged } = makeBridge({ failPublish: true });
    await expect(pub.publish(event)).resolves.toBeUndefined();
    expect(inner.events).toEqual([event]); // inner still ran
    // Both the per-type publish and the fan-in tee fail and are logged, but
    // neither escapes publish() — the committed write must never fail the request.
    expect(logged.length).toBe(2);
  });

  it('omits the dedupeKey attribute when absent', async () => {
    const { pub, captured } = makeBridge();
    await pub.publish({ ...event, dedupeKey: undefined });
    expect(captured[0]!.attributes).toEqual({
      type: 'crm.customer.created',
      tenantId: 'tenant-1',
    });
  });

  it('also tees a search.entity.changed for a universal entity (deal)', async () => {
    const { pub, captured } = makeBridge();
    await pub.publish({
      tenantId: 'tenant-1',
      topic: 'crm.deal.created',
      payload: { dealId: 'd1', pipelineId: 'p1', stageId: 's1' },
      occurredAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    // Two publishes: the domain event + the universal index signal.
    expect(captured).toHaveLength(2);
    const index = captured.find((c) => c.envelope.type === 'search.entity.changed');
    expect(index).toBeDefined();
    expect(index!.envelope.data).toEqual({ entityType: 'deal', recordId: 'd1', op: 'upsert' });
    expect(index!.attributes).toEqual({ type: 'search.entity.changed', tenantId: 'tenant-1' });
  });

  it('does not tee an index signal for entities with no universal projector (customer)', async () => {
    const { pub, captured } = makeBridge();
    await pub.publish(event); // crm.customer.created → rich collection, not `entities`
    expect(captured).toHaveLength(1);
    expect(captured[0]!.envelope.type).toBe('crm.customer.created');
  });
});
