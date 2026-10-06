// The customer links built OUTSIDE the email data resolver: a booking's calendar
// event, a waitlist offer's text message, and a signing request (issue 064).
//
// Each read `SPARX_SITE_BASE` on its own and, with it unset (always), produced a
// bare path or nothing: a calendar event with no link back, a text message saying
// `/book/…` to a phone, a "Review & sign" button that opened nothing. All three now
// build on the site's real origin (`site-origin.ts`), the site the record belongs to.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyBaseLogger, FastifyRequest } from 'fastify';
import type { BillingDocumentSignature } from '@wizeworks/db';

const state = vi.hoisted(() => ({
  sms: [] as string[],
  published: [] as { template: string; props: Record<string, unknown> }[],
}));

const PRIMARY = { id: 'site-primary', slug: 'primary', isPrimary: true, name: 'Northwind' };
const STUDIO = { id: 'site-studio', slug: 'studio', isPrimary: false, name: 'Northwind Studio' };
const SITES = new Map([
  [PRIMARY.id, PRIMARY],
  [STUDIO.id, STUDIO],
]);

vi.mock('@wizeworks/db', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const at = new Date('2026-10-02T15:00:00Z');
  const domain = {
    // The studio has its own domain; the primary has only its minted subdomain.
    findFirst: ({ where }: { where: { propertyId: string } }) =>
      Promise.resolve(where.propertyId === STUDIO.id ? { host: 'studio.northwind.test' } : null),
    findMany: () => Promise.resolve([]),
  };
  const tenant = {
    findUnique: () =>
      Promise.resolve({
        email: 'owner@northwind.test',
        slug: 'northwind',
        name: 'Northwind LLC',
        settings: {},
      }),
  };
  const tx = {
    tenant,
    domain,
    property: {
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(SITES.get(where.id) ?? null),
      findFirst: () => Promise.resolve(PRIMARY),
    },
    booking: {
      findFirst: () =>
        Promise.resolve({
          startAt: at,
          endAt: new Date(at.getTime() + 3_600_000),
          status: 'confirmed',
          partySize: null,
          notes: null,
          createdAt: at,
          updatedAt: at,
          locationId: null,
          serviceId: 'svc-1',
          propertyId: STUDIO.id,
          service: { name: 'Pottery class' },
          resources: [],
        }),
    },
    waitlistEntry: {
      findUnique: () =>
        Promise.resolve({
          customerId: 'cust-1',
          serviceId: 'svc-1',
          desiredFrom: at,
          desiredTo: new Date(at.getTime() + 86_400_000),
          service: { name: 'Pottery class', propertyId: STUDIO.id },
        }),
    },
    customer: {
      findUnique: () => Promise.resolve({ email: null, phone: '+15555550100' }),
    },
    billingDocument: {
      findUnique: () =>
        Promise.resolve({
          number: 'Q-0007',
          total: 400,
          currency: 'USD',
          propertyId: STUDIO.id,
          stage: { customerLabel: 'Estimate' },
          property: { name: STUDIO.name },
        }),
    },
  };
  return {
    ...actual,
    prisma: { tenant, domain },
    withTenant: (_ctx: unknown, fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };
});

vi.mock('@wizeworks/scheduling', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  findBookingPlace: () => Promise.resolve(null),
}));

vi.mock('@wizeworks/sms/delivery', () => ({
  sendTenantSms: (_ctx: unknown, msg: { body: string }) => {
    state.sms.push(msg.body);
    return Promise.resolve({ outcome: 'sent' });
  },
}));

vi.mock('../env.js', () => ({ env: {} }));
vi.mock('./tenant-email.js', () => ({
  sendTenantEmailByKey: () => Promise.resolve({ sent: true }),
  // The shop's own From and Reply-To (sparx persona issue 071).
  tenantSenderHeaders: () =>
    Promise.resolve({ from: 'Rosa Flowers <hello@rosaflowers.example>', replyTo: null }),
}));

vi.mock('@wizeworks/api-core/auth', () => ({
  requireAuth: () => ({ tenantId: 'tenant-1', actorId: 'user-1' }),
}));
vi.mock('@wizeworks/api-core/pubsub', () => ({
  publish: (_log: unknown, _topic: string, _t: string, _a: string, payload: unknown) => {
    state.published.push(payload as { template: string; props: Record<string, unknown> });
    return Promise.resolve();
  },
}));

import { loadBookingIcs } from './scheduling-ical.js';
import { sendWaitlistOffer } from './scheduling-waitlist.js';
import { sendSignatureRequest } from './signature-mail.js';

const logger = { warn: () => undefined } as unknown as FastifyBaseLogger;

beforeEach(() => {
  delete process.env.SPARX_SITE_BASE;
  state.sms = [];
  state.published = [];
});

describe('links outside the email resolver open the right site', () => {
  it("a booking's calendar event links to its manage page on the site it was booked on", async () => {
    const ics = await loadBookingIcs('tenant-1', 'booking-1');
    // iCal folds long lines at 75 octets with CRLF + space; unfold before reading.
    const body = (ics?.body ?? '').replace(/\r\n[ \t]/g, '');
    expect(body).toMatch(/\r\nURL:https:\/\/studio\.northwind\.test\/booking\/[^\r\n]+/);
    // The organizer is the business it was booked with, not the tenant's primary site.
    expect(body).toContain('ORGANIZER;CN="Northwind Studio"');
  });

  it("a waitlist offer's text message carries a link a phone can open", async () => {
    await sendWaitlistOffer(logger, 'tenant-1', 'entry-1');
    expect(state.sms).toHaveLength(1);
    expect(state.sms[0]).toContain('https://studio.northwind.test/book/svc-1');
    expect(state.sms[0]).toContain('Northwind Studio');
  });

  it("a signing request's button opens the signing page on the document's site", async () => {
    const request = { log: logger } as unknown as FastifyRequest;
    const signature = {
      signerEmail: 'signer@example.test',
      signerName: 'Ana',
      expiresAt: new Date('2026-10-09T00:00:00Z'),
    } as unknown as BillingDocumentSignature;
    const url = await sendSignatureRequest(request, {
      documentId: 'doc-1',
      signature,
      token: 'tok-123',
      notify: true,
    });
    expect(url).toBe('https://studio.northwind.test/sign/tok-123');
    expect(state.published[0]?.props.signingUrl).toBe(url);
  });

  it('gives the same absolute link when the rep copies it instead of emailing it', async () => {
    const request = { log: logger } as unknown as FastifyRequest;
    const url = await sendSignatureRequest(request, {
      documentId: 'doc-1',
      signature: { signerEmail: 'x@y.test', expiresAt: new Date() } as BillingDocumentSignature,
      token: 'tok-123',
      notify: false,
    });
    expect(url).toBe('https://studio.northwind.test/sign/tok-123');
    expect(state.published).toHaveLength(0);
  });
});
