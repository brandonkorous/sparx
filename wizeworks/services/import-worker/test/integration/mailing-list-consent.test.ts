// Importing a mailing list has to produce a mailing list.
//
// The opt-in column was read for one thing only: `do_not_contact`. That flag says
// nobody has objected — it is not permission. Being SUBSCRIBED needs
// `gdpr_consent.scope` to hold `marketing`, and the importer never wrote it, so a
// shop mapped its "Accepts Marketing" column, imported twenty-five contacts, opened
// the built-in "Newsletter Subscribers" group and found nobody in it. Every contact
// showed as contactable one screen away, which is what made it look fine.
//
// The asymmetry the write path already documents governs this too: only an explicit
// yes becomes permission, because a contact wrongly marked no can be asked again and
// a contact wrongly marked yes is an unlawful send.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import pino from 'pino';
import { prisma, withTenant } from '@wizeworks/db';
import { getProcessor, type ImportRow, type ProcessorContext } from '../../src/processors/index.js';

const logger = pino({ level: 'silent' });

let ctx: ProcessorContext;
let tenantId: string;

/** Four contacts covering what a real export puts in that column: an explicit yes,
 *  an explicit no, a blank, and a word nobody's importer recognises. */
const ROWS: ImportRow[] = [
  { email: 'wren@example.test', first_name: 'Wren', accepts_marketing: 'yes' },
  { email: 'ada@example.test', first_name: 'Ada', accepts_marketing: 'subscribed' },
  { email: 'niall@example.test', first_name: 'Niall', accepts_marketing: 'no' },
  { email: 'mira@example.test', first_name: 'Mira', accepts_marketing: '' },
  { email: 'ol@example.test', first_name: 'Ol', accepts_marketing: 'pending confirmation' },
];

async function runImport(rows: ImportRow[]): Promise<void> {
  const processor = getProcessor('customers');
  if (!processor) throw new Error('no customers processor');
  await processor.run(ctx, rows, { upsert: true }, logger);
}

async function consentByEmail(): Promise<Record<string, { marketing: boolean; blocked: boolean }>> {
  const customers = await withTenant({ tenantId }, (tx) =>
    tx.customer.findMany({ select: { email: true, gdprConsent: true, doNotContact: true } })
  );
  return Object.fromEntries(
    customers.map((c) => {
      const consent = (c.gdprConsent ?? {}) as { scope?: unknown };
      const scope = Array.isArray(consent.scope) ? consent.scope : [];
      return [c.email ?? '', { marketing: scope.includes('marketing'), blocked: c.doNotContact }];
    })
  );
}

beforeAll(async () => {
  const slug = `consent-${crypto.randomBytes(4).toString('hex')}`;
  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name: `Consent ${slug}`,
      email: `${slug}@sparx.test`,
      plan: 'starter',
      status: 'active',
      settings: {},
    },
  });
  tenantId = tenant.id;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    await tx.property.create({
      data: { tenantId, slug: 'primary', name: `Consent ${slug}`, isPrimary: true },
    });
  });
  ctx = { tenantId, tenantSlug: slug };
});

afterAll(async () => {
  await prisma.tenant.delete({ where: { id: tenantId } });
});

describe('a mailing list arrives as a mailing list', () => {
  it('records marketing consent for the people who said yes, and only them', async () => {
    await runImport(ROWS);
    const seen = await consentByEmail();

    expect(seen['wren@example.test']).toEqual({ marketing: true, blocked: false });
    expect(seen['ada@example.test']).toEqual({ marketing: true, blocked: false });

    // An explicit no is blocked AND unsubscribed.
    expect(seen['niall@example.test']).toEqual({ marketing: false, blocked: true });
    // A blank column is not a refusal — they can be contacted — but it is not
    // permission either, so they are not on the newsletter.
    expect(seen['mira@example.test']).toEqual({ marketing: false, blocked: false });
    // An unconfirmed opt-in from somebody else's platform is not permission.
    expect(seen['ol@example.test']).toEqual({ marketing: false, blocked: true });
  });

  it('says where the consent came from, and does not invent a date for it', async () => {
    const wren = await withTenant({ tenantId }, (tx) =>
      tx.customer.findFirst({ where: { email: 'wren@example.test' } })
    );
    const consent = (wren?.gdprConsent ?? {}) as Record<string, unknown>;

    expect(consent.source).toBe('import');
    // The file does not say WHEN they agreed. Stamping the import time would put a
    // measurement on a thing nobody measured.
    expect(consent.grantedAt).toBeUndefined();
  });

  it('never revokes a consent already on file when the same list is imported again', async () => {
    // The second file has them down as no. That blocks the send, which is the part
    // that matters — but erasing the record of a consent they once gave would
    // destroy the evidence for mail already sent under it.
    await runImport([{ email: 'wren@example.test', first_name: 'Wren', accepts_marketing: 'no' }]);
    const seen = await consentByEmail();

    expect(seen['wren@example.test']).toEqual({ marketing: true, blocked: true });
  });
});
