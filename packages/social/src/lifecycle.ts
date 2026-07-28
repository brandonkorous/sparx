// Social post lifecycle: the approval gate + scheduling transitions (docs/133 §7,
// docs/134 Slice 5). Slice 4 gave us compose + publish-now; this is the middle of
// the state machine:
//
//   compose ─▶ draft ─▶ (submit / schedule) ─▶ pending_approval ─▶ (approve) ─▶ scheduled
//                                                     │                             │
//                                                  (reject)                 scheduled tick
//                                                     ▼                             ▼
//                                                   draft                       publishing
//
// The approval gate is a REAL state, not a boolean check at publish time (docs/133
// §15.3): require-approval is the tenant default, per-post overridable, and approving
// is a staff permission (admin). An automation that does not auto-approve simply parks
// its drafted post in `pending_approval` for a human — the automation drafts, the
// person ships (Slice 7 wires that side).
//
// Pub/Sub stays on the CALLER (REST route / MCP tool), mirroring Slice 4's publish-now:
// these helpers do the DB transition and report which event the caller should emit
// (`due` / `scheduled`). No publisher plumbing in here.
//
// Lives in @sparx/social so REST and MCP drive the same lifecycle service.

import { prisma, withTenant, type Prisma } from '@sparx/db';
import { badRequest } from '@sparx/api-core/errors';

import type { SocialContext } from './context.js';
import { toPostView, type SocialPostView } from './posts.js';

const POST_INCLUDE = { targets: { orderBy: { targetName: 'asc' as const } } };

// A post can still move through the lifecycle until it actually starts publishing.
const EDITABLE_STATUSES = new Set(['draft', 'pending_approval', 'scheduled', 'failed']);

// ── approval default (per-tenant setting) ─────────────────────────────────────────

export interface SocialSettings {
  /** Whether posts must be approved by a staff admin before they reach a live
   *  account. The platform default is ON — nothing publishes to a real brand's
   *  account unreviewed unless a human deliberately turned it off (docs/133 §15.3). */
  requireApproval: boolean;
  /**
   * Whether outbound post links are tagged so the visits and sales they drive show up
   * in the tenant's own traffic reports. Default ON, because a link that can't be
   * measured makes social look like it does nothing.
   *
   * The opt-out exists because tagging is visible: it lengthens the URL a customer sees,
   * and some brands (and some platforms' link previews) care. A link the author already
   * tagged themselves is never touched either way.
   */
  trackLinks: boolean;
}

/** Read the tenant's social settings. Bare `prisma.tenant` read, mirroring
 *  `isModuleEnabled` — not the withTenant path. */
export async function getSocialSettings(tenantId: string): Promise<SocialSettings> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  return {
    requireApproval: readRequireApproval(tenant?.settings),
    trackLinks: readTrackLinks(tenant?.settings),
  };
}

/** Pure read of `settings.modules.social.trackLinks`, default-ON. */
export function readTrackLinks(settings: unknown): boolean {
  const slot = socialSlot(settings);
  // Default-ON: only an explicit `false` turns tagging off.
  return slot?.trackLinks !== false;
}

/** The `settings.modules.social` object, or undefined. */
function socialSlot(settings: unknown): Record<string, unknown> | undefined {
  if (!settings || typeof settings !== 'object') return undefined;
  const modules = (settings as Record<string, unknown>).modules;
  if (!modules || typeof modules !== 'object') return undefined;
  const slot = (modules as Record<string, unknown>).social;
  if (!slot || typeof slot !== 'object') return undefined;
  return slot as Record<string, unknown>;
}

/** Pure read of `settings.modules.social.requireApproval`, default-ON. Exported for
 *  unit coverage of the default semantics. */
export function readRequireApproval(settings: unknown): boolean {
  // Default-ON: only an explicit `false` turns the gate off.
  return socialSlot(settings)?.requireApproval !== false;
}

/** Update the tenant's social settings. Read-modify-write on the `social` module slot so
 *  the `enabled` flag (and every other module) is preserved — the same merge shape
 *  module-toggle uses. Only the keys passed are touched. */
export async function updateSocialSettings(
  tenantId: string,
  patch: Partial<SocialSettings>
): Promise<SocialSettings> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  const settings = (tenant?.settings as Record<string, unknown> | null) ?? {};
  const modules = (settings.modules as Record<string, unknown> | undefined) ?? {};
  const social = (modules.social as Record<string, unknown> | undefined) ?? {};
  const merged = {
    ...social,
    ...(patch.requireApproval !== undefined ? { requireApproval: patch.requireApproval } : {}),
    ...(patch.trackLinks !== undefined ? { trackLinks: patch.trackLinks } : {}),
  };
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: { ...settings, modules: { ...modules, social: merged } } },
  });
  return {
    requireApproval: merged.requireApproval !== false,
    trackLinks: merged.trackLinks !== false,
  };
}

/** Set just the require-approval default. Kept as its own name because it is the one
 *  setting with a safety meaning, and callers read better for saying so. */
export async function setSocialRequireApproval(
  tenantId: string,
  requireApproval: boolean
): Promise<SocialSettings> {
  return updateSocialSettings(tenantId, { requireApproval });
}

/** The effective gate for one post: an explicit per-post override
 *  (`metadata.requireApproval`) wins, else the tenant default. The override is how an
 *  auto-approving automation (Slice 7) ships without a human, and how a composer can
 *  force review on a one-off even when the tenant default is off. */
export function postRequiresApproval(metadata: Prisma.JsonValue, tenantDefault: boolean): boolean {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const override = (metadata as Record<string, unknown>).requireApproval;
    if (typeof override === 'boolean') return override;
  }
  return tenantDefault;
}

// ── transitions ────────────────────────────────────────────────────────────────

/** Reset a post's still-pending / previously-failed targets to `pending` so a drain
 *  (re)attempts them; succeeded/skipped targets are left alone (the worker no-ops a
 *  target already published — idempotent). Throws if nothing is armable. */
async function armTargets(tx: Prisma.TransactionClient, postId: string): Promise<number> {
  const targets = await tx.socialPostTarget.findMany({
    where: { postId },
    select: { status: true },
  });
  const armable = targets.filter((t) => t.status === 'pending' || t.status === 'failed').length;
  if (armable === 0) throw badRequest('This post has no target left to publish.');
  await tx.socialPostTarget.updateMany({
    where: { postId, status: { in: ['pending', 'failed'] } },
    data: { status: 'pending', error: null },
  });
  return armable;
}

export interface LifecycleResult {
  post: SocialPostView;
  /** The caller emits `social.post.due` when true (the post is publishing now). */
  emitDue: boolean;
  /** The caller emits `social.post.scheduled` when true (queued for a future time). */
  emitScheduled: boolean;
}

/** Submit a draft for review: draft → pending_approval. The composer's "send for
 *  approval" for a post the tenant wants an admin to ship (no fixed schedule). */
export async function submitForApproval(
  ctx: SocialContext,
  id: string
): Promise<SocialPostView | null> {
  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    const existing = await tx.socialPost.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { status: true, _count: { select: { targets: true } } },
    });
    if (!existing) return null;
    if (existing.status !== 'draft') {
      throw badRequest(
        `Only a draft can be submitted for approval (this one is ${existing.status}).`
      );
    }
    if (existing._count.targets === 0) {
      throw badRequest('Add at least one destination before submitting.');
    }
    const post = await tx.socialPost.update({
      where: { id },
      // Clear the reviewer's note: it belonged to the previous round, and leaving it on
      // a resubmitted post would show the approver an objection that has been dealt with.
      data: { status: 'pending_approval', reviewNote: null },
      include: POST_INCLUDE,
    });
    return toPostView(post);
  });
}

/** Schedule a post for a future time. Sets `scheduledAt` and moves it to `scheduled`
 *  (the drain will fire it) — UNLESS approval is required and the post isn't approved
 *  yet, in which case it parks in `pending_approval` holding its scheduledAt until an
 *  admin approves. */
export async function scheduleSocialPost(
  ctx: SocialContext,
  id: string,
  scheduledAt: Date
): Promise<LifecycleResult | null> {
  if (scheduledAt.getTime() <= Date.now()) {
    throw badRequest('Pick a time in the future to schedule this post.');
  }
  const { requireApproval } = await getSocialSettings(ctx.tenantId);

  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    const existing = await tx.socialPost.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: {
        status: true,
        approvedAt: true,
        metadata: true,
        _count: { select: { targets: true } },
      },
    });
    if (!existing) return null;
    if (!EDITABLE_STATUSES.has(existing.status)) {
      throw badRequest(`A ${existing.status} post can't be rescheduled.`);
    }
    if (existing._count.targets === 0) {
      throw badRequest('Add at least one destination before scheduling.');
    }

    const gated = postRequiresApproval(existing.metadata, requireApproval) && !existing.approvedAt;
    const nextStatus = gated ? 'pending_approval' : 'scheduled';
    const post = await tx.socialPost.update({
      where: { id },
      data: { status: nextStatus, scheduledAt },
      include: POST_INCLUDE,
    });
    return {
      post: toPostView(post),
      emitDue: false,
      emitScheduled: nextStatus === 'scheduled',
    };
  });
}

/** Approve a post awaiting review (a staff-admin action). Stamps the approver, then
 *  routes it: a future `scheduledAt` → `scheduled` (the drain fires it), otherwise it
 *  publishes now (arm targets → `publishing` → the caller emits `social.post.due`). */
export async function approveSocialPost(
  ctx: SocialContext,
  id: string
): Promise<LifecycleResult | null> {
  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    const existing = await tx.socialPost.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { status: true, scheduledAt: true },
    });
    if (!existing) return null;
    if (existing.status !== 'pending_approval') {
      throw badRequest(
        `Only a post awaiting approval can be approved (this one is ${existing.status}).`
      );
    }

    const publishNow = !existing.scheduledAt || existing.scheduledAt.getTime() <= Date.now();
    if (publishNow) await armTargets(tx, id);

    const post = await tx.socialPost.update({
      where: { id },
      data: {
        status: publishNow ? 'publishing' : 'scheduled',
        approvedById: ctx.userId,
        approvedAt: new Date(),
      },
      include: POST_INCLUDE,
    });
    return {
      post: toPostView(post),
      emitDue: publishNow,
      emitScheduled: !publishNow,
    };
  });
}

/** Reject a post awaiting review: pending_approval → draft, clearing any approval
 *  stamp so the editor can revise and resubmit. Keeps `scheduledAt` (the intended
 *  time survives the round-trip).
 *
 *  `note` is why. Without it a rejection is a silent state change — the post reappears
 *  as a draft and the author has to guess what the reviewer objected to, which in
 *  practice means asking them in person or resubmitting the same thing. */
export async function rejectSocialPost(
  ctx: SocialContext,
  id: string,
  note?: string
): Promise<SocialPostView | null> {
  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    const existing = await tx.socialPost.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { status: true },
    });
    if (!existing) return null;
    if (existing.status !== 'pending_approval') {
      throw badRequest(
        `Only a post awaiting approval can be rejected (this one is ${existing.status}).`
      );
    }
    const post = await tx.socialPost.update({
      where: { id },
      data: {
        status: 'draft',
        approvedById: null,
        approvedAt: null,
        reviewNote: note?.trim() ? note.trim().slice(0, 2000) : null,
      },
      include: POST_INCLUDE,
    });
    return toPostView(post);
  });
}
