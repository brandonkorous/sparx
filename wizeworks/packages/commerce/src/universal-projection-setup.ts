// Universal-search projectors for the rest of what an owner names on a screen of
// its own (persona issue 261): bookable services, the people and equipment they
// need, places, booking rules, content types, tags and topics, webhooks, tracked
// campaigns, AI instructions, team members and saved pieces of a page.
//
// Same contract as every other projector: read Prisma through `withTenant`, give
// the owner's name as the title and something new on the line under it, carry
// the real module slug that gates the screen. Signalled from each module's write
// path; the scheduling and staff writes are signalled from their api-rest routes,
// because those two packages publish no events of their own.

import { withTenant } from '@wizeworks/db';
import {
  type EntityProjector,
  type ProjectorContext,
  type UniversalSearchDocument,
  universalId,
} from '@wizeworks/search';

import { codeAsWords } from './search-words';
import { epoch, keywords, pickString, snippet } from './universal-projection-kit';

// ─── scheduling: a bookable service ──────────────────────────────────────────

const BOOKING_KINDS: Record<string, string> = {
  appointment: 'appointment',
  class: 'class',
  reservation: 'reservation',
  rental: 'rental',
};

function minutesWords(minutes: number): string {
  if (minutes % 60 === 0 && minutes >= 60) {
    const hours = minutes / 60;
    return hours === 1 ? '1 hour' : `${String(hours)} hours`;
  }
  return `${String(minutes)} minutes`;
}

const schedulingServiceProjector: EntityProjector = {
  entityType: 'scheduling_service',
  module: 'scheduling',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.schedulingService.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const s = await tx.schedulingService.findFirst({ where: { id, deletedAt: null } });
      if (!s) return null;
      const kind = BOOKING_KINDS[s.bookingType] ?? codeAsWords(s.bookingType).toLowerCase();
      return {
        id: universalId(ctx.tenantId, 'scheduling_service', s.id),
        tenant_id: ctx.tenantId,
        entity_type: 'scheduling_service',
        module: 'scheduling',
        record_id: s.id,
        title: s.name,
        subtitle: `A ${minutesWords(s.durationMinutes)} ${kind}`,
        body: snippet(s.description),
        status: s.isActive ? 'active' : 'inactive',
        url: `/scheduling/services/${s.id}`,
        created_at: epoch(s.createdAt),
        updated_at: epoch(s.updatedAt),
      };
    }),
};

// ─── scheduling: a person or a piece of equipment that gets booked ───────────

/** The words the scheduling screens group these by. */
const RESOURCE_KINDS: Record<string, string> = {
  staff: 'A person you book',
  space: 'A room or space',
  table: 'A table',
  equipment: 'A machine or tool',
  asset: 'Something you hire out',
};

const schedulingResourceProjector: EntityProjector = {
  entityType: 'scheduling_resource',
  module: 'scheduling',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.schedulingResource.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const r = await tx.schedulingResource.findFirst({ where: { id, deletedAt: null } });
      if (!r) return null;
      return {
        id: universalId(ctx.tenantId, 'scheduling_resource', r.id),
        tenant_id: ctx.tenantId,
        entity_type: 'scheduling_resource',
        module: 'scheduling',
        record_id: r.id,
        title: r.name,
        subtitle: RESOURCE_KINDS[r.kind] ?? codeAsWords(r.kind),
        body: snippet(r.description),
        keywords: keywords(r.skillTags),
        status: r.isActive ? 'active' : 'inactive',
        url: `/scheduling/people-and-equipment/${r.id}`,
        created_at: epoch(r.createdAt),
        updated_at: epoch(r.updatedAt),
      };
    }),
};

// ─── scheduling: a place ─────────────────────────────────────────────────────

const schedulingLocationProjector: EntityProjector = {
  entityType: 'scheduling_location',
  module: 'scheduling',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.businessLocation.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const l = await tx.businessLocation.findFirst({ where: { id } });
      if (!l) return null;
      const address = (l.address ?? {}) as Record<string, unknown>;
      const street = pickString(address.line1);
      const city = pickString(address.city);
      const region = pickString(address.region);
      const where = [street, city].filter(Boolean).join(', ');
      return {
        id: universalId(ctx.tenantId, 'scheduling_location', l.id),
        tenant_id: ctx.tenantId,
        entity_type: 'scheduling_location',
        module: 'scheduling',
        record_id: l.id,
        title: l.name,
        subtitle: where || 'No address yet',
        keywords: keywords([street, city, region, pickString(address.postalCode)]),
        status: l.isActive ? 'active' : 'inactive',
        url: `/scheduling/places/${l.id}`,
        created_at: epoch(l.createdAt),
        updated_at: epoch(l.updatedAt),
      };
    }),
};

// ─── scheduling: a set of booking rules ──────────────────────────────────────

const DEPOSIT_WORDS: Record<string, string> = {
  card_hold: 'Holds a card',
  deposit: 'Takes a deposit',
  prepay: 'Paid in full when booked',
};

const bookingPolicyProjector: EntityProjector = {
  entityType: 'booking_policy',
  module: 'scheduling',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.bookingPolicy.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const p = await tx.bookingPolicy.findFirst({ where: { id } });
      if (!p) return null;
      const hours = p.cancellationWindowHours;
      const cancel =
        hours > 0
          ? `free to cancel up to ${hours === 1 ? '1 hour' : `${String(hours)} hours`} before`
          : 'free to cancel any time';
      const deposit = DEPOSIT_WORDS[p.depositType];
      const line = deposit
        ? `${deposit}, ${cancel}`
        : `${cancel.charAt(0).toUpperCase()}${cancel.slice(1)}`;
      return {
        id: universalId(ctx.tenantId, 'booking_policy', p.id),
        tenant_id: ctx.tenantId,
        entity_type: 'booking_policy',
        module: 'scheduling',
        record_id: p.id,
        title: p.name,
        subtitle: line,
        body: snippet(p.policyText),
        url: `/scheduling/booking-rules/${p.id}`,
        created_at: epoch(p.createdAt),
        updated_at: epoch(p.updatedAt),
      };
    }),
};

// ─── cms: a content type ─────────────────────────────────────────────────────
//
// Addressed by KEY (`/content/types/:key`); the entry is keyed by it too. Titled
// by the plural, which is what the content types screen lists.

const contentTypeProjector: EntityProjector = {
  entityType: 'content_type',
  module: 'cms',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.contentType.findMany({ select: { key: true }, distinct: ['key'] });
      return rows.map((r) => r.key);
    }),
  project: (ctx: ProjectorContext, key: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      // A built-in the tenant has edited exists twice: their copy wins, as on screen.
      const t = await tx.contentType.findFirst({
        where: { key },
        orderBy: [{ isBuiltIn: 'asc' }, { updatedAt: 'desc' }],
      });
      if (!t) return null;
      return {
        id: universalId(ctx.tenantId, 'content_type', t.key),
        tenant_id: ctx.tenantId,
        entity_type: 'content_type',
        module: 'cms',
        record_id: t.key,
        title: t.pluralName,
        subtitle:
          snippet(t.description, 120) ??
          (t.isSingleton
            ? 'One page of its own'
            : t.isBuiltIn
              ? 'Comes with your account'
              : 'A kind of content you added'),
        body: snippet(t.description),
        keywords: keywords([t.name]),
        url: `/content/types/${encodeURIComponent(t.key)}`,
        created_at: epoch(t.createdAt),
        updated_at: epoch(t.updatedAt),
      };
    }),
};

// ─── cms: a list of tags or topics (taxonomy) ────────────────────────────────

const taxonomyProjector: EntityProjector = {
  entityType: 'taxonomy',
  module: 'cms',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.taxonomy.findMany({ select: { key: true } });
      return rows.map((r) => r.key);
    }),
  project: (ctx: ProjectorContext, key: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const t = await tx.taxonomy.findFirst({ where: { key } });
      if (!t) return null;
      return {
        id: universalId(ctx.tenantId, 'taxonomy', t.key),
        tenant_id: ctx.tenantId,
        entity_type: 'taxonomy',
        module: 'cms',
        record_id: t.key,
        title: t.pluralName,
        // Read from this row only, so adding a tag never leaves the entry stale.
        subtitle: t.hierarchical
          ? `${t.pluralName} that can sit inside one another`
          : `A simple list of ${t.pluralName.toLowerCase()}`,
        keywords: keywords([t.name]),
        url: `/content/tags/${encodeURIComponent(t.key)}`,
        created_at: epoch(t.createdAt),
        updated_at: epoch(t.updatedAt),
      };
    }),
};

// ─── cms: a webhook ──────────────────────────────────────────────────────────
//
// Where it sends, by host only: the full address can carry a token, and the
// signing secret is never read here.

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).host || undefined;
  } catch {
    return undefined;
  }
}

const webhookProjector: EntityProjector = {
  entityType: 'webhook',
  module: 'cms',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.webhookSubscription.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const w = await tx.webhookSubscription.findFirst({
        where: { id },
        select: {
          id: true,
          name: true,
          url: true,
          active: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!w) return null;
      const host = hostOf(w.url);
      return {
        id: universalId(ctx.tenantId, 'webhook', w.id),
        tenant_id: ctx.tenantId,
        entity_type: 'webhook',
        module: 'cms',
        record_id: w.id,
        title: w.name,
        subtitle: host ? `Sends to ${host}` : 'Sends to another app',
        keywords: keywords([host]),
        status: w.active ? 'active' : 'paused',
        url: `/content/webhooks/${w.id}`,
        created_at: epoch(w.createdAt),
        updated_at: epoch(w.updatedAt),
      };
    }),
};

// ─── funnels: a tracked campaign ─────────────────────────────────────────────

/** The campaign screen's own words for each kind. */
const FUNNEL_KINDS: Record<string, string> = {
  lead: 'Finding new customers',
  recovery: 'Winning back a lost sale',
  purchase: 'Selling something',
  booking: 'Filling the calendar',
  winback: 'Bringing people back',
  custom: 'Something else',
};

const funnelProjector: EntityProjector = {
  entityType: 'funnel',
  module: 'funnels',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.funnel.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const f = await tx.funnel.findFirst({ where: { id } });
      if (!f) return null;
      return {
        id: universalId(ctx.tenantId, 'funnel', f.id),
        tenant_id: ctx.tenantId,
        entity_type: 'funnel',
        module: 'funnels',
        record_id: f.id,
        title: f.name,
        subtitle: snippet(f.description, 120) ?? FUNNEL_KINDS[f.kind] ?? codeAsWords(f.kind),
        body: snippet(f.description),
        status: f.status,
        url: `/campaigns/${f.id}`,
        created_at: epoch(f.createdAt),
        updated_at: epoch(f.updatedAt),
      };
    }),
};

// ─── ai: an instruction ──────────────────────────────────────────────────────
//
// Name and what it is for. The instruction's own words stay out of the index:
// a persona or a ready answer can run long, and the name is what is typed.

/** The instructions screen's own words for each category. */
const PROMPT_CATEGORIES: Record<string, string> = {
  persona: 'Assistant personality',
  support: 'Customer support replies',
  email: 'Email writing',
  product: 'Product descriptions',
  seo: 'Search wording',
  social: 'Social posts',
  crm: 'Customer notes',
  general: 'General',
};

const aiPromptProjector: EntityProjector = {
  entityType: 'ai_prompt',
  module: 'ai',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.aiPromptTemplate.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const p = await tx.aiPromptTemplate.findFirst({ where: { id } });
      if (!p) return null;
      return {
        id: universalId(ctx.tenantId, 'ai_prompt', p.id),
        tenant_id: ctx.tenantId,
        entity_type: 'ai_prompt',
        module: 'ai',
        record_id: p.id,
        title: p.name,
        subtitle:
          snippet(p.description, 120) ?? PROMPT_CATEGORIES[p.category] ?? codeAsWords(p.category),
        body: snippet(p.description),
        status: p.enabled ? 'active' : 'inactive',
        url: `/ai/instructions/${p.id}`,
        created_at: epoch(p.createdAt),
        updated_at: epoch(p.updatedAt),
      };
    }),
};

// ─── staff: a team member ────────────────────────────────────────────────────
//
// Someone who has left stays findable, as they stay on the people screen: their
// hours are in last year's numbers.

const EMPLOYMENT_WORDS: Record<string, string> = {
  employee: 'Employee',
  contractor: 'Contractor',
  volunteer: 'Volunteer',
};

const staffMemberProjector: EntityProjector = {
  entityType: 'staff_member',
  module: 'staff',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.staffMember.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const m = await tx.staffMember.findFirst({ where: { id } });
      if (!m) return null;
      const name = [m.firstName, m.lastName].filter(Boolean).join(' ').trim() || m.firstName;
      return {
        id: universalId(ctx.tenantId, 'staff_member', m.id),
        tenant_id: ctx.tenantId,
        entity_type: 'staff_member',
        module: 'staff',
        record_id: m.id,
        title: name,
        subtitle: pickString(m.jobTitle) ?? EMPLOYMENT_WORDS[m.employmentType] ?? 'On your team',
        keywords: keywords([m.email, m.phone, m.jobTitle]),
        status: m.archivedAt ? 'archived' : m.status,
        url: `/team/people/${m.id}`,
        created_at: epoch(m.createdAt),
        updated_at: epoch(m.updatedAt),
      };
    }),
};

// ─── builder: a saved piece ──────────────────────────────────────────────────
//
// Addressed by KEY (`/builder/saved-pieces/:key`), fixed once made.

const builderComponentProjector: EntityProjector = {
  entityType: 'builder_component',
  module: 'builder',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.builderComponent.findMany({ select: { key: true } });
      return rows.map((r) => r.key);
    }),
  project: (ctx: ProjectorContext, key: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const c = await tx.builderComponent.findFirst({ where: { key } });
      if (!c) return null;
      return {
        id: universalId(ctx.tenantId, 'builder_component', c.key),
        tenant_id: ctx.tenantId,
        entity_type: 'builder_component',
        module: 'builder',
        record_id: c.key,
        title: c.name,
        subtitle: snippet(c.description, 120) ?? 'A piece you saved to use again',
        body: snippet(c.description),
        url: `/builder/saved-pieces/${encodeURIComponent(c.key)}`,
        created_at: epoch(c.createdAt),
        updated_at: epoch(c.updatedAt),
      };
    }),
};

export const setupOwnerNamedProjectors: EntityProjector[] = [
  schedulingServiceProjector,
  schedulingResourceProjector,
  schedulingLocationProjector,
  bookingPolicyProjector,
  contentTypeProjector,
  taxonomyProjector,
  webhookProjector,
  funnelProjector,
  aiPromptProjector,
  staffMemberProjector,
  builderComponentProjector,
];
