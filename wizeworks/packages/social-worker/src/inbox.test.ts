import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';
import type * as Social from '@wizeworks/social';

// A refused token refresh during an inbox sync or a reply.
//
// In prod on 2026-10-01 a Pinterest grant was refused (`401 invalid_grant`). The refresh
// runs inside resolveTargetContext, which had no catch: the throw reached the handler as
// a failure, the message was redelivered five times, the cursor never moved, and the
// sweep re-picked the destination every two minutes. The connection stayed `active`, so
// the owner was never told to reconnect. These lock the three outcomes that replace it.

const db = vi.hoisted(() => ({
  socialTarget: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  socialInboxItem: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));
const resolveSocialAuth = vi.hoisted(() => vi.fn());
const markConnectionExpired = vi.hoisted(() => vi.fn());
const adapter = vi.hoisted(() => ({
  isConfigured: () => true,
  supportsInbox: () => true,
  listInbox: vi.fn(),
  replyToInbox: vi.fn(),
}));

vi.mock('@wizeworks/db', () => ({
  withTenant: (_ctx: unknown, fn: (tx: typeof db) => unknown) => fn(db),
}));
vi.mock('@wizeworks/social', async (importOriginal) => ({
  ...(await importOriginal<typeof Social>()),
  getSocialAdapter: () => adapter,
}));
vi.mock('@wizeworks/social/adapters', () => ({ registerBuiltinSocialAdapters: vi.fn() }));
vi.mock('@wizeworks/social/crypto', () => ({ isSocialTokenCryptoConfigured: () => true }));
vi.mock('./auth.js', () => ({ resolveSocialAuth }));
vi.mock('./health.js', () => ({ markConnectionExpired }));

const { HttpError } = await import('@wizeworks/social');
const { sendInboxReply, syncInbox } = await import('./inbox.js');

const TENANT = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';
const CONNECTION = '33333333-3333-4333-8333-333333333333';
const ITEM = '44444444-4444-4444-8444-444444444444';
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as Logger;

const refused = new HttpError('Pinterest token refresh failed: 401 invalid grant', 401);
const outage = new HttpError('Pinterest token refresh failed: 503', 503);

beforeEach(() => {
  vi.clearAllMocks();
  db.socialTarget.findFirst.mockResolvedValue({
    id: TARGET,
    enabled: true,
    platform: 'pinterest',
    externalTargetId: 'board-1',
    name: 'Linen boards',
    metadata: null,
    connection: { id: CONNECTION, status: 'active', propertyId: null },
  });
  db.socialInboxItem.findFirst.mockResolvedValue({
    id: ITEM,
    socialTargetId: TARGET,
    direction: 'outbound',
    repliedAt: null,
    parentExternalId: 'comment-1',
    text: 'Thank you!',
  });
});

describe('syncInbox when the refresh is refused', () => {
  it('marks the connection for reconnecting and moves the cursor, instead of failing', async () => {
    resolveSocialAuth.mockRejectedValue(refused);

    await expect(syncInbox(TENANT, TARGET, logger)).resolves.toMatchObject({
      result: 'skipped',
    });
    expect(markConnectionExpired).toHaveBeenCalledWith(
      TENANT,
      CONNECTION,
      'refresh_failed',
      expect.stringContaining('invalid grant'),
      logger
    );
    // The cursor moved, so the sweep stops re-picking it every two minutes.
    expect(db.socialTarget.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TARGET } })
    );
    expect(adapter.listInbox).not.toHaveBeenCalled();
  });

  it('still retries a platform outage, and leaves the connection alone', async () => {
    resolveSocialAuth.mockRejectedValue(outage);

    await expect(syncInbox(TENANT, TARGET, logger)).rejects.toBe(outage);
    expect(markConnectionExpired).not.toHaveBeenCalled();
  });
});

describe('sendInboxReply when the refresh is refused', () => {
  it('fails the reply with the reconnect reason, not "the platform does not allow it"', async () => {
    resolveSocialAuth.mockRejectedValue(refused);

    await expect(sendInboxReply(TENANT, ITEM, logger)).resolves.toEqual({
      itemId: ITEM,
      result: 'failed',
    });
    expect(markConnectionExpired).toHaveBeenCalledOnce();
    expect(db.socialInboxItem.update).toHaveBeenCalledWith({
      where: { id: ITEM },
      data: {
        status: 'failed',
        metadata: { error: 'This account needs reconnecting before a reply can go out.' },
      },
    });
    expect(adapter.replyToInbox).not.toHaveBeenCalled();
  });
});
