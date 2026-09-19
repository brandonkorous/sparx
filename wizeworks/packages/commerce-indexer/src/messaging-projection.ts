// Universal-search projectors for the things a business WRITES to its people:
// email campaigns, automatic emails, and the rules that fire them.
//
// ── WHY THIS EXISTS ───────────────────────────────────────────────────────────
//
// The console's search box says "What do you want to do?" and searches two
// things at once: the screens in the console, and the records in the business.
// When the record half finds nothing it says so out loud:
//
//   "Nothing in your records matches “welcome”. Everything below is a screen."
//
// That sentence is deliberately unqualified. `launcher-rows.tsx` explains why:
// it used to list what it looked through, got it wrong twice, and the fix was to
// grow the index rather than keep the caveat in step. So an un-indexed record is
// not a gap in a list somewhere — it is that sentence telling an owner her
// business contains nothing by that name while the thing sits on screen behind
// the box. Typing "welcome" with **Welcome series** open in the pane behind it
// answered "Nothing in your records matches".
//
// `registry.ts` has said "Phase 2 appends CMS / Email / Site Builder bundles
// here" since Phase 1 shipped. This is the Email one, plus automations, which
// belong with it because a rule is what puts a person into a sequence.
// [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// Measured 2026-09-18: 16 campaigns, 15 sequences and 2,411 rules on this
// platform, and not one of them findable from the box that offers to find
// things.
//
// ── WHY THEY LIVE HERE AND NOT IN THE EMAIL PACKAGES ─────────────────────────
//
// A projector reads Prisma directly — `tx.broadcast`, never a service — so
// it needs `@wizeworks/db` and nothing else. Putting these in
// `@wizeworks/email-platform` or `@wizeworks/automation` would add a dependency
// edge from the indexer to a service layer it does not otherwise use, for code
// that does not use that service layer either. The commerce bundle is in
// `@wizeworks/commerce` for the mirror-image reason: the indexer already
// depended on it.
//
// The package is called `commerce-indexer` and its own description already says
// "sparx search indexer" — it runs `search.reindex.requested` for every kind of
// record on the platform, commerce or not. This file is named for what it
// carries so the next reader is not looking for email inside commerce.

import { withTenant } from '@wizeworks/db';
import {
  type EntityProjector,
  type ProjectorContext,
  type UniversalSearchDocument,
  universalId,
  PLATFORM_MODULE,
} from '@wizeworks/search';

function epoch(d: Date | null | undefined): number {
  return d ? Math.floor(d.getTime() / 1000) : 0;
}

/** Drop nullish/empty entries; undefined when nothing is left, so the optional
 *  Typesense field is omitted rather than stored as `[]`. */
function keywords(values: (string | null | undefined)[]): string[] | undefined {
  const out = values
    .map((v) => v?.trim())
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
  return out.length > 0 ? Array.from(new Set(out)) : undefined;
}

/** Cap free text so the index stays lean. */
function snippet(s: string | null | undefined, max = 2000): string | undefined {
  if (!s) return undefined;
  const trimmed = s.trim();
  if (trimmed === '') return undefined;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

// ─── email: a campaign she sent ───────────────────────────────────────────────
//
// Two names matter and they are different: what she called it ("Autumn drop
// announcement") and what the customer saw in their inbox ("The last of the
// linen"). She may remember either, so the subject is the subtitle AND a
// keyword rather than only one of them.

const broadcastProjector: EntityProjector = {
  entityType: 'email_broadcast',
  module: 'email',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.broadcast.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const b = await tx.broadcast.findFirst({ where: { id } });
      if (!b) return null;
      return {
        id: universalId(ctx.tenantId, 'email_broadcast', b.id),
        tenant_id: ctx.tenantId,
        entity_type: 'email_broadcast',
        module: 'email',
        record_id: b.id,
        title: b.name,
        subtitle: b.subject,
        body: snippet(b.preheader),
        keywords: keywords([b.subject, b.preheader, b.campaignTag]),
        status: b.status,
        url: `/email/broadcasts/${b.id}`,
        created_at: epoch(b.createdAt),
        updated_at: epoch(b.updatedAt),
      };
    }),
};

// ─── email: an automatic series ───────────────────────────────────────────────

const sequenceProjector: EntityProjector = {
  entityType: 'email_sequence',
  module: 'email',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.emailSequence.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const s = await tx.emailSequence.findFirst({ where: { id } });
      if (!s) return null;
      return {
        id: universalId(ctx.tenantId, 'email_sequence', s.id),
        tenant_id: ctx.tenantId,
        entity_type: 'email_sequence',
        module: 'email',
        record_id: s.id,
        title: s.name,
        subtitle: snippet(s.description, 120),
        body: snippet(s.description),
        status: s.status,
        url: `/email/sequences/${s.id}`,
        created_at: epoch(s.createdAt),
        updated_at: epoch(s.updatedAt),
      };
    }),
};

// ─── automations: the rules ───────────────────────────────────────────────────
//
// Platform-seeded rules are indexed alongside hand-written ones on purpose. They
// are in her account, she can read them, and she can switch them on — 2,404 of
// the platform's 2,411 arrived that way, so excluding them would index seven
// rules and call it the automations index. What she types is the rule's NAME,
// and a seeded rule has one she can read.
//
// The TRIGGER is a keyword rather than the subtitle: `order.placed` is machine
// vocabulary, and a search box is exactly where somebody types it after seeing
// it on a screen, so it should match without being read back at her.

// The module is `PLATFORM_MODULE`, not 'automations'. There IS no `automations`
// slug — the route file says so in its own header ("Automations are a PLATFORM
// CAPABILITY, not a gated module") — and the universal search route filters
// documents to the tenant's ENABLED modules. A module nobody can enable matches
// nothing, so all 57 of one tenant's rules were indexed, routed, and unreachable:
// she typed a rule's exact name and was told her records held nothing like it.
// [[feedback_absent_behaves_like_fine]]
const automationProjector: EntityProjector = {
  entityType: 'automation',
  module: PLATFORM_MODULE,
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.automation.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const a = await tx.automation.findFirst({ where: { id } });
      if (!a) return null;
      return {
        id: universalId(ctx.tenantId, 'automation', a.id),
        tenant_id: ctx.tenantId,
        entity_type: 'automation',
        module: PLATFORM_MODULE,
        record_id: a.id,
        title: a.name,
        subtitle: snippet(a.description, 120),
        body: snippet(a.description),
        keywords: keywords([a.triggerType]),
        status: a.status,
        url: `/automations/${a.id}`,
        created_at: epoch(a.createdAt),
        updated_at: epoch(a.updatedAt),
      };
    }),
};

export const messagingUniversalProjectors: EntityProjector[] = [
  broadcastProjector,
  sequenceProjector,
  automationProjector,
];
