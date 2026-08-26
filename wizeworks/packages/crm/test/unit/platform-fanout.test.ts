// The CRM→platform bridge carries what is subscribed, and nothing decides that
// but the subscriptions.
//
// This exists because the bridge used to hold a second list. `FORWARD_TOPICS`
// named four topics and a comment asking whoever came next to keep it in sync
// with the evaluator's; two consumers later grew subscribers for seven more, and
// none were added. Nothing failed. Segments simply never filled and deal scores
// never moved, on every tenant, for as long as it took someone to open the two
// files side by side.
//
// So the assertion here is not "these topics forward". It is "a topic forwards
// BECAUSE something subscribes to it" — a property that survives the next
// consumer, since adding one is what makes it true.

import { describe, expect, it } from 'vitest';

import { getPublisher, publishCrmEvent, setPublisher, RecordingPublisher } from '../../src/events';
import { installPlatformBusFanout } from '../../src/consumers/platform-fanout';
import {
  resetPlatformBusForTesting,
  type PlatformEvent,
  type PlatformEventBus,
} from '../../src/consumers/platform-bus';

/** Install the bridge over a recording publisher; returns both ends plus the
 *  events the platform bus actually saw. */
function harness(): {
  bus: PlatformEventBus;
  inner: RecordingPublisher;
  seen: PlatformEvent[];
  restore: () => void;
} {
  const bus = resetPlatformBusForTesting();
  const inner = new RecordingPublisher();
  const prior = getPublisher();
  setPublisher(inner);
  const teardown = installPlatformBusFanout(bus);
  const seen: PlatformEvent[] = [];
  // Subscribing here would itself make a topic forwardable, so the recorder is
  // attached per-test to the topic under examination, never globally.
  return {
    bus,
    inner,
    seen,
    restore: () => {
      teardown();
      setPublisher(prior);
    },
  };
}

const EVENT = {
  tenantId: '00000000-0000-0000-0000-0000000000aa',
  payload: { segmentId: 'seg-1' },
  dedupeKey: 'test-key',
} as const;

describe('the CRM→platform bridge', () => {
  it('carries a crm.* event that something in this process handles', async () => {
    const h = harness();
    try {
      const seen: PlatformEvent[] = [];
      h.bus.subscribe('crm.segment.created', (event) => {
        seen.push(event);
        return Promise.resolve();
      });

      await publishCrmEvent({ topic: 'crm.segment.created', ...EVENT });

      expect(seen).toHaveLength(1);
      expect(seen[0]?.tenantId).toBe(EVENT.tenantId);
      // The CRM event's dedupeKey seeds the platform id, so one redelivered
      // domain event maps to one in-process processing.
      expect(seen[0]?.id).toBe('test-key');
    } finally {
      h.restore();
    }
  });

  it('leaves the webhook and Pub/Sub chain intact either way', async () => {
    const h = harness();
    try {
      await publishCrmEvent({ topic: 'crm.deal.created', ...EVENT });
      h.bus.subscribe('crm.deal.created', () => Promise.resolve());
      await publishCrmEvent({ topic: 'crm.deal.created', ...EVENT });

      // Delegation is unconditional — the bridge decides who ELSE hears it,
      // never whether the event happened.
      expect(h.inner.events).toHaveLength(2);
    } finally {
      h.restore();
    }
  });

  it('does not carry a topic nothing handles', async () => {
    const h = harness();
    try {
      const seen: PlatformEvent[] = [];
      h.bus.subscribe('crm.segment.created', (event) => {
        seen.push(event);
        return Promise.resolve();
      });

      await publishCrmEvent({ topic: 'crm.customer.deleted', ...EVENT });

      expect(seen).toHaveLength(0);
      expect(h.inner.events).toHaveLength(1);
    } finally {
      h.restore();
    }
  });

  it('starts carrying a topic the moment a consumer subscribes to it', async () => {
    const h = harness();
    try {
      const seen: PlatformEvent[] = [];
      await publishCrmEvent({ topic: 'crm.engagement.received', ...EVENT });
      expect(seen).toHaveLength(0);

      // The whole point: this line is the registration. There is no list to
      // also remember to edit, which is the failure this replaced.
      h.bus.subscribe('crm.engagement.received', (event) => {
        seen.push(event);
        return Promise.resolve();
      });
      await publishCrmEvent({ topic: 'crm.engagement.received', ...EVENT });

      expect(seen).toHaveLength(1);
    } finally {
      h.restore();
    }
  });
});
