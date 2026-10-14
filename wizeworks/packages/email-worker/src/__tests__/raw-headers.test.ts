// A campaign's List-Unsubscribe headers reach the provider (piggles persona issue 985).
//
// The dispatcher built them for every campaign and the worker threw them away: its raw
// schema had no `headers`, so zod stripped them, and nothing downstream had a field to
// carry them in. No campaign ever went out with a mail app's own Unsubscribe button.

import { describe, expect, it, vi } from 'vitest';
import pino from 'pino';

const { sent } = vi.hoisted(() => ({ sent: [] as unknown[] }));

vi.mock('@wizeworks/db', () => ({
  prisma: { tenant: { findUnique: vi.fn().mockResolvedValue({ platformBrand: 'piggles' }) } },
}));
// Only what the worker uses from it. The real package renders React Email, which this
// suite does not need: a raw send is delivered as drawn.
vi.mock('@wizeworks/email', () => ({
  defaultBrand: {},
  MailgunParameterError: class extends Error {},
  PostalParameterError: class extends Error {},
  renderTemplate: vi.fn(),
  senderDomainOf: () => 'sparx.email',
  getEmailProvider: () => ({
    name: 'test',
    send: (email: unknown) => {
      sent.push(email);
      return Promise.resolve({ id: 'msg-1', provider: 'test', acceptedAt: '' });
    },
  }),
}));
vi.mock('@wizeworks/email-platform', () => ({
  analyticsService: { recordAccepted: vi.fn().mockResolvedValue(undefined) },
  brandService: {},
  domainService: { signingDomainFor: vi.fn().mockResolvedValue(null) },
  settingsService: {},
}));
vi.mock('@wizeworks/links/server', () => ({ appOrigin: () => 'https://my.piggles.test' }));

import { handle, parseEvent } from '../handler';

const UNSUBSCRIBE = {
  'List-Unsubscribe': '<https://api.example/v1/public/email/unsubscribe?token=abc.def>',
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
};

function campaignSend(headers: Record<string, string>) {
  return {
    type: 'email.send',
    tenantId: 'tenant-1',
    actorId: null,
    occurredAt: '2026-10-11T10:08:34.000Z',
    data: {
      kind: 'raw',
      to: 'reader@example.org',
      from: 'The Marrow Review <noreply@sparx.email>',
      subject: 'A correction to last Friday’s letter',
      html: '<p>A correction.</p>',
      text: 'A correction.',
      headers,
    },
  };
}

describe('a campaign send keeps its unsubscribe headers', () => {
  it('the worker’s schema carries them', () => {
    const event = parseEvent(campaignSend(UNSUBSCRIBE));
    expect(event).not.toBeNull();
    expect((event!.data as { headers?: unknown }).headers).toEqual(UNSUBSCRIBE);
  });

  it('refuses a header value that could start a second header', () => {
    expect(parseEvent(campaignSend({ 'List-Unsubscribe': '<x>\r\nBcc: someone@else' }))).toBeNull();
  });

  it('hands them to the provider', async () => {
    sent.length = 0;
    const event = parseEvent(campaignSend(UNSUBSCRIBE))!;
    const outcome = await handle(event, pino({ level: 'silent' }));
    expect(outcome.status).toBe('sent');
    expect((sent[0] as { headers?: unknown }).headers).toEqual(UNSUBSCRIBE);
  });
});
