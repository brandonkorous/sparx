// Leaving a mailing list (piggles persona issue 983). Opening the link asks, naming
// the business and the address; the button, or a mail app's own one-click
// Unsubscribe (RFC 8058, a form post), does it. Opening used to unsubscribe at once,
// which a mail scanner does to every link, and the mail apps' form post got a 415.

import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const add = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const events = vi.hoisted(() => [] as Record<string, unknown>[]);
const tx = vi.hoisted(() => ({
  broadcast: {
    findUnique: ({ where }: { where: { id: string } }) =>
      Promise.resolve(
        where.id === 'campaign-1' ? { id: 'campaign-1', propertyId: 'site-1' } : null
      ),
  },
  emailEvent: {
    findFirst: ({ where }: { where: { broadcastId: string; recipient: string } }) =>
      Promise.resolve(
        events.find(
          (e) => e.broadcastId === where.broadcastId && e.recipient === where.recipient
        ) ?? null
      ),
    create: ({ data }: { data: Record<string, unknown> }) => {
      events.push(data);
      return Promise.resolve(data);
    },
  },
}));
vi.mock('@wizeworks/email-platform', () => ({ suppressionService: { add } }));
vi.mock('@wizeworks/db', () => ({
  prisma: {
    tenant: { findUnique: () => Promise.resolve({ name: 'The Marrow Review' }) },
  },
  withTenant: (_ctx: unknown, fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
}));

const { signUnsubscribeToken } = await import('../../../lib/email-unsubscribe.js');
const { default: routes } = await import('./email-unsubscribe.js');

const TENANT = 'a4a12945-5721-4599-a0ca-631a9e9a8afe';
const token = signUnsubscribeToken(TENANT, 'owen.pryce@example.net');
const url = `/v1/public/email/unsubscribe?token=${encodeURIComponent(token)}`;

async function app() {
  const a = Fastify();
  await a.register(routes);
  return a;
}

beforeEach(() => {
  add.mockClear();
  events.length = 0;
});

describe('opening the link', () => {
  it('asks, naming the business and the address, and takes nobody off', async () => {
    const res = await (await app()).inject({ method: 'GET', url });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Stop these emails?');
    expect(res.body).toContain('The Marrow Review');
    expect(res.body).toContain('owen.pryce@example.net');
    expect(res.body).toContain('<button type="submit">Unsubscribe</button>');
    expect(add).not.toHaveBeenCalled();
  });

  it('says a link it cannot read did not work, and writes nothing', async () => {
    const res = await (
      await app()
    ).inject({
      method: 'GET',
      url: '/v1/public/email/unsubscribe?token=not-a-token',
    });
    expect(res.body).toContain('This link didn’t work');
    expect(add).not.toHaveBeenCalled();
  });
});

describe('pressing Unsubscribe', () => {
  it('takes the address off, from the page’s button', async () => {
    const res = await (
      await app()
    ).inject({
      method: 'POST',
      url,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: '',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('You’re unsubscribed');
    expect(add).toHaveBeenCalledWith(
      { tenantId: TENANT },
      expect.objectContaining({ email: 'owen.pryce@example.net', scope: 'marketing' })
    );
  });

  it('takes the address off from a mail app’s one-click Unsubscribe (RFC 8058)', async () => {
    const res = await (
      await app()
    ).inject({
      method: 'POST',
      url,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'List-Unsubscribe=One-Click',
    });
    expect(res.statusCode).toBe(200);
    expect(add).toHaveBeenCalledTimes(1);
  });
});

describe('an unsubscribe from a campaign', () => {
  const fromCampaign = `/v1/public/email/unsubscribe?token=${encodeURIComponent(
    signUnsubscribeToken(TENANT, 'owen.pryce@example.net', 'campaign-1')
  )}`;
  const press = async () =>
    (await app()).inject({
      method: 'POST',
      url: fromCampaign,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'List-Unsubscribe=One-Click',
    });

  it('counts once against the campaign it came from, however often it is pressed', async () => {
    await press();
    await press();
    expect(events).toEqual([
      expect.objectContaining({
        broadcastId: 'campaign-1',
        propertyId: 'site-1',
        recipient: 'owen.pryce@example.net',
        type: 'unsubscribed',
      }),
    ]);
  });

  it('counts nothing for a link with no campaign in it', async () => {
    await (
      await app()
    ).inject({
      method: 'POST',
      url,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: '',
    });
    expect(events).toEqual([]);
  });
});
