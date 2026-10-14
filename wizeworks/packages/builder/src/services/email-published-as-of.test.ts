// A sent broadcast's "What was sent" drew the design as it is published TODAY, so a
// design published again after the send showed the new email as the one that went
// out (sparx persona issue 161). `publishedAsOf` picks the version live at the send.

import type { BuilderEmail } from '@wizeworks/db';
import { describe, expect, it } from 'vitest';

import { publishedAsOf } from './email-service';

const OCTOBER = { version: '1', subject: 'October', preheader: '', root: { id: 'b' } };
const NOVEMBER = { version: '1', subject: 'November', preheader: '', root: { id: 'b' } };

const SENT_AT = new Date('2026-10-08T10:03:39Z');

function row(publishedAt: Date | null, published: unknown): BuilderEmail {
  return {
    id: 'e1',
    tenantId: 't1',
    name: 'Fleet winter readiness',
    subject: 'Winter is coming',
    preheader: null,
    draftTree: null,
    publishedTree: null,
    publishedAt,
    position: 0,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    propertyId: null,
    key: null,
    silicaDraftDocument: published,
    silicaPublishedDocument: published,
    trackingCampaign: null,
  } as unknown as BuilderEmail;
}

describe('the email a send used', () => {
  it('is the current one when nothing was published after the send', () => {
    const r = row(new Date('2026-10-08T09:39:11Z'), OCTOBER);
    const out = publishedAsOf(r, { document: OCTOBER, createdAt: r.publishedAt! }, SENT_AT);
    expect(out?.silicaDoc).toEqual(OCTOBER);
  });

  it('is the version live at the send when the design was published again since', () => {
    const r = row(new Date('2026-11-02T08:00:00Z'), NOVEMBER);
    const out = publishedAsOf(
      r,
      { document: OCTOBER, createdAt: new Date('2026-10-08T09:39:11Z') },
      SENT_AT
    );
    expect(out?.silicaDoc).toEqual(OCTOBER);
    expect(out?.publishedAt).toBe('2026-10-08T09:39:11.000Z');
  });

  it('is nothing when the design was published again and the sent version is not kept', () => {
    const r = row(new Date('2026-11-02T08:00:00Z'), NOVEMBER);
    expect(publishedAsOf(r, null, SENT_AT)).toBeNull();
  });

  it('is nothing for an email that was never published', () => {
    expect(publishedAsOf(row(null, null), null, SENT_AT)).toBeNull();
  });
});
