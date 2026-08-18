// Tenant — general settings, module flags, onboarding state.
//
//   GET    /v1/tenant                              → basic tenant card
//   PATCH  /v1/tenant                              → name / email
//   GET    /v1/tenant/modules                      → [{slug, enabled}]
//   PUT    /v1/tenant/modules                      → bulk-set { slug: enabled } (owner/admin)
//   PATCH  /v1/tenant/modules/:slug                → toggle enabled (owner/admin)
//   POST   /v1/tenant/modules/reconcile            → all-on, brands that include them (owner/admin)
//   GET    /v1/tenant/rail                         → { apps } — the rail preference
//   PUT    /v1/tenant/rail                         → set it (owner/admin)
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

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma, type Prisma } from '@wizeworks/db';
import { withRequestTenant } from '@wizeworks/api-core/db';
import { publish } from '@wizeworks/api-core/pubsub';
import { ok } from '@wizeworks/api-core/envelope';
import { requireAuth, requireRole } from '@wizeworks/api-core/auth';
import { requireVerifiedEmail } from '../../lib/verified-email-guard.js';
import { badRequest, conflict, notFound } from '@wizeworks/api-core/errors';
import { appOrigin } from '@wizeworks/links/server';
import { zoneOf } from '../../lib/domain.js';
import {
  requiredModules,
  blockingDependents,
  deriveModuleStates,
  memberCanReachModule,
  parseModuleAccessMode,
  type MemberModuleAccessInput,
  type ModuleSlug,
} from '@wizeworks/auth';
import {
  MODULE_SLUGS,
  MODULE_SLUG_SET,
  readModuleFlags,
  applyModuleWrites,
  toggleTenantModule,
  moduleBlockedMessage,
} from '../../lib/module-toggle.js';
import { brandIncludesEveryModule, tenantPlatformBrand } from '../../lib/tenant-brand.js';
import { computeBannerEnabled } from '../../lib/consent.js';
import { resolvePropertyId } from '../../lib/property.js';
import {
  PaymentsUnconfiguredError,
  refreshSparxPayStatus,
  startSparxPayOnboarding,
} from '../../lib/payments-onboarding.js';
import { env } from '../../env.js';

// Human labels for the module-toggle confirmation email — acronyms stay uppercase.
// A slug not listed falls back to itself; keep in step with the module registry.
const MODULE_LABELS: Record<string, string> = {
  builder: 'Builder',
  commerce: 'Commerce',
  cms: 'CMS',
  crm: 'CRM',
  invoicing: 'Invoicing',
  email: 'Email',
  b2b: 'B2B',
  dropship: 'Dropship',
  inventory: 'Inventory',
  chat: 'Chat',
  scheduling: 'Scheduling',
  ai: 'AI',
  automations: 'Automations',
  seo: 'SEO',
  social: 'Social',
};

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

// Shape one module's row for GET/PUT responses: enabled + WHY, so the dashboard
// can lock + label a bundled/required toggle instead of letting it be flipped.
function moduleRow(
  slug: ModuleSlug,
  states: ReturnType<typeof deriveModuleStates>,
  // Optional so the PUT/PATCH responses (which answer "what is the tenant's
  // configuration now?", not "what may you personally open?") can omit it.
  access?: MemberModuleAccessInput
): {
  slug: ModuleSlug;
  enabled: boolean;
  source: string;
  includedBy: ModuleSlug[];
  requiredBy: ModuleSlug[];
  reachable?: boolean;
} {
  return {
    slug,
    enabled: states[slug].enabled,
    source: states[slug].source,
    includedBy: states[slug].includedBy,
    requiredBy: blockingDependents(slug, (m) => states[m].enabled),
    // Whether THIS CALLER may open the module, which is a different question
    // from whether the tenant has bought it. `enabled` is about the account;
    // `reachable` is about the person holding the token.
    //
    // Additive and separate on purpose. This endpoint is shared with the
    // dashboard's Settings → Modules screen, its onboarding, and its order
    // lens; narrowing `enabled` here would quietly change what those screens
    // show. A new field leaves every existing consumer reading exactly what it
    // read before, and lets the workbench opt in.
    ...(access ? { reachable: memberCanReachModule(access, slug) } : {}),
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

// Rename every always-on zone subdomain in lockstep with a tenant slug change.
// Provisioning mints `<slug>.<zone>` (primary) and multi-site adds
// `<prop>.<slug>.<zone>` — all embed the tenant slug, so the slug segment must
// be rewritten or the canonical host dangles. Custom domains (type !==
// 'subdomain') are never touched.
//
// ── THE ZONE COMES FROM THE ROW, NOT FROM THE ENVIRONMENT ───────────────────
//
// This read `SPARX_ZONE_DOMAIN` — the SINGULAR variable, which no deployment
// sets any more — so it fell back to the literal `sparx.zone` and rewrote
// nothing for a Piggles tenant. Renaming a Piggles business left every
// `<oldSlug>.piggles.site` row untouched: the canonical host kept a slug the
// tenant no longer had, and the console showed one address while the site
// answered on another.
//
// Reading the zone off each ROW is the fix and also the only version that
// cannot rot. A tenant's zone is a fact about the tenant, already recorded in
// the host it was minted with; `zoneOf` is exactly the "work out the zone
// without branching on brand" seam, and a third brand needs no edit here.
async function renameZoneSubdomains(
  tx: Prisma.TransactionClient,
  tenantId: string,
  oldSlug: string,
  newSlug: string
): Promise<void> {
  const subdomains = await tx.domain.findMany({
    where: { tenantId, type: 'subdomain' },
    select: { id: true, host: true },
  });
  for (const d of subdomains) {
    // A subdomain row in a zone this deployment does not own is left alone
    // rather than guessed at — rewriting a host we do not serve is how a
    // working address becomes a dead one.
    const zone = zoneOf(d.host);
    if (!zone) continue;
    const exact = `${oldSlug}.${zone}`;
    const suffix = `.${oldSlug}.${zone}`;
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

// The rail's app ids belong to the calling product's registry, so they are
// length-capped and de-duplicated rather than checked against a list — a copy of
// another app's ids here is a copy that drifts. An id that resolves to nothing
// simply shows nothing.
const RailPut = z.object({
  apps: z
    .array(z.string().min(1).max(64))
    .max(64)
    .transform((apps) => [...new Set(apps)]),
});

/** The rail preference, or `null` when this business has never set one — which
 *  the client reads as "use your defaults", never as "an empty rail". */
function readRailApps(settings: unknown): string[] | null {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return null;
  const rail = (settings as Record<string, unknown>).rail;
  if (!rail || typeof rail !== 'object' || Array.isArray(rail)) return null;
  const apps = (rail as Record<string, unknown>).apps;
  if (!Array.isArray(apps)) return null;
  return apps.filter((app): app is string => typeof app === 'string');
}

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

// Which onboarding front end the tenant EXPLICITLY asked for, set only when they use
// one of the two switch links (`story` ⇄ `classic`). Null means they never chose, and
// the dashboard derives an entry from the rest of the state. This exists because the
// derived rule alone is a one-way latch: composing a story saves a draft, and a saved
// draft always routes back to /story — so without a recorded preference an owner who
// touched the composer could never reach the wizard again.
const ONBOARDING_FLOWS = ['story', 'classic'] as const;
type OnboardingFlow = (typeof ONBOARDING_FLOWS)[number];

const OnboardingPatch = z.object({
  dismissed: z.boolean().optional(),
  startedAt: z.string().datetime().nullable().optional(),
  finishedAt: z.string().datetime().nullable().optional(),
  currentStep: z.enum(ONBOARDING_STEPS).optional(),
  // The tenant's explicit front-end choice; outranks every derived routing hint.
  flow: z.enum(ONBOARDING_FLOWS).nullable().optional(),
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
  flow: OnboardingFlow | null;
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
  flow: null,
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
    flow: ONBOARDING_FLOWS.includes(rec.flow as OnboardingFlow)
      ? (rec.flow as OnboardingFlow)
      : null,
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

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; no top-level await needed because route registration is sync.
const tenantRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/tenant', async (request) => {
    const auth = requireAuth(request);
    const row = await prisma.tenant.findUnique({
      where: { id: auth.tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        slug: true,
        plan: true,
        socials: true,
        settings: true,
      },
    });
    if (!row) throw notFound('Tenant', auth.tenantId);
    return ok({
      id: row.id,
      name: row.name,
      email: row.email,
      slug: row.slug,
      plan: row.plan,
      socials: readSocials(row.socials),
    });
  });

  app.patch('/v1/tenant', async (request) => {
    const auth = requireRole(request, 'admin');
    const input = PatchTenant.parse(request.body);
    const row = await prisma.tenant.update({
      where: { id: auth.tenantId },
      data: input,
      select: { id: true, name: true, email: true, slug: true, plan: true, socials: true },
    });

    // A tenant renaming itself is how a placeholder workspace name ("Sam's
    // workspace") becomes the real business name — the platform-crm-worker
    // consumes this so sparx's own CRM board calls them what they call
    // themselves (docs/140 §5).
    await publish(request.log, 'tenant.updated', row.id, auth.actorId, {
      slug: row.slug,
      name: row.name,
      changed: Object.keys(input),
    });

    return ok({ ...row, socials: readSocials(row.socials) });
  });

  // Cookie-consent config (docs/42 §4), PER SITE (docs/131 §3.9). The route
  // keeps its `/v1/tenant/consent` path for now, but the row it reads and writes
  // belongs to the site in the switcher — two businesses under one tenant run
  // their own banner, regime, and policy version.
  app.get('/v1/tenant/consent', async (request) => {
    const auth = requireAuth(request);
    const propertyId = await resolvePropertyId(
      auth,
      request.headers['x-sparx-property-id'] as string | undefined
    );
    const row = await withRequestTenant(request, (tx) =>
      tx.consentSettings.findUnique({
        where: { tenantId_propertyId: { tenantId: auth.tenantId, propertyId } },
      })
    );
    return ok(serializeConsent(row));
  });

  app.patch('/v1/tenant/consent', async (request) => {
    const auth = requireRole(request, 'admin');
    const input = PatchConsent.parse(request.body);
    const propertyId = await resolvePropertyId(
      auth,
      request.headers['x-sparx-property-id'] as string | undefined
    );
    const row = await withRequestTenant(request, (tx) =>
      tx.consentSettings.upsert({
        where: { tenantId_propertyId: { tenantId: auth.tenantId, propertyId } },
        create: {
          tenantId: auth.tenantId,
          propertyId,
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

    // The caller's own membership, for the per-person `reachable` flag.
    //
    // Wrapped in the tenant context because `members` carries an RLS policy
    // keyed on current_tenant_id() — an unwrapped read as `sparx_app` returns
    // no row at all, which would look exactly like "this person has no
    // membership" and silently mean something completely different.
    //
    // A genuinely missing member row (a token minted before the org backfill,
    // or a service-to-service actor) falls back to UNRESTRICTED. This flag
    // exists to hide doors that would 403 anyway; inventing a restriction out
    // of absent data would blank someone's navigation over a data gap rather
    // than a decision anybody made. The API gates stay the real enforcement.
    const membership = await withRequestTenant(request, (tx) =>
      tx.member.findUnique({
        where: { organizationId_userId: { organizationId: auth.tenantId, userId: auth.actorId } },
        select: { role: true, moduleAccessMode: true, moduleAccess: { select: { module: true } } },
      })
    );
    const access: MemberModuleAccessInput = {
      role: membership?.role ?? auth.role,
      mode: parseModuleAccessMode(membership?.moduleAccessMode),
      granted: membership?.moduleAccess.map((grant) => grant.module) ?? [],
    };
    // Enriched rows: `enabled` honors the BUNDLED_FREE graph (invoicing is on for
    // any B2B/Commerce tenant), and `source`/`includedBy`/`requiredBy` let the UI
    // lock + label a bundled or required toggle. Extra fields are additive — older
    // `{ slug, enabled }` consumers keep working.
    const states = deriveModuleStates(row?.settings);
    return ok(MODULE_SLUGS.map((slug) => moduleRow(slug, states, access)));
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
    // The whole toggle mechanic — REQUIRES fan-out, dependent guard, flag write,
    // dual-bus announce, cache flush, Stripe sync — lives in the shared lib so
    // the operator console drives the identical path (build-plan §5 Slice 8).
    const result = await toggleTenantModule({
      log: request.log,
      tenantId: auth.tenantId,
      actorId: auth.actorId,
      slug: target,
      enabled,
      beforeSettings: before.settings,
    });
    if (result.blocked.length) {
      throw conflict(moduleBlockedMessage(result.blocked, target), 'module');
    }
    // Confirm a real change to the account owner — a module toggle carries a billing
    // implication, so it's never silent. Only on an actual flip (a redundant toggle is
    // a no-op), and only the per-slug path — the bulk onboarding PUT would spam.
    if (result.changed) {
      try {
        const owner = await prisma.tenant.findUnique({
          where: { id: auth.tenantId },
          select: { email: true, name: true, platformBrand: true },
        });
        if (owner?.email) {
          await publish(request.log, 'email.send', auth.tenantId, auth.actorId, {
            to: owner.email,
            template: 'module-toggle',
            props: {
              enabled,
              accountName: owner.name ?? undefined,
              moduleName: MODULE_LABELS[target] ?? target,
              dashboardUrl: appOrigin(owner.platformBrand),
            },
          });
        }
      } catch (err) {
        request.log.warn({ err, slug: target }, 'failed to publish module-toggle email');
      }
    }
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

  // Bring a tenant up to every module, for brands whose plan includes them all.
  //
  // Idempotent, and a no-op for a brand that bills per module — a route that
  // switched everything on for a sparx tenant would be giving away the product.
  // Goes through `applyModuleWrites` like every other activation, so each newly
  // enabled module announces `module.activated` and gets its baseline seeded;
  // writing the flags alone would leave an app switched on and empty.
  app.post('/v1/tenant/modules/reconcile', async (request) => {
    const auth = requireRole(request, 'admin');
    const brand = await tenantPlatformBrand(auth.tenantId);
    if (!brandIncludesEveryModule(brand)) return ok({ activated: [] });

    const before = await prisma.tenant.findUnique({
      where: { id: auth.tenantId },
      select: { settings: true },
    });
    if (!before) throw notFound('Tenant', auth.tenantId);

    const currentFlags = readModuleFlags(before.settings);
    const writes = new Map<ModuleSlug, boolean>();
    for (const slug of MODULE_SLUGS) {
      if (currentFlags[slug] !== true) writes.set(slug, true);
    }
    if (writes.size === 0) return ok({ activated: [] });

    request.log.info(
      { tenantId: auth.tenantId, brand, slugs: [...writes.keys()] },
      'reconciling tenant to every module'
    );
    await applyModuleWrites(request.log, auth.tenantId, auth.actorId, before.settings, writes);
    return ok({ activated: [...writes.keys()] });
  });

  // ── The app rail ───────────────────────────────────────────────────────────
  //
  // Which apps this BUSINESS keeps on its rail. Deliberately opaque here: the
  // ids are the calling product's app registry, which api-rest has no business
  // holding a copy of. It stores a list and hands it back.
  //
  // NOT an entitlement, and the distinction is the whole point of the route.
  // Module flags answer "does this tenant have the capability"; this answers
  // "does this business want it in front of them". A brand that includes every
  // module has no use for the first question and still needs the second, and
  // before this existed it borrowed the module flags to answer it — which turned
  // a display preference into a locked door.
  app.get('/v1/tenant/rail', async (request) => {
    const auth = requireAuth(request);
    const row = await prisma.tenant.findUnique({
      where: { id: auth.tenantId },
      select: { settings: true },
    });
    return ok({ apps: readRailApps(row?.settings ?? null) });
  });

  // Owner/admin, mirroring the module routes: what the rail carries is a
  // decision about the business, not a personal view. Per-person shortcuts are
  // favourites and recents on the /v1/me spine.
  app.put('/v1/tenant/rail', async (request) => {
    const auth = requireRole(request, 'admin');
    const { apps } = RailPut.parse(request.body);

    const before = await prisma.tenant.findUnique({
      where: { id: auth.tenantId },
      select: { settings: true },
    });
    if (!before) throw notFound('Tenant', auth.tenantId);

    // Read-modify-write, MERGED — `settings` is a shared per-tenant blob and
    // assigning it would drop modules, onboarding and everything else in there.
    const settings = (before.settings as Record<string, unknown> | null) ?? {};
    const rail = (settings.rail as Record<string, unknown> | undefined) ?? {};
    await prisma.tenant.update({
      where: { id: auth.tenantId },
      data: { settings: { ...settings, rail: { ...rail, apps } } },
    });
    return ok({ apps });
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
    const [pageCount, paymentConfig] = await Promise.all([
      withRequestTenant(request, (tx) =>
        tx.contentEntry.count({ where: { typeKey: 'page', legalKind: null, deletedAt: null } })
      ),
      // The payments step is "done" when the tenant can actually collect — the
      // stored `isActive` on their gateway config (sparx Pay charges-enabled, an
      // api-key gateway with credentials, or manual). This reads the same synced
      // flag Settings → Payments shows, so the two never disagree. (It replaced a
      // `Boolean(stripeAccountId)` check that flipped "done" the instant the Express
      // account was CREATED — before onboarding/KYC finished — and only knew about
      // sparx Pay.)
      withRequestTenant(request, (tx) =>
        tx.tenantPaymentConfig.findUnique({
          where: { tenantId: auth.tenantId },
          select: { isActive: true },
        })
      ),
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
        done: Boolean(paymentConfig?.isActive),
        cta: { label: 'Connect Stripe', href: '/onboarding?step=payments' },
      },
    ];

    const actionable = steps;
    const completion = actionable.length
      ? actionable.filter((s) => s.done).length / actionable.length
      : 1;

    return ok({ state, pageCount, steps, completion });
  });

  // ── sparx Pay onboarding (Stripe Connect EXPRESS) ─────────────────────────
  //
  //   POST /v1/tenant/onboarding/payments/onboard  { returnUrl, refreshUrl } → { url, accountId }
  //   POST /v1/tenant/onboarding/payments/refresh   → { connected, status }
  //
  // Onboarding's "Connect payments" step shares the SAME Stripe Connect EXPRESS
  // account model as Settings → Payments (docs/94): one connected account per tenant
  // on `tenant.stripeAccountId`, one Stripe-hosted Account Link flow, reconciled by
  // the same lib. This REPLACED an older OAuth/Standard "connect an existing account"
  // flow that wrote the SAME `stripeAccountId` column with an incompatible Standard
  // account — which then broke the Express-only payouts/balance UI (login links +
  // shared balance are Express/Custom only) and never touched `tenant_payment_configs`,
  // so Settings mis-reported a connected tenant as "Not collecting". A merchant who
  // wants to use their OWN Stripe account picks `stripe_direct` in Settings (pasted
  // keys), not a second account-connect path.
  //
  // NOT gated on the commerce module: payments are connected during onboarding, before
  // commerce is configured (and underpin invoicing/scheduling too). The commerce
  // Settings surface (`/v1/commerce/payments/*`) is the module-gated twin over this
  // same lib. `startSparxPayOnboarding` creates-or-resumes the account, so re-running
  // is idempotent.

  const OnboardBody = z.object({
    returnUrl: z.string().url(),
    refreshUrl: z.string().url(),
  });

  app.post('/v1/tenant/onboarding/payments/onboard', async (request) => {
    const auth = requireRole(request, 'owner');
    await requireVerifiedEmail(request);
    const body = OnboardBody.parse(request.body);
    try {
      return ok(await startSparxPayOnboarding({ tenantId: auth.tenantId, ...body }));
    } catch (err) {
      if (err instanceof PaymentsUnconfiguredError) {
        throw badRequest(
          'Payments are not available yet — the platform is not configured to accept them.'
        );
      }
      throw err;
    }
  });

  app.post('/v1/tenant/onboarding/payments/refresh', async (request) => {
    const auth = requireRole(request, 'owner');
    await requireVerifiedEmail(request);
    // Called when the onboarding popup returns from Stripe: pull live account status
    // and sync `tenant_payment_configs.isActive` so the step (and Settings) reflect
    // real charge-readiness immediately, without waiting for the account.updated webhook.
    const config = await refreshSparxPayStatus(auth.tenantId);
    return ok({
      // The Express account exists once onboarding has begun; charge-ability (KYC) may
      // still be pending in Stripe. The step's "done" tracks `isActive` (charges enabled).
      connected: Boolean(config.sparxPay.accountId),
      status: config.sparxPay,
    });
  });
};

export default tenantRoutes;
