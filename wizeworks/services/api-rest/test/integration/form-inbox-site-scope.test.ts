// THE FORM INBOX BELONGS TO THE SITE THE FORM IS ON.
//
// WHY THIS EXISTS. `GET /v1/forms/submissions` built a per-SITE context and then
// handed it to three service reads that took only the tenant. Its own header said
// so out loud — "list (tenant-wide, newest first) + counts" — and nothing tested
// it, so the inbox, the two numbers above it, and the form picker beside it all
// answered for every site the business runs.
//
// It had no symptom on the account that found it: a clothing maker with seven
// sites whose four replies all came from one of them (issue 629). That is the
// only reason it was still there. The moment a second site takes a message,
// somebody asking the clothing shop about sizing appears in the jewelry line's
// inbox ([[feedback_site_is_the_business]], issue 630).
//
// The counts matter as much as the rows: Home and the app rail read `counts.new`
// through the same response, so an unscoped count badges one business for
// another's post.

import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { invalidateModuleCache } from '@wizeworks/auth';
import { prisma, withTenant } from '@wizeworks/db';
import { createApp } from '../../src/app.js';
import {
  authHeader,
  createTestTenant,
  dropTestTenant,
  signToken,
  type TestTenant,
} from '../helpers.js';

async function enableBuilder(tenantId: string): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: { modules: { builder: { enabled: true } } } },
  });
  invalidateModuleCache();
}

async function createSite(t: TestTenant, name: string): Promise<string> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${crypto.randomBytes(3).toString('hex')}`;
    const row = await tx.property.create({
      data: { tenantId: t.tenantId, slug, name, isPrimary: false },
      select: { id: true },
    });
    return row.id;
  });
}

async function seedSubmission(
  t: TestTenant,
  propertyId: string,
  name: string,
  status = 'new'
): Promise<void> {
  await withTenant({ tenantId: t.tenantId }, (tx) =>
    tx.formSubmission.create({
      data: {
        tenantId: t.tenantId,
        propertyId,
        formNodeId: `form-${propertyId.slice(0, 8)}`,
        formName: 'Messages from my website',
        pageSlug: '/contact',
        status,
        name,
        email: `${name.toLowerCase()}@example.com`,
        message: 'Sizing question',
        fields: { name, message: 'Sizing question' },
        context: {},
      },
    })
  );
}

interface Body {
  data: {
    submissions: { name?: string }[];
    counts: { total: number; new: number };
    forms: { formNodeId: string }[];
  };
}

/** `inject().json()` is generic, so the shape is declared once here rather than
 *  asserted at each call site. */
function body(res: { json: <T>() => T }): Body['data'] {
  return res.json<Body>().data;
}

describe('the form inbox is the site you are standing on', () => {
  it('leaves the other business’s messages out of this one’s inbox', async () => {
    const t = await createTestTenant('owner');
    const app = await createApp();
    try {
      await enableBuilder(t.tenantId);
      const shop = t.propertyId;
      const jewelry = await createSite(t, 'Astrid Fine');
      await seedSubmission(t, shop, 'Rosalind');
      await seedSubmission(t, jewelry, 'Colette');
      await seedSubmission(t, jewelry, 'Lune');
      const token = signToken(app, t);

      const res = await app.inject({
        method: 'GET',
        url: '/v1/forms/submissions',
        headers: { ...authHeader(token), 'x-sparx-property-id': shop },
      });

      // Before the fix all three came back on both sites.
      expect(body(res).submissions.map((row) => row.name)).toEqual(['Rosalind']);
    } finally {
      await app.close();
      await dropTestTenant(t.tenantId);
    }
  });

  it('counts this site, because Home and the rail read these numbers', async () => {
    // The badge is the reason this one is not just tidiness: an unscoped count
    // puts "2 people wrote to you" on a business nobody wrote to.
    const t = await createTestTenant('owner');
    const app = await createApp();
    try {
      await enableBuilder(t.tenantId);
      const shop = t.propertyId;
      const jewelry = await createSite(t, 'Astrid Fine');
      await seedSubmission(t, shop, 'Rosalind');
      await seedSubmission(t, jewelry, 'Colette');
      await seedSubmission(t, jewelry, 'Lune');
      const token = signToken(app, t);

      const res = await app.inject({
        method: 'GET',
        url: '/v1/forms/submissions',
        headers: { ...authHeader(token), 'x-sparx-property-id': shop },
      });

      const { counts } = body(res);
      expect(counts.total, 'total').toBe(1);
      expect(counts.new, 'new — what the badge reads').toBe(1);
    } finally {
      await app.close();
      await dropTestTenant(t.tenantId);
    }
  });

  it('shows the other site its own messages, standing on the other site', async () => {
    // Scoping has to work in both directions, or it is a filter that happens to
    // hide the right rows once.
    const t = await createTestTenant('owner');
    const app = await createApp();
    try {
      await enableBuilder(t.tenantId);
      const jewelry = await createSite(t, 'Astrid Fine');
      await seedSubmission(t, t.propertyId, 'Rosalind');
      await seedSubmission(t, jewelry, 'Colette');
      const token = signToken(app, t);

      const res = await app.inject({
        method: 'GET',
        url: '/v1/forms/submissions',
        headers: { ...authHeader(token), 'x-sparx-property-id': jewelry },
      });

      expect(body(res).submissions.map((row) => row.name)).toEqual(['Colette']);
      expect(body(res).counts.new).toBe(1);
    } finally {
      await app.close();
      await dropTestTenant(t.tenantId);
    }
  });

  it('keeps a message whose site was deleted, on every site', async () => {
    // `propertyId` is SetNull precisely so a submission OUTLIVES its site, and
    // the schema says it "stays in the inbox". Strict equality would have kept
    // that promise on paper and dropped the row from every screen there is.
    const t = await createTestTenant('owner');
    const app = await createApp();
    try {
      await enableBuilder(t.tenantId);
      const gone = await createSite(t, 'Closed Line');
      await seedSubmission(t, gone, 'Orphan');
      await withTenant({ tenantId: t.tenantId }, (tx) =>
        tx.formSubmission.updateMany({ where: { name: 'Orphan' }, data: { propertyId: null } })
      );
      const token = signToken(app, t);

      const res = await app.inject({
        method: 'GET',
        url: '/v1/forms/submissions',
        headers: { ...authHeader(token), 'x-sparx-property-id': t.propertyId },
      });

      expect(body(res).submissions.map((row) => row.name)).toEqual(['Orphan']);
      expect(body(res).counts.new).toBe(1);
    } finally {
      await app.close();
      await dropTestTenant(t.tenantId);
    }
  });

  it('offers only this site’s forms in the picker beside the list', async () => {
    // The third read on the same response. A picker offering a form that exists
    // on another website filters this list to nothing and explains nothing.
    const t = await createTestTenant('owner');
    const app = await createApp();
    try {
      await enableBuilder(t.tenantId);
      const shop = t.propertyId;
      const jewelry = await createSite(t, 'Astrid Fine');
      await seedSubmission(t, shop, 'Rosalind');
      await seedSubmission(t, jewelry, 'Colette');
      const token = signToken(app, t);

      const res = await app.inject({
        method: 'GET',
        url: '/v1/forms/submissions',
        headers: { ...authHeader(token), 'x-sparx-property-id': shop },
      });

      const { forms } = body(res);
      expect(forms).toHaveLength(1);
      expect(forms[0]?.formNodeId).toBe(`form-${shop.slice(0, 8)}`);
    } finally {
      await app.close();
      await dropTestTenant(t.tenantId);
    }
  });
});
