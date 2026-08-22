// Operator announcements — the header notice bar's write side.
//
//   GET    /internal/operator/announcements[?brand=&surface=]
//   POST   /internal/operator/announcements
//   PATCH  /internal/operator/announcements/:id
//   DELETE /internal/operator/announcements/:id
//
// Same Layer-5 shared-secret auth as the other operator routes; the admin app is
// the capability gate (`announcement:manage`) and the wize_admin audit writer.
//
// `platform_announcements` is a PLATFORM table — no tenant id, no RLS, and no
// tenant-facing write path — so there is no `withTenant` here and no tenant
// audit row to stamp. The audit for these lives in wize_admin beside the
// operator who made the change, which is the only party involved.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@wizeworks/db';
import type { OperatorAnnouncement, OperatorAnnouncementListResult } from '@wizeworks/operator';

import { authorizeOperator, badRequest, notFound, operatorIdOf } from './operator-internal.js';
import {
  ANNOUNCEMENT_SURFACES,
  ANNOUNCEMENT_TONES,
  listAnnouncements,
  serializeAnnouncement,
} from '../../lib/announcements.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Brands this platform actually operates. A free-form string here is how a
 *  notice ends up scoped to `Piggles` and visible on nothing. */
const BRANDS = ['sparx', 'piggles'] as const;

/** An empty string from a form field means "cleared", not "the empty string" —
 *  every optional text field on this record is nullable and none of them mean
 *  anything blank. */
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v !== undefined && v !== null && v.length > 0 ? v : null));

const nullableDate = z
  .string()
  .datetime()
  .nullish()
  .transform((v) => (v ? new Date(v) : null));

const Base = z.object({
  platformBrand: z.enum(BRANDS),
  surfaces: z.array(z.enum(ANNOUNCEMENT_SURFACES)).min(1).max(3),
  message: z.string().trim().min(1).max(300),
  linkLabel: nullableText(60),
  linkHref: nullableText(2000),
  tone: z.enum(ANNOUNCEMENT_TONES).default('primary'),
  dismissible: z.boolean().default(true),
  startsAt: nullableDate,
  endsAt: nullableDate,
  isActive: z.boolean().default(false),
  priority: z.number().int().min(0).max(1000).default(0),
});

const CreateSchema = Base;
const PatchSchema = Base.partial();

/**
 * The two rules a notice has to satisfy before it is worth storing, checked in
 * one place so create and patch cannot drift.
 *
 * A label with no href renders a button that does nothing, and an href with no
 * label renders nothing at all — both are silent, which is why they are rejected
 * loudly here rather than discovered on the live site. The window rule is the
 * same shape: a notice whose end precedes its start is one nobody will ever see,
 * and it will read as "scheduled" in the console forever.
 */
function assertCoherent(next: {
  linkLabel?: string | null;
  linkHref?: string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
}): void {
  const hasLabel = Boolean(next.linkLabel);
  const hasHref = Boolean(next.linkHref);
  if (hasLabel !== hasHref) {
    throw badRequest('A link needs both a label and an address, or neither.');
  }
  if (next.startsAt && next.endsAt && next.endsAt <= next.startsAt) {
    throw badRequest('The end of the window must come after its start.');
  }
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const operatorAnnouncementRoutes: FastifyPluginAsync = async (app) => {
  const opts = { logLevel: 'warn' as const, schema: { hide: true } };

  app.get<{ Querystring: { brand?: string; surface?: string } }>(
    '/internal/operator/announcements',
    opts,
    async (request) => {
      authorizeOperator(request);
      const surface = request.query.surface;
      if (surface && !ANNOUNCEMENT_SURFACES.includes(surface as never)) {
        throw badRequest('Unknown surface.');
      }
      const result: OperatorAnnouncementListResult = {
        announcements: await listAnnouncements({
          brand: request.query.brand,
          surface: surface as never,
        }),
      };
      return result;
    }
  );

  app.post('/internal/operator/announcements', opts, async (request) => {
    authorizeOperator(request);
    const parsed = CreateSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest(firstIssue(parsed.error));
    assertCoherent(parsed.data);

    const row = await prisma.platformAnnouncement.create({
      data: { ...parsed.data, createdBy: operatorIdOf(request) },
    });
    const result: OperatorAnnouncement = serializeAnnouncement(row);
    return result;
  });

  app.patch<{ Params: { id: string } }>(
    '/internal/operator/announcements/:id',
    opts,
    async (request) => {
      authorizeOperator(request);
      const { id } = request.params;
      if (!UUID_RE.test(id)) throw badRequest('Invalid announcement id.');

      const parsed = PatchSchema.safeParse(request.body);
      if (!parsed.success) throw badRequest(firstIssue(parsed.error));

      const existing = await prisma.platformAnnouncement.findUnique({ where: { id } });
      if (!existing) throw notFound('Announcement not found.');

      // Coherence is a property of the RESULTING row, not of the patch: turning a
      // notice off must not be rejected because the row it is editing has a link.
      assertCoherent({ ...existing, ...parsed.data });

      const row = await prisma.platformAnnouncement.update({
        where: { id },
        data: parsed.data,
      });
      const result: OperatorAnnouncement = serializeAnnouncement(row);
      return result;
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/internal/operator/announcements/:id',
    opts,
    async (request, reply) => {
      authorizeOperator(request);
      const { id } = request.params;
      if (!UUID_RE.test(id)) throw badRequest('Invalid announcement id.');

      const existing = await prisma.platformAnnouncement.findUnique({ where: { id } });
      if (!existing) throw notFound('Announcement not found.');

      await prisma.platformAnnouncement.delete({ where: { id } });
      return reply.code(204).send();
    }
  );
};

/** The first validation complaint, in words an operator can act on. Zod's own
 *  message is already written for a person; the path is what says WHICH field. */
function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'That announcement is not valid.';
  const field = issue.path.join('.');
  return field ? `${field}: ${issue.message}` : issue.message;
}

export default operatorAnnouncementRoutes;
