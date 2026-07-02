// Bootcamp service (docs/114 §B.5). Partner-hosted cohorts: CRUD for the host,
// tier-gated publish (only certified partners publish publicly; registered create
// drafts), and the public on-platform RSVP that drops a lead into the host
// partner's CRM. Reads for the public directory live in directory.ts.

import { randomBytes } from 'node:crypto';

import { withSystem, withTenant, type TxClient } from '@sparx/db';
import { badRequest, forbidden, notFound } from '@sparx/api-core/errors';
import {
  BootcampStatusInput,
  CreateBootcampInput,
  RegisterBootcampInput,
  UpdateBootcampInput,
} from '@sparx/partner-schemas';

import { publishPartnerEvent } from './events.js';
import type { PartnerContext } from './service.js';

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120) || 'bootcamp'
  );
}

async function uniqueSlug(tx: TxClient, title: string): Promise<string> {
  const base = slugify(title);
  for (let i = 0; i < 6; i++) {
    const slug = i === 0 ? base : `${base}-${randomBytes(2).toString('hex')}`;
    const existing = await tx.bootcamp.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return slug;
  }
  return `${base}-${randomBytes(4).toString('hex')}`;
}

async function requireActivePartner(tx: TxClient, tenantId: string) {
  const partner = await tx.partner.findUnique({
    where: { tenantId },
    select: { id: true, tier: true, status: true, displayName: true },
  });
  if (partner?.status !== 'active') {
    throw forbidden('Only active Sparx partners can host bootcamps.');
  }
  return partner;
}

function run<T>(ctx: PartnerContext, fn: (tx: TxClient) => Promise<T>): Promise<T> {
  return withTenant({ tenantId: ctx.tenantId, userId: ctx.userId ?? undefined }, fn);
}

export const bootcampService = {
  list(ctx: PartnerContext) {
    return run(ctx, (tx) =>
      tx.bootcamp.findMany({
        where: { tenantId: ctx.tenantId, deletedAt: null },
        orderBy: { startsAt: 'desc' },
      })
    );
  },

  async get(ctx: PartnerContext, id: string) {
    const bootcamp = await run(ctx, (tx) =>
      tx.bootcamp.findFirst({ where: { id, tenantId: ctx.tenantId } })
    );
    if (!bootcamp) throw notFound('Bootcamp', id);
    return bootcamp;
  },

  async create(ctx: PartnerContext, raw: unknown) {
    const input = CreateBootcampInput.parse(raw);
    const bootcamp = await run(ctx, async (tx) => {
      const partner = await requireActivePartner(tx, ctx.tenantId);
      return tx.bootcamp.create({
        data: {
          tenantId: ctx.tenantId,
          partnerId: partner.id,
          title: input.title,
          slug: await uniqueSlug(tx, input.title),
          description: input.description,
          format: input.format,
          locationCity: input.locationCity ?? null,
          locationState: input.locationState ?? null,
          locationCountry: input.locationCountry,
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          seatsTotal: input.seatsTotal ?? null,
          priceCents: input.priceCents,
          currency: input.currency,
          registrationMode: input.registrationMode,
          registrationUrl: input.registrationUrl ?? null,
          status: 'draft',
        },
      });
    });
    return bootcamp;
  },

  async update(ctx: PartnerContext, id: string, raw: unknown) {
    const input = UpdateBootcampInput.parse(raw);
    return run(ctx, async (tx) => {
      const existing = await tx.bootcamp.findFirst({ where: { id, tenantId: ctx.tenantId } });
      if (!existing) throw notFound('Bootcamp', id);
      const data: Record<string, unknown> = { ...input };
      if (input.startsAt) data.startsAt = new Date(input.startsAt);
      if (input.endsAt) data.endsAt = new Date(input.endsAt);
      return tx.bootcamp.update({ where: { id }, data });
    });
  },

  async setStatus(ctx: PartnerContext, id: string, raw: unknown) {
    const input = BootcampStatusInput.parse(raw);
    const result = await run(ctx, async (tx) => {
      const partner = await requireActivePartner(tx, ctx.tenantId);
      const existing = await tx.bootcamp.findFirst({ where: { id, tenantId: ctx.tenantId } });
      if (!existing) throw notFound('Bootcamp', id);
      // Tier gate (docs/114 §B / partners spec): only certified partners publish
      // publicly. Registered partners can build drafts but not go live.
      if (input.status === 'published' && partner.tier !== 'certified') {
        throw forbidden('Publishing bootcamps requires the Certified partner tier.');
      }
      const updated = await tx.bootcamp.update({
        where: { id },
        data: {
          status: input.status,
          publishedAt:
            input.status === 'published' && !existing.publishedAt
              ? new Date()
              : existing.publishedAt,
        },
      });
      return updated;
    });
    if (input.status === 'published') {
      await publishPartnerEvent('bootcamp.published', ctx.tenantId, ctx.userId, {
        bootcampId: id,
        slug: result.slug,
      });
    } else if (input.status === 'cancelled') {
      await publishPartnerEvent('bootcamp.cancelled', ctx.tenantId, ctx.userId, { bootcampId: id });
    }
    return result;
  },

  /** Delete is draft-only (a published/cancelled cohort is soft-kept for history). */
  async remove(ctx: PartnerContext, id: string) {
    return run(ctx, async (tx) => {
      const existing = await tx.bootcamp.findFirst({ where: { id, tenantId: ctx.tenantId } });
      if (!existing) throw notFound('Bootcamp', id);
      if (existing.status !== 'draft') throw badRequest('Only draft bootcamps can be deleted.');
      await tx.bootcamp.update({ where: { id }, data: { deletedAt: new Date() } });
      return { ok: true };
    });
  },

  /** Public on-platform RSVP (docs/114 §B.5). Resolves the published bootcamp
   *  (withSystem), then writes the registration under the HOST's tenant context +
   *  a lead in the host CRM (best-effort), handling waitlist when at capacity. */
  async register(slug: string, raw: unknown) {
    const input = RegisterBootcampInput.parse(raw);
    if (input.company_website) return { status: 'registered' as const }; // honeypot

    const bootcamp = await withSystem((tx) =>
      tx.bootcamp.findFirst({
        where: { slug, status: 'published' },
        select: {
          id: true,
          tenantId: true,
          partnerId: true,
          title: true,
          seatsTotal: true,
          seatsFilled: true,
          registrationMode: true,
        },
      })
    );
    if (!bootcamp) throw notFound('Bootcamp', slug);
    if (bootcamp.registrationMode !== 'internal') {
      throw badRequest('This bootcamp registers through an external link.');
    }

    const hostTenantId = bootcamp.tenantId;
    const result = await withTenant({ tenantId: hostTenantId }, async (tx) => {
      const existing = await tx.bootcampRegistration.findUnique({
        where: { bootcampId_email: { bootcampId: bootcamp.id, email: input.email } },
        select: { id: true, status: true },
      });
      if (existing) return { status: existing.status, crmCustomerId: null };

      const atCapacity =
        bootcamp.seatsTotal != null && bootcamp.seatsFilled + input.seats > bootcamp.seatsTotal;
      const status = atCapacity ? 'waitlisted' : 'registered';

      // Best-effort lead into the host partner's CRM (the dogfood win, docs/114 §B.5).
      let crmCustomerId: string | null = null;
      try {
        const parts = input.name.trim().split(/\s+/);
        const customer = await tx.customer.create({
          data: {
            tenantId: hostTenantId,
            type: 'prospect',
            email: input.email,
            firstName: parts[0] ?? input.name,
            lastName: parts.length > 1 ? parts.slice(1).join(' ') : null,
            tags: ['bootcamp'],
          },
          select: { id: true },
        });
        crmCustomerId = customer.id;
      } catch {
        // A CRM write hiccup (schema/RLS) must not block the RSVP — the
        // registration row is the source of truth; the lead can be re-derived.
        crmCustomerId = null;
      }

      await tx.bootcampRegistration.create({
        data: {
          tenantId: hostTenantId,
          bootcampId: bootcamp.id,
          name: input.name,
          email: input.email,
          seats: input.seats,
          status,
          crmCustomerId,
        },
      });
      if (status === 'registered') {
        await tx.bootcamp.update({
          where: { id: bootcamp.id },
          data: { seatsFilled: { increment: input.seats } },
        });
      }
      return { status, crmCustomerId };
    });

    await publishPartnerEvent('bootcamp.registration.created', hostTenantId, null, {
      bootcampId: bootcamp.id,
      partnerId: bootcamp.partnerId,
      email: input.email,
      status: result.status,
    });
    return { status: result.status };
  },
};
