// GET /v1/forms/definitions — every form on this site, for a picker.
//
// This exists because a campaign has to be pointed at the form that feeds it,
// and until this route there was nothing to populate that choice with. The only
// other list of forms, `submissionForms`, is derived from SUBMISSIONS — so it
// knows a form only once somebody has already filled it in, which is exactly
// backwards for setting a campaign up before it runs.
//
// What the tests pin, in order of what would hurt most if it broke:
//   1. A form with no submissions is still offered.
//   2. Another site's forms are not (a picker leaking them would let a campaign
//      be pointed at a form on a site it cannot count).
//   3. The author's name comes through, and its absence is null rather than ''.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma, withTenant } from '@wizeworks/db';
import { createApp } from '../../src/app.js';
import { authHeader, createTestTenant, dropTestTenant, signToken } from '../helpers.js';
import type { TestTenant } from '../helpers.js';

interface FormChoice {
  formNodeId: string;
  name: string | null;
  pageSlug: string | null;
}

describe('GET /v1/forms/definitions — the forms a campaign can be pointed at', () => {
  let app: FastifyInstance;
  let fixture: TestTenant;
  let token: string;
  let otherSiteId: string;

  beforeAll(async () => {
    app = await createApp();
    fixture = await createTestTenant('owner');
    token = signToken(app, fixture, 'owner');

    // Forms are a site-builder feature and the route says so.
    await prisma.tenant.update({
      where: { id: fixture.tenantId },
      data: { settings: { modules: { builder: { enabled: true } } } },
    });

    await withTenant({ tenantId: fixture.tenantId }, async (tx) => {
      const second = await tx.property.create({
        data: {
          tenantId: fixture.tenantId,
          slug: 'second-site',
          name: 'Second site',
          isPrimary: false,
        },
        select: { id: true },
      });
      otherSiteId = second.id;

      // Named, on a page.
      await tx.formDefinition.create({
        data: {
          tenantId: fixture.tenantId,
          propertyId: fixture.propertyId,
          formNodeId: 'n_contact_1',
          pageSlug: 'contact',
          recipients: [],
          config: { name: 'Ask us anything' },
        },
      });
      // Unnamed, on the home page (null slug) — the common case, and the one
      // whose label has to be built from where it is.
      await tx.formDefinition.create({
        data: {
          tenantId: fixture.tenantId,
          propertyId: fixture.propertyId,
          formNodeId: 'n_home_1',
          pageSlug: null,
          recipients: [],
          config: {},
        },
      });
      // Belongs to the OTHER site.
      await tx.formDefinition.create({
        data: {
          tenantId: fixture.tenantId,
          propertyId: otherSiteId,
          formNodeId: 'n_elsewhere_1',
          pageSlug: 'elsewhere',
          recipients: [],
          config: { name: 'Not this site' },
        },
      });
    });
  });

  afterAll(async () => {
    await dropTestTenant(fixture.tenantId);
    await app.close();
  });

  async function listed(): Promise<FormChoice[]> {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/forms/definitions',
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(200);
    const body: { data: { forms: FormChoice[] } } = res.json();
    return body.data.forms;
  }

  it('offers a form nobody has submitted yet', async () => {
    // The whole point: `submissionForms` would return an empty list here, and a
    // campaign could never be set up before its first lead.
    const forms = await listed();
    expect(forms.map((f) => f.formNodeId).sort()).toEqual(['n_contact_1', 'n_home_1']);
  });

  it('does not offer forms belonging to another site', async () => {
    const forms = await listed();
    expect(forms.map((f) => f.formNodeId)).not.toContain('n_elsewhere_1');
  });

  it("carries the author's name, and null when they never gave one", async () => {
    const forms = await listed();
    const named = forms.find((f) => f.formNodeId === 'n_contact_1');
    const unnamed = forms.find((f) => f.formNodeId === 'n_home_1');

    expect(named?.name).toBe('Ask us anything');
    expect(named?.pageSlug).toBe('contact');
    // Null, never '' — an empty string would put a blank row in the picker.
    expect(unnamed?.name).toBeNull();
    expect(unnamed?.pageSlug).toBeNull();
  });
});
