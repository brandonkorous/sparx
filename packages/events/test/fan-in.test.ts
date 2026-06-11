// Fan-in tee unit tests (docs/82 §3.3, docs/84 Slice E3).
//
// The tee is the same primitive in all three publish paths (api-core, the
// @sparx/events publisher, and — inlined — the CRM bridge), so verifying it once
// here covers the contract: unchanged envelope body, `type` + `tenantId`
// attributes for the single subscriber to route on, and the loop-guard depth
// forwarded from the envelope data (default 0).

import { describe, expect, it } from 'vitest';

import { AUTOMATION_FANIN_TOPIC, teeToFanIn, type FanInEnvelope } from '../src/fan-in';

interface Captured {
  data: Buffer;
  attributes: Record<string, string>;
}

function mockTopic(): {
  topic: { publishMessage(m: Captured): Promise<string> };
  calls: Captured[];
} {
  const calls: Captured[] = [];
  return {
    calls,
    topic: {
      publishMessage(m: Captured): Promise<string> {
        calls.push(m);
        return Promise.resolve('msg-id');
      },
    },
  };
}

describe('teeToFanIn', () => {
  it('publishes the unchanged envelope with type + tenantId attributes, depth 0 by default', async () => {
    const { topic, calls } = mockTopic();
    const event: FanInEnvelope = {
      type: 'order.placed',
      tenantId: 't-1',
      actorId: null,
      occurredAt: '2026-06-11T00:00:00.000Z',
      data: { orderId: 'o-1' },
    };

    await teeToFanIn(topic as never, event);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.attributes).toEqual({
      type: 'order.placed',
      tenantId: 't-1',
      __automationDepth: '0',
    });
    // Body is byte-for-byte the original envelope — the worker decodes it as the
    // engine's TriggerEnvelope, reading the real type off `type`, not the topic.
    expect(JSON.parse(calls[0]!.data.toString('utf8'))).toEqual(event);
  });

  it('forwards a cascade depth stamped on the envelope data (loop-guard)', async () => {
    const { topic, calls } = mockTopic();

    await teeToFanIn(topic as never, {
      type: 'crm.customer.updated',
      tenantId: 't-2',
      actorId: null,
      occurredAt: '2026-06-11T00:00:00.000Z',
      data: { customerId: 'c-1', __automationDepth: 2 },
    });

    expect(calls[0]!.attributes.__automationDepth).toBe('2');
  });

  it('exposes the canonical fan-in topic name', () => {
    expect(AUTOMATION_FANIN_TOPIC).toBe('automation.trigger');
  });
});
