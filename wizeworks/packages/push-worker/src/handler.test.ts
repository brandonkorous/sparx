import { describe, expect, it } from 'vitest';

import { parseEvent } from './handler.js';

// Guards the contract between api-rest's `push.send` publish and this worker's
// consume. The delivery path (web-push send + 410 pruning) is integration-tested
// once VAPID + a mock push service are wired.

const VALID = {
  type: 'push.send',
  tenantId: '550e8400-e29b-41d4-a716-446655440000',
  data: {
    userId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    title: 'New message from Dana',
    body: 'Do you have this in blue?',
    url: '/chat/abc',
    tag: 'chat-abc',
  },
};

describe('parseEvent (push.send)', () => {
  it('accepts a well-formed event', () => {
    const e = parseEvent(VALID);
    expect(e).not.toBeNull();
    expect(e?.data.title).toBe('New message from Dana');
    expect(e?.data.tag).toBe('chat-abc');
  });

  it('allows optional url/tag to be omitted', () => {
    const e = parseEvent({
      type: 'push.send',
      tenantId: VALID.tenantId,
      data: { userId: VALID.data.userId, title: 'Hi', body: '' },
    });
    expect(e).not.toBeNull();
  });

  it('rejects a different event type', () => {
    expect(parseEvent({ ...VALID, type: 'email.send' })).toBeNull();
  });

  it('rejects a non-uuid tenant or user', () => {
    expect(parseEvent({ ...VALID, tenantId: 'nope' })).toBeNull();
    expect(parseEvent({ ...VALID, data: { ...VALID.data, userId: 'nope' } })).toBeNull();
  });

  it('rejects a missing title', () => {
    expect(parseEvent({ ...VALID, data: { ...VALID.data, title: '' } })).toBeNull();
  });
});
