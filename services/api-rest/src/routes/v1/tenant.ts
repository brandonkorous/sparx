// Tenant — general settings, module flags, onboarding state.
//
//   GET    /v1/tenant                              → basic tenant card
//   PATCH  /v1/tenant                              → name / email
//   GET    /v1/tenant/modules                      → [{slug, enabled}]
//   PUT    /v1/tenant/modules                      → bulk-set { slug: enabled } (owner/admin)
//   PATCH  /v1/tenant/modules/:slug                → toggle enabled (owner/admin)
//   GET    /v1/tenant/onboarding                   → raw onboarding state
//   PATCH  /v1/tenant/onboarding                   → patch onboarding state
//   GET    /v1/tenant/onboarding/progress          → derived progress + steps
//
// The tenants table is RLS-exempt by design (it's the dispatch table). Every
// route here therefore reads through the bare `prisma` client but pins the
// WHERE clause to `request.auth.tenantId` — a triple safety belt against any
// future bug that misses the tenant filter.
//
// Module toggles do **read-modify-write** on `settings.modules.<slug>` rather
// than Postgres `jsonb_set`: jsonb_set silently no-ops when the parent path
// (`settings.modules`) doesn't exist yet, which was the F-01 persistence
// repro that originally bit CRM activation. RMW always produces a valid
// nested structure regardless of starting shape.

import type { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma, type Prisma } from '@sparx/db';
import { withRequestTenant } from '@sparx/api-core/db';
import { ok } from '@sparx/api-core/envelope';
import { publish } from '@sparx/api-core/pubsub';
import { requireAuth, requireRole } from '@sparx/api-core/auth';
import { requireVerifiedEmail } from '../../lib/verified-email-guard.js';
import { badRequest, conflict, forbidden, notFound } from '@sparx/api-core/errors';
import {
  invalidateModuleCache,
  requiredModules,
  blockingDependents,
  deriveModuleStates,
  type ModuleSlug,
} from '@sparx/auth';
import { publishPlatformEvent } from '@sparx/crm';
import { isBillingConfigured, syncModuleItems } from '@sparx/billing';
import { computeBannerEnabled } from '../../lib/consent.js';
import { env } from '../../env.js';
import Stripe from 'stripe';
import { SignJWT, jwtVerify } from 'jose';

const PatchConsent = z.object({
  mode: z.enum(['off', 'gdpr', 'ccpa']).optional(),
  activeCategories: z.array(z.enum(['preferences', 'analytics', 'marketing'])).optional(),
  bannerTitle: z.string().max(255).nullable().optional(),
  bannerBody: z.string().max(2000).nullable().optional(),
  policyPageSlug: z.string().max(255).optional(),
  policyVersion: z.string().max(20).optional(),
});

function serializeConsent(
  row: {
    mode: string;
    activeCategories: unknown;
    bannerTitle: string | null;
    bannerBody: string | null;
    policyPageSlug: string;
    policyVersion: string;
  } | null
) {
  const mode = row?.mode ?? 'off';
  const activeCategories = Array.isArray(row?.activeCategories)
    ? (row.activeCategories as unknown[]).filter((c): c is string => typeof c === 'string')
    : [];
  return {
    mode,
    activeCategories,
    bannerTitle: row?.bannerTitle ?? null,
    bannerBody: row?.bannerBody ?? null,
    policyPageSlug: row?.policyPageSlug ?? 'cookie-policy',
    policyVersion: row?.policyVersion ?? '1',
    bannerEnabled: computeBannerEnabled(mode, activeCategories),
  };
}

const MODULE_SLUGS: ModuleSlug[] = [
  'builder',
  'commerce',
  'cms',
  'crm',
  'email',
  'b2b',
  'invoicing',
  'dropship',
  'inventory',
  'chat',
  'ai',
  'scheduling',
];
const MODULE_SLUG_SET = new Set<string>(MODULE_SLUGS);

// Announce a module on/off transition on BOTH event buses (docs/82 Slice E4).
// The tenant route stays module-agnostic — it knows nothing about pipelines or
// email automations; it only says "this module just turned on/off" and lets the
// consumers seed themselves. The two buses reach two different process spaces:
//
//   1. api-core publish() → the `module.{activated,deactivated}` Pub/Sub topic,
//      which (a) enqueues webhook deliveries for tenant subscriptions and (b)
//      tees to `automation.trigger`, where the automation-worker (a SEPARATE
//      process) seeds the activated module's system automations.
//   2. the in-process platform bus → the CRM + Email activation consumers that
//      run inside THIS api-rest process (default pipeline + segments; default
//      email automations). publishPlatformEvent awaits every subscriber, so the
//      seed completes before the route returns — which is why the dashboard no
//      longer needs a separate /v1/<module>/bootstrap round-trip.
//
// Every consumer is idempotent, so a redundant announce is a safe no-op; callers
// still fire only on an actual transition to keep the bus quiet.
async function announceModuleTransition(
  log: FastifyBaseLogger,
  tenantId: string,
  actorId: string | null,
  slug: ModuleSlug,
  enabled: boolean
): Promise<void> {
  const type = enabled ? 'module.activated' : 'module.deactivated';
  const data = { module: slug };
  await publish(log, type, tenantId, actorId, data);
  await publishPlatformEvent({
    id: randomUUID(),
    topic: type,
    tenantId,
    occurredAt: new Date(),
    payload: data,
  });
}

// Persist a batch of explicit module-flag writes (one read-modify-write), drop
// the tenant's module cache, and announce activation transitions.
//
// Two subtleties this centralizes:
//   • Whole-tenant cache flush, not per-slug: BUNDLED_FREE capabilities (e.g.
//     `invoicing`) are DERIVED from provider flags, so toggling `b2b`/`commerce`
//     changes `invoicing`'s gate result even though no invoicing flag was written.
//   • Announce on DERIVED-state transitions, not raw writes: enabling B2B makes
//     `invoicing` available with no invoicing flag of its own, and its seeding
//     consumer (default workflows + line types) must still run. Billing keys off
//     EXPLICIT flags (deriveModuleStates → source 'explicit'), never these
//     availability events, so a bundled capability is announced but not charged.
//
// Returns the effective settings blob (next when anything changed, else the
// original) so callers can shape their response without a re-read.
async function applyModuleWrites(
  log: FastifyBaseLogger,
  tenantId: string,
  actorId: string | null,
  beforeSettings: unknown,
  writes: Map<ModuleSlug, boolean>
): Promise<unknown> {
  if (writes.size === 0) return beforeSettings;

  const currentSettings = (beforeSettings as Record<string, unknown> | null) ?? {};
  const currentModules = (currentSettings.modules as Record<string, unknown> | undefined) ?? {};
  const nextModules: Record<string, unknown> = { ...currentModules };
  for (const [slug, enabled] of writes) {
    const slot = (currentModules[slug] as Record<string, unknown> | undefined) ?? {};
    nextModules[slug] = { ...slot, enabled };
  }
  const nextSettings = { ...currentSettings, modules: nextModules };

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: nextSettings as Prisma.InputJsonValue },
  });
  invalidateModuleCache(tenantId);

  const beforeStates = deriveModuleStates(beforeSettings);
  const afterStates = deriveModuleStates(nextSettings);
  for (const slug of MODULE_SLUGS) {
    if (beforeStates[slug].enabled !== afterStates[slug].enabled) {
      await announceModuleTransition(log, tenantId, actorId, slug, afterStates[slug].enabled);
    }
  }

  // Keep the tenant's Stripe subscription items in lockstep with the new EXPLICIT
  // module set (docs/67 §4). Only explicit purchases bill — a BUNDLED_FREE
  // capability (invoicing via Commerce/B2B) has source 'bundled', no flag, and so
  // never creates an item. Best-effort + guarded: a no-op until billing is
  // configured, and a Stripe failure never blocks the toggle (the flag is already
  // written; the webhook reconciles authoritative state).
  if (isBillingConfigured()) {
    try {
      const explicitEnabled = MODULE_SLUGS.filter((s) => afterStates[s].source === 'explicit');
      const t = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { email: true, name: true },
      });
      if (t) {
        await syncModuleItems({
          tenantId,
          email: t.email,
          name: t.name,
          enabledModules: explicitEnabled,
        });
      }
    } catch (err) {
      log.error({ err }, 'billing: module item sync failed (non-fatal)');
    }
  }

  return nextSettings;
}

// Shape one module's row for GET/PUT responses: enabled + WHY, so the dashboard
// can lock + label a bundled/required toggle instead of letting it be flipped.
function moduleRow(
  slug: ModuleSlug,
  states: ReturnType<typeof deriveModuleStates>
): {
  slug: ModuleSlug;
  enabled: boolean;
  source: string;
  includedBy: ModuleSlug[];
  requiredBy: ModuleSlug[];
} {
  return {
    slug,
    enabled: states[slug].enabled,
    source: states[slug].source,
    includedBy: states[slug].includedBy,
    requiredBy: blockingDependents(slug, (m) => states[m].enabled),
  };
}

// A single social link (a SITE setting, not brand identity — docs/45 §3).
// `platform` is a known key (instagram, x, …) for icon mapping, or a free-text
// label for an "Other" link. The same { platform, url } shape the storefront
// `site.social` binding renders.
const SocialLink = z.object({
  platform: z.string().min(1).max(40),
  url: z.string().min(1).max(2048),
});

const PatchTenant = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().max(255).optional(),
  // An ORDERED array of links. A present-but-empty array clears them.
  socials: z.array(SocialLink).max(50).optional(),
});

type SocialLink = z.infer<typeof SocialLink>;

// The tenant row stores socials as a JSON array; normalize to a clean
// { platform, url }[] for the API surface, dropping any malformed entries.
function readSocials(raw: unknown): SocialLink[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const { platform, url } = item as Record<string, unknown>;
    if (typeof platform !== 'string' || typeof url !== 'string') return [];
    if (!platform.trim() || !url.trim()) return [];
    return [{ platform, url }];
  });
}

// Storefront subdomain rules (docs/04 §2): 3–63 chars, lowercase alnum +
// internal hyphens, plus a reserved-name guard.
const RESERVED_SLUGS = new Set<string>([
  'www',
  'api',
  'app',
  'admin',
  'mcp',
  'mail',
  'email',
  'ftp',
  'blog',
  'shop',
  'store',
  'dashboard',
  'static',
  'cdn',
  'assets',
  'help',
  'support',
  'status',
  'dev',
  'staging',
  'test',
  'sparx',
  'wize',
  'wizeworks',
  'account',
  'accounts',
  'login',
  'signup',
  'checkout',
  'cart',
  'docs',
  'about',
  'system',
  'internal',
]);
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const SlugSchema = z
  .string()
  .min(3)
  .max(63)
  .regex(SLUG_RE, 'Use lowercase letters, numbers, and hyphens.');
const SlugQuery = z.object({ slug: z.string().max(120) });
const SlugBody = z.object({ slug: SlugSchema });

// The platform's OWN tenant (docs/80 §2) may claim a reserved BRAND slug — the
// reservation stops OUTSIDE tenants from squatting sparx/WizeWorks subdomains, not
// the platform itself. Designated by SPARX_PLATFORM_TENANT_ID (ops-set, never
// user-settable). Keyed on the IMMUTABLE tenant id — stable across the very rename
// it authorizes — so the env value never changes as korous-store → wizeworks.
// Unset env → always false (reserved slugs blocked for everyone, the default).
function isPlatformTenant(tenantId: string): boolean {
  return Boolean(env.SPARX_PLATFORM_TENANT_ID) && tenantId === env.SPARX_PLATFORM_TENANT_ID;
}

// Three deterministic suggestions when a desired slug is taken/invalid.
function slugSuggestions(base: string): string[] {
  const clean =
    base
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 55) || 'store';
  return [`${clean}-store`, `${clean}-shop`, `${clean}-co`];
}

// Rename every always-on `<…>.sparx.zone` subdomain in lockstep with a tenant
// slug change. Provisioning mints `<slug>.sparx.zone` (primary) and multi-site
// adds `<prop>.<slug>.sparx.zone` — all embed the tenant slug, so the slug
// segment must be rewritten or the canonical host dangles. Custom domains
// (type !== 'subdomain') are never touched.
async function renameZoneSubdomains(
  tx: Prisma.TransactionClient,
  tenantId: string,
  oldSlug: string,
  newSlug: string
): Promise<void> {
  const zone = process.env.SPARX_ZONE_DOMAIN ?? 'sparx.zone';
  const exact = `${oldSlug}.${zone}`;
  const suffix = `.${oldSlug}.${zone}`;
  const subdomains = await tx.domain.findMany({
    where: { tenantId, type: 'subdomain' },
    select: { id: true, host: true },
  });
  for (const d of subdomains) {
    let nextHost: string | null = null;
    if (d.host === exact) nextHost = `${newSlug}.${zone}`;
    else if (d.host.endsWith(suffix))
      nextHost = `${d.host.slice(0, -suffix.length)}.${newSlug}.${zone}`;
    if (nextHost && nextHost !== d.host) {
      await tx.domain.update({ where: { id: d.id }, data: { host: nextHost } });
    }
  }
}

const ModuleParams = z.object({
  slug: z.string().refine((s) => MODULE_SLUG_SET.has(s), 'Unknown module slug'),
});

const ModulePatch = z.object({
  enabled: z.boolean(),
});

// Bulk module set (onboarding Modules step). A `{ slug: enabled }` map applied
// in ONE read-modify-write; absent slugs are left untouched.
const ModulesBulkPut = z.object({
  modules: z.record(z.string(), z.boolean()),
});

// Modules-first onboarding (docs/15 v2): modules → template → workspace → domain
// → payments → launch. The tenant explicitly picks their modules FIRST (that
// selection drives billing AND filters the template catalog to a compatible
// subset), then a complete blueprint ships theme, brand, products, and content.
// `payments` is conditional (only when a selling module is on) and `launch` is
// terminal — the preview-and-publish screen.
const ONBOARDING_STEPS = [
  'modules',
  'template',
  'workspace',
  'domain',
  'payments',
  'launch',
] as const;
type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

// The narrative captured by the natural-language "story" onboarding (apps/dashboard
// `/story`): the composed prose PLUS the structured selection that produced it. We
// persist the WHOLE story — both as a record of what the tenant told us (a signal we
// can surface later) and so the flow can resume. `.strict()` keeps it bounded; bump
// the shape here when the composer grows new fields.
const StoryNarrative = z
  .object({
    // The rendered prose, e.g. "I want to start a salon for people, where they can …".
    text: z.string().max(8000),
    tense: z.string().max(32).nullable().optional(),
    industry: z.string().max(64).nullable().optional(),
    audience: z.string().max(32).nullable().optional(),
    name: z.string().max(200).optional(),
    cust: z.array(z.string().max(40)).max(64).optional(),
    lines: z
      .array(z.array(z.string().max(40)).max(64))
      .max(64)
      .optional(),
    slots: z.record(z.string().max(40), z.string().max(400)).optional(),
    modules: z.array(z.string().max(40)).max(64).optional(),
    composedAt: z.string().datetime().optional(),
  })
  .strict();
type OnboardingStory = z.infer<typeof StoryNarrative>;

const OnboardingPatch = z.object({
  dismissed: z.boolean().optional(),
  startedAt: z.string().datetime().nullable().optional(),
  finishedAt: z.string().datetime().nullable().optional(),
  currentStep: z.enum(ONBOARDING_STEPS).optional(),
  category: z.string().max(63).nullable().optional(),
  // The chosen blueprint + its install row, tracked so the Launch step can
  // publish (go-live) deterministically and the flow resumes mid-onboarding.
  // Both null on the "start from scratch" path (no blueprint installed).
  blueprintKey: z.string().max(64).nullable().optional(),
  installId: z.string().uuid().nullable().optional(),
  // The full natural-language story, when onboarding came through `/story`.
  story: StoryNarrative.nullable().optional(),
  completed: z
    .object({
      modules: z.boolean().optional(),
      template: z.boolean().optional(),
      workspace: z.boolean().optional(),
      domain: z.boolean().optional(),
      payments: z.boolean().optional(),
    })
    .optional(),
});

interface OnboardingCompleted {
  modules: boolean;
  template: boolean;
  workspace: boolean;
  domain: boolean;
  payments: boolean;
}

interface OnboardingState {
  dismissed: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  currentStep: OnboardingStep;
  category: string | null;
  blueprintKey: string | null;
  installId: string | null;
  story: OnboardingStory | null;
  completed: OnboardingCompleted;
}

const DEFAULT_COMPLETED: OnboardingCompleted = {
  modules: false,
  template: false,
  workspace: false,
  domain: false,
  payments: false,
};

const DEFAULT_ONBOARDING: OnboardingState = {
  dismissed: false,
  startedAt: null,
  finishedAt: null,
  currentStep: 'modules',
  category: null,
  blueprintKey: null,
  installId: null,
  story: null,
  completed: DEFAULT_COMPLETED,
};

function readOnboarding(settings: unknown): OnboardingState {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return DEFAULT_ONBOARDING;
  }
  const raw = (settings as Record<string, unknown>).onboarding;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return DEFAULT_ONBOARDING;
  }
  const rec = raw as Record<string, unknown>;
  const completedRaw = (rec.completed ?? {}) as Record<string, unknown>;
  const story = StoryNarrative.safeParse(rec.story);
  return {
    dismissed: typeof rec.dismissed === 'boolean' ? rec.dismissed : false,
    startedAt: typeof rec.startedAt === 'string' ? rec.startedAt : null,
    finishedAt: typeof rec.finishedAt === 'string' ? rec.finishedAt : null,
    currentStep: ONBOARDING_STEPS.includes(rec.currentStep as OnboardingStep)
      ? (rec.currentStep as OnboardingStep)
      : 'modules',
    category: typeof rec.category === 'string' ? rec.category : null,
    blueprintKey: typeof rec.blueprintKey === 'string' ? rec.blueprintKey : null,
    installId: typeof rec.installId === 'string' ? rec.installId : null,
    story: story.success ? story.data : null,
    completed: {
      modules: completedRaw.modules === true,
      template: completedRaw.template === true,
      workspace: completedRaw.workspace === true,
      domain: completedRaw.domain === true,
      payments: completedRaw.payments === true,
    },
  };
}

function readModuleFlags(settings: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const slug of MODULE_SLUGS) out[slug] = false;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return out;
  const modules = (settings as Record<string, unknown>).modules;
  if (!modules || typeof modules !== 'object') return out;
  for (const slug of MODULE_SLUGS) {
    const slot = (modules as Record<string, unknown>)[slug];
    if (slot && typeof slot === 'object' && (slot as Record<string, unknown>).enabled === true) {
      out[slug] = true;
    }
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; no top-level await needed because route registration is sync.
const tenantRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/tenant', async (request) => {
    const auth = requireAuth(request);
    const row = await prisma.tenant.findUnique({
      where: { id: auth.tenantId },
      select: { id: true, name: true, email: true, slug: true, plan: true, socials: true },
    });
    if (!row) throw notFound('Tenant', auth.tenantId);
    return ok({ ...row, socials: readSocials(row.socials) });
  });

  app.patch('/v1/tenant', async (request) => {
    const auth = requireRole(request, 'admin');
    const input = PatchTenant.parse(request.body);
    const row = await prisma.tenant.update({
      where: { id: auth.tenantId },
      data: input,
      select: { id: true, name: true, email: true, slug: true, plan: true, socials: true },
    });
    return ok({ ...row, socials: readSocials(row.socials) });
  });

  // Cookie-consent config (docs/42 §4). Read by any staff; edited by admins.
  app.get('/v1/tenant/consent', async (request) => {
    requireAuth(request);
    const row = await withRequestTenant(request, (tx) =>
      tx.consentSettings.findUnique({
        where: { tenantId: requireAuth(request).tenantId },
      })
    );
    return ok(serializeConsent(row));
  });

  app.patch('/v1/tenant/consent', async (request) => {
    const auth = requireRole(request, 'admin');
    const input = PatchConsent.parse(request.body);
    const row = await withRequestTenant(request, (tx) =>
      tx.consentSettings.upsert({
        where: { tenantId: auth.tenantId },
        create: {
          tenantId: auth.tenantId,
          mode: input.mode ?? 'off',
          activeCategories: input.activeCategories ?? [],
          bannerTitle: input.bannerTitle ?? null,
          bannerBody: input.bannerBody ?? null,
          policyPageSlug: input.policyPageSlug ?? 'cookie-policy',
          policyVersion: input.policyVersion ?? '1',
        },
        update: {
          ...(input.mode !== undefined ? { mode: input.mode } : {}),
          ...(input.activeCategories !== undefined
            ? { activeCategories: input.activeCategories }
            : {}),
          ...(input.bannerTitle !== undefined ? { bannerTitle: input.bannerTitle } : {}),
          ...(input.bannerBody !== undefined ? { bannerBody: input.bannerBody } : {}),
          ...(input.policyPageSlug !== undefined ? { policyPageSlug: input.policyPageSlug } : {}),
          ...(input.policyVersion !== undefined ? { policyVersion: input.policyVersion } : {}),
        },
      })
    );
    return ok(serializeConsent(row));
  });

  // Subdomain availability check for the onboarding domain step. Returns
  // { available, reason?, suggestions? } so the wizard can guide the tenant.
  app.get('/v1/tenant/slug-availability', async (request) => {
    const auth = requireAuth(request);
    const { slug } = SlugQuery.parse(request.query);
    const normalized = slug.trim().toLowerCase();

    if (!SLUG_RE.test(normalized) || normalized.length < 3 || normalized.length > 63) {
      return ok({ available: false, reason: 'invalid', suggestions: slugSuggestions(normalized) });
    }
    if (RESERVED_SLUGS.has(normalized) && !isPlatformTenant(auth.tenantId)) {
      return ok({ available: false, reason: 'reserved', suggestions: slugSuggestions(normalized) });
    }
    const existing = await prisma.tenant.findUnique({
      where: { slug: normalized },
      select: { id: true },
    });
    if (existing && existing.id !== auth.tenantId) {
      return ok({ available: false, reason: 'taken', suggestions: slugSuggestions(normalized) });
    }
    return ok({ available: true });
  });

  // Update the tenant's storefront subdomain. Owner/admin only. Renames the
  // always-on `<slug>.sparx.zone` subdomain(s) in lockstep — provisioning mints
  // them from the SIGNUP slug, so an onboarding/admin slug change must rename
  // them too, or the canonical host dangles at a slug that no longer resolves.
  app.patch('/v1/tenant/slug', async (request) => {
    const auth = requireRole(request, 'admin');
    const { slug } = SlugBody.parse(request.body);
    const normalized = slug.trim().toLowerCase();
    if (RESERVED_SLUGS.has(normalized) && !isPlatformTenant(auth.tenantId)) {
      throw conflict('That subdomain is reserved.', 'slug');
    }
    const existing = await prisma.tenant.findUnique({
      where: { slug: normalized },
      select: { id: true },
    });
    if (existing && existing.id !== auth.tenantId) {
      throw conflict('That subdomain is already taken.', 'slug');
    }
    const before = await prisma.tenant.findUnique({
      where: { id: auth.tenantId },
      select: { slug: true },
    });
    const oldSlug = before?.slug ?? null;

    const row = await prisma.$transaction(async (tx) => {
      const updated = await tx.tenant.update({
        where: { id: auth.tenantId },
        data: { slug: normalized },
        select: { id: true, name: true, email: true, slug: true, plan: true },
      });
      if (oldSlug && oldSlug !== normalized) {
        await renameZoneSubdomains(tx, auth.tenantId, oldSlug, normalized);
      }
      return updated;
    });
    return ok(row);
  });

  app.get('/v1/tenant/modules', async (request) => {
    const auth = requireAuth(request);
    const row = await prisma.tenant.findUnique({
      where: { id: auth.tenantId },
      select: { settings: true },
    });
    // Enriched rows: `enabled` honors the BUNDLED_FREE graph (invoicing is on for
    // any B2B/Commerce tenant), and `source`/`includedBy`/`requiredBy` let the UI
    // lock + label a bundled or required toggle. Extra fields are additive — older
    // `{ slug, enabled }` consumers keep working.
    const states = deriveModuleStates(row?.settings);
    return ok(MODULE_SLUGS.map((slug) => moduleRow(slug, states)));
  });

  app.patch('/v1/tenant/modules/:slug', async (request) => {
    const auth = requireRole(request, 'admin');
    const { slug } = ModuleParams.parse(request.params);
    const { enabled } = ModulePatch.parse(request.body);

    const before = await prisma.tenant.findUnique({
      where: { id: auth.tenantId },
      select: { settings: true },
    });
    if (!before) throw notFound('Tenant', auth.tenantId);

    const target = slug as ModuleSlug;
    const currentFlags = readModuleFlags(before.settings);
    const writes = new Map<ModuleSlug, boolean>();

    if (enabled) {
      // Turn it on, and auto-enable every PAID requirement (each is separately
      // billed — e.g. enabling B2B also activates Commerce at $49). REQUIRES is
      // not derived, so these flags are physically written here.
      for (const m of [target, ...requiredModules(target)]) {
        if (currentFlags[m] !== true) writes.set(m, true);
      }
    } else {
      // Block teardown of a module another ENABLED module still requires (you
      // must disable B2B before you can disable Commerce).
      const blockers = blockingDependents(target, (m) => currentFlags[m] === true);
      if (blockers.length) {
        throw conflict(
          `Turn off ${blockers.join(' and ')} first — ${
            blockers.length > 1 ? 'they require' : 'it requires'
          } ${target}.`,
          'module'
        );
      }
      if (currentFlags[target] === true) writes.set(target, false);
    }

    await applyModuleWrites(request.log, auth.tenantId, auth.actorId, before.settings, writes);
    return ok({ slug: target, enabled });
  });

  // Bulk-set module flags in ONE read-modify-write — the onboarding Modules step
  // flips the whole switchboard at once, so N per-slug round-trips (and N racing
  // cache invalidations) would be wasteful. Merges the provided slugs into
  // settings.modules (absent slugs untouched), invalidates the cache for each
  // slug whose value actually changed, and returns the full module list (same
  // shape as GET). Owner/admin only, mirroring the per-slug PATCH.
  app.put('/v1/tenant/modules', async (request) => {
    const auth = requireRole(request, 'admin');
    const { modules } = ModulesBulkPut.parse(request.body);

    const entries = Object.entries(modules);
    for (const [slug] of entries) {
      if (!MODULE_SLUG_SET.has(slug)) throw badRequest(`Unknown module slug: ${slug}`);
    }

    const before = await prisma.tenant.findUnique({
      where: { id: auth.tenantId },
      select: { settings: true },
    });
    if (!before) throw notFound('Tenant', auth.tenantId);

    const currentFlags = readModuleFlags(before.settings);
    // Desired explicit state = current ⊕ request.
    const desired: Record<string, boolean> = { ...currentFlags };
    for (const [slug, enabled] of entries) desired[slug] = enabled;
    // Enforce REQUIRES by fixing FORWARD: anything left on forces its paid
    // requirements on too. Onboarding flips the whole switchboard at once, so we
    // auto-add (Commerce when B2B is picked) rather than reject — you can never
    // land in a B2B-on / Commerce-off state. The per-slug PATCH is the surface
    // that *blocks* an explicit teardown.
    for (const slug of MODULE_SLUGS) {
      if (desired[slug]) {
        for (const dep of requiredModules(slug)) desired[dep] = true;
      }
    }

    const writes = new Map<ModuleSlug, boolean>();
    for (const slug of MODULE_SLUGS) {
      if ((currentFlags[slug] === true) !== (desired[slug] === true)) {
        writes.set(slug, desired[slug] === true);
      }
    }

    const effective = await applyModuleWrites(
      request.log,
      auth.tenantId,
      auth.actorId,
      before.settings,
      writes
    );

    const states = deriveModuleStates(effective);
    return ok(MODULE_SLUGS.map((slug) => moduleRow(slug, states)));
  });

  app.get('/v1/tenant/onboarding', async (request) => {
    const auth = requireAuth(request);
    const row = await prisma.tenant.findUnique({
      where: { id: auth.tenantId },
      select: { settings: true },
    });
    return ok(readOnboarding(row?.settings ?? null));
  });

  app.patch('/v1/tenant/onboarding', async (request) => {
    const auth = requireAuth(request);
    const input = OnboardingPatch.parse(request.body);

    const before = await prisma.tenant.findUnique({
      where: { id: auth.tenantId },
      select: { settings: true },
    });
    if (!before) throw notFound('Tenant', auth.tenantId);

    const currentSettings = (before.settings as Record<string, unknown> | null) ?? {};
    const currentOnboarding = readOnboarding(before.settings ?? null);
    const nextOnboarding: OnboardingState = {
      ...currentOnboarding,
      ...input,
      // `completed` is a nested partial — deep-merge so a single step flip
      // doesn't clobber the other steps' flags.
      completed: { ...currentOnboarding.completed, ...(input.completed ?? {}) },
    };
    const nextSettings = {
      ...currentSettings,
      onboarding: nextOnboarding,
    } as unknown as Prisma.InputJsonValue;

    await prisma.tenant.update({
      where: { id: auth.tenantId },
      data: { settings: nextSettings },
    });
    return ok(nextOnboarding);
  });

  app.get('/v1/tenant/onboarding/progress', async (request) => {
    const auth = requireAuth(request);
    const tenant = await prisma.tenant.findUnique({
      where: { id: auth.tenantId },
      select: { name: true, settings: true },
    });
    if (!tenant) throw notFound('Tenant', auth.tenantId);

    const state = readOnboarding(tenant.settings ?? null);
    // "First page" signal: count the tenant's own CMS pages (the live
    // content_entries model — NOT the deprecated `Page` table, which no longer
    // receives writes). Auto-seeded legal pages (legal_kind set, docs/42) are
    // excluded so the step reflects a page the tenant actually created. Read
    // inside withRequestTenant so the FORCE-RLS count is tenant-scoped.
    const [pageCount, tenantRow] = await Promise.all([
      withRequestTenant(request, (tx) =>
        tx.contentEntry.count({ where: { typeKey: 'page', legalKind: null, deletedAt: null } })
      ),
      prisma.tenant.findUnique({
        where: { id: auth.tenantId },
        select: { stripeAccountId: true },
      }),
    ]);

    const steps = [
      {
        id: 'account' as const,
        title: 'Create your account',
        description: 'Email, password, and site name.',
        done: true,
      },
      {
        id: 'tenant' as const,
        title: 'Confirm your site details',
        description: 'Make sure the contact email and site name look right.',
        done: Boolean(tenant.name),
        cta: { label: 'Open settings', href: '/settings/general' },
      },
      {
        id: 'first-page' as const,
        title: 'Add your first page',
        description: 'About, Contact, or any landing page to get started.',
        done: pageCount > 0,
        cta: { label: 'Open CMS', href: '/cms' },
      },
      {
        id: 'theme' as const,
        title: 'Choose a template',
        description: 'Start from a complete, themed template — or design your own in the Builder.',
        done: state.completed.template,
        cta: { label: 'Browse templates', href: '/marketplace/blueprints' },
      },
      {
        id: 'domain' as const,
        title: 'Set your site address',
        description: 'Purchase a domain or connect one you already own.',
        done: state.completed.domain,
        cta: { label: 'Manage domains', href: '/settings/domains' },
      },
      {
        id: 'payments' as const,
        title: 'Connect payments',
        description: 'Connect Stripe to accept orders and payouts.',
        done: Boolean(tenantRow?.stripeAccountId),
        cta: { label: 'Connect Stripe', href: '/onboarding?step=payments' },
      },
    ];

    const actionable = steps;
    const completion = actionable.length
      ? actionable.filter((s) => s.done).length / actionable.length
      : 1;

    return ok({ state, pageCount, steps, completion });
  });

  // ── Stripe Connect OAuth ──────────────────────────────────────────────────
  //
  //   GET  /v1/tenant/onboarding/stripe/connect-url  → { url } (owner only)
  //   POST /v1/tenant/onboarding/stripe/exchange      → { stripeAccountId }
  //
  // The connect-url route builds the Stripe OAuth URL with a signed state JWT
  // (HS256, tid+exp) so the exchange endpoint can verify CSRF. The callback
  // lives in the dashboard at /onboarding/stripe-callback, which posts back
  // here to exchange the code.

  app.get('/v1/tenant/onboarding/stripe/connect-url', async (request, reply) => {
    const auth = requireRole(request, 'owner');
    await requireVerifiedEmail(request);

    if (!env.STRIPE_CLIENT_ID) {
      throw badRequest('Stripe Connect is not configured on this platform.');
    }
    if (!env.SPARX_INTERNAL_JWT_SECRET) {
      throw badRequest('Internal JWT secret is not configured.');
    }

    const redirectUri = (request.query as Record<string, string>).redirect_uri ?? '';
    if (!redirectUri) throw badRequest('redirect_uri is required');

    // Short-lived (10 min) state token to prevent CSRF on the callback.
    const secret = new TextEncoder().encode(env.SPARX_INTERNAL_JWT_SECRET);
    const state = await new SignJWT({ tid: auth.tenantId })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('10m')
      .sign(secret);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: env.STRIPE_CLIENT_ID,
      scope: 'read_write',
      redirect_uri: redirectUri,
      state,
    });
    const url = `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
    return reply.send(ok({ url }));
  });

  const ExchangeBody = z.object({ code: z.string().min(1), state: z.string().min(1) });

  app.post('/v1/tenant/onboarding/stripe/exchange', async (request, reply) => {
    const auth = requireRole(request, 'owner');
    await requireVerifiedEmail(request);

    if (!env.STRIPE_SECRET_KEY) {
      throw badRequest('Stripe is not configured on this platform.');
    }
    if (!env.SPARX_INTERNAL_JWT_SECRET) {
      throw badRequest('Internal JWT secret is not configured.');
    }

    const body = ExchangeBody.parse(request.body);

    // Verify state JWT and confirm it belongs to the authenticated tenant.
    const secret = new TextEncoder().encode(env.SPARX_INTERNAL_JWT_SECRET);
    let payload: { tid?: unknown };
    try {
      const result = await jwtVerify(body.state, secret);
      payload = result.payload as { tid?: unknown };
    } catch {
      throw forbidden('Invalid or expired state token.');
    }
    if (payload.tid !== auth.tenantId) throw forbidden('State token tenant mismatch.');

    // Exchange the authorization code for a Stripe account ID.
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
    });
    const token = await stripe.oauth.token({ grant_type: 'authorization_code', code: body.code });
    const stripeAccountId = token.stripe_user_id;
    if (!stripeAccountId) throw badRequest('Stripe did not return an account ID.');

    await prisma.tenant.update({
      where: { id: auth.tenantId },
      data: { stripeAccountId },
    });

    return reply.send(ok({ stripeAccountId }));
  });
};

export default tenantRoutes;
