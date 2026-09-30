// End-to-end entry lifecycle: create → list → fetch → update (autosave
// revision) → publish → revisions list → unpublish → restore → delete.
// Verifies side effects (revisions, audit_logs, publishedAt) along the way.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma, withTenant } from '@wizeworks/db';
import { createApp } from '../../src/app.js';
import {
  type TestTenant,
  authHeader,
  createTestTenant,
  dropTestTenant,
  signToken,
} from '../helpers.js';

describe('content entry lifecycle', () => {
  let app: FastifyInstance;
  let tenant: TestTenant;
  let token: string;
  let entryId: string;

  beforeAll(async () => {
    app = await createApp();
    tenant = await createTestTenant('owner');
    token = signToken(app, tenant);
  });

  afterAll(async () => {
    await app.close();
    await dropTestTenant(tenant.tenantId);
  });

  it('POST creates a blog_post + initial revision', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/content/entries',
      headers: authHeader(token),
      payload: {
        type_key: 'blog_post',
        slug: 'lifecycle',
        body: {
          title: 'Lifecycle',
          excerpt: 'Initial.',
          body: { type: 'doc', content: [] },
        },
      },
    });
    expect(res.statusCode).toBe(201);
    entryId = res.json().data.id;

    const revisions = await withTenant({ tenantId: tenant.tenantId }, (tx) =>
      tx.contentRevision.findMany({ where: { entryId } })
    );
    expect(revisions.length).toBe(1);
    expect(revisions[0]?.kind).toBe('manual');
  });

  it('PATCH adds an autosave revision', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/content/entries/${entryId}`,
      headers: authHeader(token),
      payload: {
        body: {
          title: 'Lifecycle v2',
          excerpt: 'Updated.',
          body: { type: 'doc', content: [] },
        },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.body.title).toBe('Lifecycle v2');

    const revisions = await withTenant({ tenantId: tenant.tenantId }, (tx) =>
      tx.contentRevision.findMany({
        where: { entryId },
        orderBy: { revisionNumber: 'desc' },
      })
    );
    expect(revisions.length).toBe(2);
    expect(revisions[0]?.kind).toBe('autosave');
  });

  // ── Which of her sites show a page (issue 867) ───────────────────────────
  //
  // The endpoint has always carried this: GET-one returns `propertyIds`, its own
  // comment naming the control it is for ("the editor needs the current site
  // scope to pre-fill its 'Visible on sites' control"), and POST/PATCH accept
  // `property_ids`. No console ever drew or sent it. Measured 2026-09-28: 154
  // junction rows across 143 entries, so the feature is in daily use through the
  // create default — one tenant has 7 sites and 24 of its 30 pages pinned to 6 of
  // them, and its owner had no way to see which.

  it('PATCH sets which sites show a page, and echoes them back', async () => {
    const second = await withTenant({ tenantId: tenant.tenantId }, (tx) =>
      tx.property.create({
        data: {
          tenantId: tenant.tenantId,
          name: 'Second site',
          slug: 'second-site',
          isPrimary: false,
          status: 'active',
          settings: {},
        },
        select: { id: true },
      })
    );

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/content/entries/${entryId}`,
      headers: authHeader(token),
      payload: { property_ids: [second.id] },
    });
    expect(res.statusCode).toBe(200);
    // THE ECHO IS THE POINT. Without it the editor reads `undefined`, which the
    // "every site" shape spells as the empty list, so the pane would show "every
    // site" the instant she pinned a page to one and the next save would widen it.
    expect(res.json().data.propertyIds).toEqual([second.id]);

    const stored = await withTenant({ tenantId: tenant.tenantId }, (tx) =>
      tx.contentEntryProperty.findMany({ where: { entryId }, select: { propertyId: true } })
    );
    expect(stored.map((row) => row.propertyId)).toEqual([second.id]);

    const fetched = await app.inject({
      method: 'GET',
      url: `/v1/content/entries/${entryId}`,
      headers: authHeader(token),
    });
    expect(fetched.json().data.propertyIds).toEqual([second.id]);
  });

  it('PATCH with an empty list means every site', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/content/entries/${entryId}`,
      headers: authHeader(token),
      payload: { property_ids: [] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.propertyIds).toEqual([]);
  });

  it('a PATCH that says nothing about sites leaves them alone', async () => {
    // The partial-update footgun. An omitted key must not be read as "clear it",
    // or every ordinary save from an editor without the control would unpin every
    // page on the platform.
    const site = await withTenant({ tenantId: tenant.tenantId }, (tx) =>
      tx.property.findFirstOrThrow({ where: { isPrimary: true }, select: { id: true } })
    );
    await app.inject({
      method: 'PATCH',
      url: `/v1/content/entries/${entryId}`,
      headers: authHeader(token),
      payload: { property_ids: [site.id] },
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/content/entries/${entryId}`,
      headers: authHeader(token),
      payload: { slug: 'lifecycle-renamed' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.propertyIds).toEqual([site.id]);
  });

  it('the LIST carries which sites show each page, pinned and not', async () => {
    // Issue 870. The editor got this control in 867; the list it is opened FROM
    // still drew nothing, so a page every one of her businesses publishes looked
    // exactly like one belonging to the site she was standing on. She sees the
    // list first, and she decides what to open from it.
    const site = await withTenant({ tenantId: tenant.tenantId }, (tx) =>
      tx.property.findFirstOrThrow({ where: { isPrimary: true }, select: { id: true } })
    );

    await app.inject({
      method: 'PATCH',
      url: `/v1/content/entries/${entryId}`,
      headers: authHeader(token),
      payload: { property_ids: [site.id] },
    });

    const pinned = await app.inject({
      method: 'GET',
      url: '/v1/content/entries',
      headers: authHeader(token),
    });
    expect(pinned.statusCode).toBe(200);
    const pinnedRow = pinned.json().data.find((row: { id: string }) => row.id === entryId);
    expect(pinnedRow).toBeDefined();
    expect(pinnedRow.propertyIds).toEqual([site.id]);

    // And the other shape. "Every site" is the EMPTY list, not a missing key:
    // a row whose scope never arrived is indistinguishable from a row on every
    // site, which is the whole distinction the column exists to draw.
    await app.inject({
      method: 'PATCH',
      url: `/v1/content/entries/${entryId}`,
      headers: authHeader(token),
      payload: { property_ids: [] },
    });

    const everywhere = await app.inject({
      method: 'GET',
      url: '/v1/content/entries',
      headers: authHeader(token),
    });
    const everyRow = everywhere.json().data.find((row: { id: string }) => row.id === entryId);
    expect(everyRow.propertyIds).toEqual([]);
  });

  it('POST /publish flips status to published + sets publishedAt', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/content/entries/${entryId}/publish`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('published');
    expect(res.json().data.published_at).not.toBeNull();
  });

  it('POST /publish with a future scheduled_at flips to scheduled', async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/content/entries/${entryId}/publish`,
      headers: authHeader(token),
      payload: { scheduled_at: future },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('scheduled');
    expect(res.json().data.scheduled_at).toBe(future);
  });

  it('POST /unpublish returns the entry to draft', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/content/entries/${entryId}/unpublish`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('draft');
  });

  it('revisions list returns metadata, ordered newest first', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/content/entries/${entryId}/revisions`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(200);
    const rows = res.json().data as { revision_number: number; kind: string }[];
    expect(rows.length).toBeGreaterThanOrEqual(4);
    const numbers = rows.map((r) => r.revision_number);
    expect(numbers).toEqual([...numbers].sort((a, b) => b - a));
  });

  it('DELETE soft-deletes (deletedAt set, row stays in DB)', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/content/entries/${entryId}`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(204);

    // The entry stays in the DB but is hidden from the list endpoint.
    const list = await app.inject({
      method: 'GET',
      url: '/v1/content/entries',
      headers: authHeader(token),
    });
    expect(list.json().data.map((e: { id: string }) => e.id)).not.toContain(entryId);

    const row = await withTenant({ tenantId: tenant.tenantId }, (tx) =>
      tx.contentEntry.findFirst({ where: { id: entryId } })
    );
    expect(row?.deletedAt).not.toBeNull();
  });

  it('audit_logs records each lifecycle action', async () => {
    const rows = await withTenant({ tenantId: tenant.tenantId }, (tx) =>
      tx.auditLog.findMany({
        where: { entityType: 'content_entry', entityId: entryId },
        orderBy: { createdAt: 'asc' },
      })
    );
    const actions = rows.map((r) => r.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'content.entry.created',
        'content.entry.updated',
        'content.entry.published',
        'content.entry.scheduled',
        'content.entry.unpublished',
        'content.entry.deleted',
      ])
    );
  });
});

// Force prisma to flush its connection pool when the suite ends so pnpm
// doesn't hang on idle handles.
afterAll(async () => {
  await prisma.$disconnect();
});
