// The mirror itself — keep the platform tenant's CRM in step with a sparx tenant.
//
// One contact per PERSON (the owner's email is the natural key — captureLead is
// idempotent on it) and one deal per TENANT. They are deliberately not the same
// grain: the same person can own more than one sparx tenant (an agency spinning
// up a second workspace), and each of those is its own trial to win or lose. So
// the deal carries the tenant link and every lifecycle update targets the deal.
//
// Every entry point is SELF-HEALING: it re-derives the mirror from the tenant row
// before acting. That means a subscription webhook for a tenant that predates
// this worker creates the missing contact + deal instead of dropping the signal,
// a redelivered Pub/Sub message is a no-op, and the backfill script is just
// "call mirrorTenant for every tenant".
//
// Consent: a signup is NOT a marketing opt-in. We use captureLead (prospect, no
// marketing consent) — the same distinction /v1/public/signup draws. Marketing
// email to these contacts needs its own opt-in, exactly as it would for any
// tenant's customers.

import { platformBrandIdentity } from '@wizeworks/brand-core';
import { prisma, withTenant } from '@wizeworks/db';
import { activityService, customerService, dealService } from '@wizeworks/crm/services';
import { isModuleEnabled } from '@wizeworks/modules';

import {
  isPaymentTrouble,
  nextStageForModuleActivation,
  nextStageForSubscription,
  subscriptionActivityDescription,
  type SubscriptionStatus,
} from './lifecycle';
import { ensurePlatformPipeline, type StageKey } from './pipeline';
import { resolvePlatformTarget, type PlatformTarget } from './target';

/** Minimal structured logger — satisfied by pino (the worker) and the signup
 *  flow's console logger alike, so this package needs no pino dependency. */
export interface MirrorLogger {
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

export type MirrorSkipReason =
  | 'no-platform-tenant'
  | 'platform-crm-disabled'
  | 'is-platform-tenant'
  | 'tenant-not-found'
  | 'no-owner-email';

export interface MirroredOutcome {
  status: 'mirrored';
  customerId: string;
  dealId: string;
  /** True when this call created the deal (i.e. the signup landed now). */
  created: boolean;
  stage: StageKey | null;
}

export type MirrorOutcome = MirroredOutcome | { status: 'skipped'; reason: MirrorSkipReason };

const DEAL_SOURCE = 'signup';
const SIGNUP_TAG = 'tenant-signup';
const PAYMENT_TROUBLE_TAG = 'payment-trouble';

// ─── Tenant facts ─────────────────────────────────────────────────────────

interface TenantFacts {
  id: string;
  slug: string;
  name: string;
  ownerEmail: string;
  ownerName: string | null;
  ownerUserId: string | null;
  createdAt: Date;
  trialEndsAt: Date | null;
  subscriptionStatus: string | null;
  acquisitionChannel: string | null;
  acquisitionSource: string | null;
  acquisitionCampaign: string | null;
  /** Module slugs currently switched on for this tenant. */
  modules: string[];
  /** Which PRODUCT this tenant signed up under — `sparx` or `piggles`.
   *
   *  Without it the two brands are indistinguishable on the signups board, and
   *  "how is Piggles doing" becomes unanswerable at exactly the moment it is the
   *  only question worth asking — the whole reason for running a second brand is
   *  to compare them. */
  platformBrand: string;
  /** The STORY — what the owner said their business is, in their own words,
   *  composed during in-console onboarding and persisted at
   *  `tenants.settings.onboarding.story`.
   *
   *  This is the richest thing the platform knows about a new tenant: industry,
   *  who they sell to, and a sentence they wrote themselves. It has been
   *  collected since onboarding shipped and was NOT reaching this mirror, which
   *  is why the signups board could show when tenants arrived but never what
   *  kind of business arrived. Retention does not look the same across a bakery,
   *  a consultancy and a wholesaler, and these are the fields that tell them
   *  apart. */
  story: {
    industry: string | null;
    audience: string | null;
    /** The composed sentence. Truncated — the board wants a label, and the full
     *  text lives on the tenant where it was written. */
    text: string | null;
    /** Modules the story implies. Distinct from `modules`, which is what is
     *  actually switched on — the gap between the two is a signal in itself. */
    impliedModules: string[];
    composedAt: string | null;
  };
  /** Piggles' day-one rail preference, from ITS onboarding. Piggles asks a
   *  different, shorter question than the story composer, so it lands in its
   *  own namespaced key rather than pretending to be the same answer. */
  railGroups: string[];
}

/** Read everything the mirror needs straight from the tenant's own rows.
 *
 *  Reading rather than carrying it on the event payload is deliberate: it keeps
 *  owner PII off the bus, makes a redelivered message reflect CURRENT state
 *  instead of a stale snapshot, and lets the same code backfill tenants that
 *  were created before any of this existed. */
async function loadTenantFacts(tenantId: string): Promise<TenantFacts | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      slug: true,
      name: true,
      email: true,
      createdAt: true,
      trialEndsAt: true,
      subscriptionStatus: true,
      acquisitionChannel: true,
      acquisitionSource: true,
      acquisitionCampaign: true,
      platformBrand: true,
      settings: true,
    },
  });
  if (!tenant) return null;

  // `users` is tenant-scoped under RLS — read it inside the tenant's own GUC.
  const owner = await withTenant({ tenantId }, (tx) =>
    tx.user.findFirst({
      where: { role: 'owner' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true },
    })
  );

  const ownerEmail = (tenant.email ?? owner?.email ?? '').trim();
  if (!ownerEmail) return null;

  // A blank name is the same as no name — the contact keeps first/last empty
  // rather than being "created" with whitespace.
  const ownerName = (owner?.name ?? '').trim();

  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    ownerEmail,
    ownerName: ownerName.length > 0 ? ownerName : null,
    ownerUserId: owner?.id ?? null,
    createdAt: tenant.createdAt,
    trialEndsAt: tenant.trialEndsAt,
    subscriptionStatus: tenant.subscriptionStatus,
    acquisitionChannel: tenant.acquisitionChannel,
    acquisitionSource: tenant.acquisitionSource,
    acquisitionCampaign: tenant.acquisitionCampaign,
    modules: enabledModules(tenant.settings),
    platformBrand: tenant.platformBrand,
    story: readStory(tenant.settings),
    railGroups: readRailGroups(tenant.settings),
  };
}

/** The story, read from `tenants.settings.onboarding.story` — the shape the
 *  workbench's onboarding composer writes (`PersistedStory`).
 *
 *  Read DEFENSIVELY at every level rather than trusted. It is a JSON blob with
 *  no constraint behind it, written by an app that will change, and a mirror
 *  that throws on one malformed story stops recording signups entirely — a far
 *  worse failure than a missing segment on one deal. Every field independently
 *  degrades to null rather than taking the rest with it. */
function readStory(settings: unknown): TenantFacts['story'] {
  const story = (settings as { onboarding?: { story?: unknown } } | null)?.onboarding?.story;
  const s = story && typeof story === 'object' ? (story as Record<string, unknown>) : {};

  const text = typeof s.text === 'string' && s.text.trim() ? s.text.trim() : null;

  return {
    industry: typeof s.industry === 'string' && s.industry ? s.industry : null,
    audience: typeof s.audience === 'string' && s.audience ? s.audience : null,
    // Capped: a CRM metadata blob is not the place for an essay, and the full
    // text is still on the tenant row where the composer wrote it.
    text: text ? text.slice(0, 400) : null,
    impliedModules: Array.isArray(s.modules)
      ? s.modules.filter((m): m is string => typeof m === 'string').slice(0, 32)
      : [],
    composedAt: typeof s.composedAt === 'string' ? s.composedAt : null,
  };
}

/** Piggles' day-one rail preference, namespaced under its own key. */
function readRailGroups(settings: unknown): string[] {
  const groups = (settings as { piggles?: { railGroups?: unknown } } | null)?.piggles?.railGroups;
  if (!Array.isArray(groups)) return [];
  return groups.filter((g): g is string => typeof g === 'string').slice(0, 12);
}

/** Module slugs with `enabled: true` in `tenants.settings.modules`. */
function enabledModules(settings: unknown): string[] {
  const modules = (settings as { modules?: Record<string, unknown> } | null)?.modules;
  if (!modules || typeof modules !== 'object') return [];
  return Object.entries(modules)
    .filter(([, slot]) => (slot as { enabled?: unknown } | null)?.enabled === true)
    .map(([slug]) => slug)
    .sort();
}

// ─── The mirror ───────────────────────────────────────────────────────────

interface Mirror {
  target: PlatformTarget;
  facts: TenantFacts;
  customerId: string;
  dealId: string;
  stage: StageKey | null;
  stageIds: Partial<Record<StageKey, string>>;
  /** True when the deal was created by this call. */
  created: boolean;
}

async function ensureMirror(
  tenantId: string,
  logger: MirrorLogger
): Promise<Mirror | { skipped: MirrorSkipReason }> {
  const target = await resolvePlatformTarget();
  if (!target) {
    // Loud: in prod this means a signup went unrecorded. Never guess a tenant.
    logger.warn(
      { tenantId },
      'platform-crm: no platform tenant resolved (set SPARX_PLATFORM_TENANT_ID) — skipping'
    );
    return { skipped: 'no-platform-tenant' };
  }
  // The platform tenant mirroring itself would put WizeWorks on its own signup
  // board as a lead. Provisioning re-runs are not a signup.
  if (tenantId === target.tenantId) return { skipped: 'is-platform-tenant' };

  // The contact spine is a CRM concern; a disabled module writes no rows
  // (the platform-wide module rule). Loud, because on our own tenant this is a
  // misconfiguration rather than a customer's choice.
  if (!(await isModuleEnabled(target.tenantId, 'crm'))) {
    logger.warn(
      { tenantId, platformTenantId: target.tenantId },
      'platform-crm: CRM is not enabled on the platform tenant — signup not mirrored'
    );
    return { skipped: 'platform-crm-disabled' };
  }

  const facts = await loadTenantFacts(tenantId);
  if (!facts) return { skipped: 'tenant-not-found' };

  const ctx = { tenantId: target.tenantId };
  const pipeline = await ensurePlatformPipeline(target);

  const { customer } = await customerService.captureLead(ctx, {
    propertyId: target.propertyId,
    email: facts.ownerEmail,
    name: facts.ownerName,
    // The workspace they run IS the company, from our point of view. The mirror
    // owns this field — a tenant renaming their workspace renames it here.
    company: facts.name,
    source: DEAL_SOURCE,
    tags: contactTags(facts),
    metadata: {
      sparxTenantId: facts.id,
      sparxTenantSlug: facts.slug,
      signedUpAt: facts.createdAt.toISOString(),
      acquisitionChannel: facts.acquisitionChannel,
      acquisitionSource: facts.acquisitionSource,
      acquisitionCampaign: facts.acquisitionCampaign,
      platformBrand: facts.platformBrand,
    },
  });

  const existing = await withTenant(ctx, (tx) =>
    tx.deal.findFirst({
      where: {
        pipelineId: pipeline.pipelineId,
        deletedAt: null,
        metadata: { path: ['sparxTenantId'], equals: facts.id },
      },
      select: { id: true, stageId: true, title: true },
    })
  );

  if (existing) {
    // Keep the board honest about who this is — the workspace name starts as a
    // placeholder ("Sam's workspace") and becomes the real business name during
    // onboarding, which is exactly when the board stops being readable if we
    // never refresh it.
    const title = dealTitle(facts);
    if (title !== existing.title) {
      await dealService.update(ctx, existing.id, { title, metadata: dealMetadata(facts) });
    }
    return {
      target,
      facts,
      customerId: customer.id,
      dealId: existing.id,
      stage: pipeline.keyByStageId.get(existing.stageId) ?? null,
      stageIds: pipeline.stageIds,
      created: false,
    };
  }

  const trialStageId = pipeline.stageIds.trial;
  if (!trialStageId) {
    // Someone deleted the Trial stage off the board — there is nowhere sane to
    // put the deal. Throw so the message is retried once the stage is restored,
    // rather than silently dropping a signup.
    throw new Error('platform-crm: the Trial stage is missing from the Tenant Signups pipeline');
  }

  const deal = await dealService.create(ctx, {
    pipelineId: pipeline.pipelineId,
    stageId: trialStageId,
    customerId: customer.id,
    title: dealTitle(facts),
    value: 0,
    currency: 'USD',
    probability: 20,
    // The trial's end date IS the decision date — so the board's close-date
    // column answers "who do we need to talk to this week?" out of the box.
    expectedCloseDate: facts.trialEndsAt ? isoDate(facts.trialEndsAt) : null,
    source: DEAL_SOURCE,
    tags: contactTags(facts),
    metadata: dealMetadata(facts),
  });

  await activityService.record(ctx, {
    customerId: customer.id,
    dealId: deal.id,
    type: 'account.created',
    description: signupDescription(facts),
    actorType: 'system',
    occurredAt: facts.createdAt.toISOString(),
    linkedEntityType: 'Tenant',
    linkedEntityId: facts.id,
    metadata: {
      sparxTenantId: facts.id,
      sparxTenantSlug: facts.slug,
      acquisitionChannel: facts.acquisitionChannel,
    },
  });

  logger.info(
    { tenantId: facts.id, slug: facts.slug, customerId: customer.id, dealId: deal.id },
    'platform-crm: signup mirrored'
  );

  return {
    target,
    facts,
    customerId: customer.id,
    dealId: deal.id,
    stage: 'trial',
    stageIds: pipeline.stageIds,
    created: true,
  };
}

/**
 * A CRM tag safe for the `TagList` contract: `^[a-zA-Z0-9_-]+$`, max 63 chars.
 *
 * The acquisition channel is free-form first-party data (a UTM value, a referrer
 * host), so it CANNOT be interpolated into a tag as-is. It was — as
 * `channel:<value>` — and the colon fails the pattern, so every tenant with a
 * recorded channel threw on the way in and never reached the board. Anything
 * unusable collapses to a hyphen; a value with nothing usable left yields null
 * and is simply not tagged.
 */
export function toTag(prefix: string, value: string): string | null {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!cleaned) return null;
  return `${prefix}-${cleaned}`.slice(0, 63).replace(/-+$/, '');
}

function contactTags(facts: TenantFacts): string[] {
  const tags = [SIGNUP_TAG];
  // The brand is a TAG rather than only metadata because tags are what the board
  // filters and segments on. Growth per product is the first question anyone
  // asks of a two-brand platform, and a value buried in a JSON column cannot
  // answer it without someone writing a query.
  const brand = toTag('brand', facts.platformBrand);
  if (brand) tags.push(brand);
  const channel = facts.acquisitionChannel ? toTag('channel', facts.acquisitionChannel) : null;
  if (channel) tags.push(channel);
  return tags;
}

function dealTitle(facts: TenantFacts): string {
  // The slug is what appears in their URLs and in support conversations, so it
  // earns its place next to a name that may still be a placeholder.
  return `${facts.name} (${facts.slug})`;
}

function dealMetadata(facts: TenantFacts): Record<string, unknown> {
  return {
    sparxTenantId: facts.id,
    sparxTenantSlug: facts.slug,
    signedUpAt: facts.createdAt.toISOString(),
    trialEndsAt: facts.trialEndsAt?.toISOString() ?? null,
    subscriptionStatus: facts.subscriptionStatus,
    modules: facts.modules,
    acquisitionChannel: facts.acquisitionChannel,
    acquisitionSource: facts.acquisitionSource,
    acquisitionCampaign: facts.acquisitionCampaign,
    platformBrand: facts.platformBrand,
    // The story is what makes this board segmentable by KIND of business rather
    // than only by arrival date. Flattened onto the deal metadata so a filter
    // does not have to reach through a nested object.
    storyIndustry: facts.story.industry,
    storyAudience: facts.story.audience,
    storyText: facts.story.text,
    storyImpliedModules: facts.story.impliedModules,
    storyComposedAt: facts.story.composedAt,
    railGroups: facts.railGroups,
  };
}

function signupDescription(facts: TenantFacts): string {
  const parts = [
    `Signed up for ${platformBrandIdentity(facts.platformBrand).name} and started a workspace, "${facts.name}".`,
  ];
  if (facts.trialEndsAt) parts.push(`The free trial runs until ${longDate(facts.trialEndsAt)}.`);
  if (facts.acquisitionChannel) parts.push(`Came in through ${facts.acquisitionChannel}.`);
  return parts.join(' ');
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function longDate(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

function toOutcome(mirror: Mirror): MirroredOutcome {
  return {
    status: 'mirrored',
    customerId: mirror.customerId,
    dealId: mirror.dealId,
    created: mirror.created,
    stage: mirror.stage,
  };
}

// ─── Entry points ─────────────────────────────────────────────────────────

/**
 * Ensure the tenant has a contact + deal on the platform board, and that both
 * reflect the tenant's current name. Handles `tenant.created` (creates) and
 * `tenant.updated` (refreshes) — the same operation either way, which is why a
 * redelivery, a rename, and a backfill all take the identical path.
 */
export async function mirrorTenant(tenantId: string, logger: MirrorLogger): Promise<MirrorOutcome> {
  const mirror = await ensureMirror(tenantId, logger);
  if ('skipped' in mirror) return { status: 'skipped', reason: mirror.skipped };
  return toOutcome(mirror);
}

export interface SubscriptionChange {
  status: SubscriptionStatus;
  /** Monthly recurring revenue in minor units, when the event carries it. */
  mrrCents?: number | null;
  currency?: string | null;
}

/**
 * Apply a platform-billing change: move the deal (trial → paying, or → churned /
 * trial expired), set its value to the tenant's MRR, and note what happened on
 * the timeline.
 */
export async function recordSubscriptionChange(
  tenantId: string,
  change: SubscriptionChange,
  logger: MirrorLogger
): Promise<MirrorOutcome> {
  const mirror = await ensureMirror(tenantId, logger);
  if ('skipped' in mirror) return { status: 'skipped', reason: mirror.skipped };

  const ctx = { tenantId: mirror.target.tenantId };
  const currency = (change.currency ?? 'USD').toUpperCase();
  const monthly =
    typeof change.mrrCents === 'number' && change.mrrCents > 0 ? change.mrrCents / 100 : null;
  const monthlyLabel = monthly === null ? null : money(monthly, currency);

  // Value first — a deal that moves to Paying should already carry what it's worth.
  if (monthly !== null) {
    await dealService.update(ctx, mirror.dealId, { value: monthly, currency });
  }

  const trouble = isPaymentTrouble(change.status);
  if (trouble) await addDealTag(mirror, PAYMENT_TROUBLE_TAG);
  else await removeDealTag(mirror, PAYMENT_TROUBLE_TAG);

  const next = nextStageForSubscription(mirror.stage, change.status);
  const nextStageId = next ? mirror.stageIds[next] : undefined;
  if (next && nextStageId) {
    await dealService.moveStage(ctx, mirror.dealId, {
      toStageId: nextStageId,
      closedReason:
        next === 'churned'
          ? 'Subscription cancelled'
          : next === 'trial_expired'
            ? 'Trial ended without a subscription'
            : undefined,
    });
  }

  await activityService.record(ctx, {
    customerId: mirror.customerId,
    dealId: mirror.dealId,
    type: 'note',
    description: subscriptionActivityDescription(change.status, monthlyLabel),
    actorType: 'system',
    linkedEntityType: 'Tenant',
    linkedEntityId: tenantId,
    metadata: { subscriptionStatus: change.status, mrrCents: change.mrrCents ?? null },
  });

  logger.info(
    { tenantId, dealId: mirror.dealId, status: change.status, movedTo: next ?? null },
    'platform-crm: subscription change applied'
  );

  return { ...toOutcome(mirror), stage: next ?? mirror.stage };
}

export interface ModuleChange {
  module: string;
  action: 'activated' | 'deactivated';
}

/**
 * Apply a module toggle: the first activation is what moves a tenant out of
 * Trial into Activated — it's the earliest hard evidence they're actually
 * building something, which is the signal worth acting on.
 */
export async function recordModuleChange(
  tenantId: string,
  change: ModuleChange,
  logger: MirrorLogger
): Promise<MirrorOutcome> {
  const mirror = await ensureMirror(tenantId, logger);
  if ('skipped' in mirror) return { status: 'skipped', reason: mirror.skipped };

  const ctx = { tenantId: mirror.target.tenantId };

  const next = change.action === 'activated' ? nextStageForModuleActivation(mirror.stage) : null;
  const nextStageId = next ? mirror.stageIds[next] : undefined;
  if (next && nextStageId) {
    await dealService.moveStage(ctx, mirror.dealId, { toStageId: nextStageId });
  }

  await activityService.record(ctx, {
    customerId: mirror.customerId,
    dealId: mirror.dealId,
    type: 'note',
    description:
      change.action === 'activated'
        ? `Turned on the ${change.module} module.`
        : `Turned off the ${change.module} module.`,
    actorType: 'system',
    linkedEntityType: 'Tenant',
    linkedEntityId: tenantId,
    metadata: { module: change.module, action: change.action },
  });

  logger.info(
    { tenantId, dealId: mirror.dealId, module: change.module, movedTo: next ?? null },
    'platform-crm: module change applied'
  );

  return { ...toOutcome(mirror), stage: next ?? mirror.stage };
}

// ─── Tag helpers ──────────────────────────────────────────────────────────

async function addDealTag(mirror: Mirror, tag: string): Promise<void> {
  const ctx = { tenantId: mirror.target.tenantId };
  const deal = await withTenant(ctx, (tx) =>
    tx.deal.findUnique({ where: { id: mirror.dealId }, select: { tags: true } })
  );
  if (!deal || deal.tags.includes(tag)) return;
  await dealService.update(ctx, mirror.dealId, { tags: [...deal.tags, tag] });
}

async function removeDealTag(mirror: Mirror, tag: string): Promise<void> {
  const ctx = { tenantId: mirror.target.tenantId };
  const deal = await withTenant(ctx, (tx) =>
    tx.deal.findUnique({ where: { id: mirror.dealId }, select: { tags: true } })
  );
  if (!deal?.tags.includes(tag)) return;
  await dealService.update(ctx, mirror.dealId, { tags: deal.tags.filter((t) => t !== tag) });
}

function money(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}
