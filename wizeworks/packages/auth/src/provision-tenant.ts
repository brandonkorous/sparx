import type { AttributionSnapshot } from '@wizeworks/attribution';
import type { Prisma } from '@prisma/client';
import { currentPlatformBrand, platformBrandIdentity } from '@wizeworks/brand-core';
import { randomFriendlySlug } from './friendly-slug';

// Tenant provisioning shared by every account-creation path: email/password
// sign-up (signUpMerchant) and — once wired — the Google OAuth user-creation
// hook. Keeping it here means there is ONE place that knows a tenant is born
// with a primary property + its free `<slug>.<zone>` subdomain, so both paths
// stay in lockstep and the onboarding wizard always has a tenant to refine.
//
// Which zone, and which brand, are resolved in that order: what the caller
// passed, then what the brand publishes, then the deployment default. Both used
// to end at a literal naming one brand.

/** First-party acquisition attribution read at signup (docs/80 §6.1 / L-PLAT). */
export interface SignUpAcquisition {
  /** Denormalized from first-touch — the acquisition model for L-PLAT (docs/80 §9). */
  channel: string | null;
  source: string | null;
  campaign: string | null;
  /** Full snapshots retained for later model recompute (docs/80 §8.3). */
  firstTouch: AttributionSnapshot | null;
  lastTouch: AttributionSnapshot | null;
}

// Minimal shape we need to confirm slug availability — satisfied by both the
// PrismaClient and a transaction client.
interface TenantSlugLookup {
  tenant: {
    findUnique: (args: {
      where: { slug: string };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
}

/**
 * A generated friendly slug confirmed free against the DB. Loops on the rare
 * collision; after 8 misses it appends extra entropy rather than spin forever.
 * There's a tiny TOCTOU window before the insert — the `tenants.slug` unique
 * constraint is the backstop (callers translate P2002 into a typed error).
 */
export async function generateUniqueTenantSlug(db: TenantSlugLookup): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const candidate = randomFriendlySlug();
    const existing = await db.tenant.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  return `${randomFriendlySlug()}-${Date.now().toString(36).slice(-4)}`;
}

// A readable placeholder workspace name from the person's first name —
// "Brandon's workspace". The user renames it (and the generated slug) in the
// onboarding Workspace step. Shared by the email/password and Google paths.
export function workspaceNameFor(personName: string | null | undefined): string {
  const first = (personName ?? '').trim().split(/\s+/)[0];
  return `${first && first.length > 0 ? first : 'My'}'s workspace`;
}

export interface ProvisionTenantInput {
  /** Pre-generated, confirmed-unique slug (see generateUniqueTenantSlug). */
  slug: string;
  /** Tenant display name — a human-friendly placeholder ("Brandon's workspace"),
   *  renamed by the user in the onboarding Workspace step. */
  name: string;
  /** Owner email, stored on the tenant for contact. Every account-creation path
   *  (password + Google OAuth) has one, so it's required. */
  email: string;
  /** Marketing attribution (docs/80) — written once at provisioning. */
  acquisition?: SignUpAcquisition | null;
  /** Which PRODUCT the tenant signed up under — `sparx` or `piggles`. Both
   *  brands run on this one platform, one database and one tenant pool, and a
   *  tenant never changes brands.
   *
   *  This is a PARAMETER rather than a conditional on purpose. Nothing in this
   *  package may branch on the value; provisioning simply records what the
   *  caller declares, and the brand surfaces read it back. The moment a
   *  `if (brand === …)` appears in a shared package, the two products have been
   *  forked somewhere that is hard to see (piggles/CLAUDE.md RULE #0).
   *
   *  Defaults to `sparx`, which is what every pre-existing caller means. */
  platformBrand?: string;
  /** The zone the tenant's always-on subdomain is created under —
   *  `<slug>.<zoneDomain>`. Piggles tenants live on `piggles.site`, sparx
   *  tenants on `sparx.zone`.
   *
   *  It has to be an ARGUMENT and not just `SPARX_ZONE_DOMAIN`, because both
   *  brands are served by the same processes: an environment variable is fixed
   *  per deployment and cannot vary per request, so reading one here would give
   *  every Piggles signup a `sparx.zone` address. Falls back to the env var, so
   *  existing callers are unaffected. */
  zoneDomain?: string;
}

/**
 * Create the tenant + its primary web property + the always-on
 * `<slug>.sparx.zone` subdomain, inside the caller's transaction. Sets the
 * tenant RLS GUC so the FORCE-RLS `properties` insert passes its WITH CHECK
 * (authPrisma connects as sparx_owner, which IS subject to FORCE RLS). The GUC
 * is transaction-local, so it never leaks past the caller's commit.
 */
// The free trial length in days (docs/17 §6). MUST match @wizeworks/billing's
// TRIAL_PERIOD_DAYS — provisioning is the AUTHORITATIVE clock (it stamps
// tenants.trial_ends_at at signup); billing aligns Stripe to this persisted value
// when the subscription is later created. Kept local so the signup path (bundled
// into Next server actions) doesn't pull the Stripe SDK closure via @wizeworks/billing.
const TRIAL_PERIOD_DAYS = 14;

export async function provisionTenant(
  tx: Prisma.TransactionClient,
  input: ProvisionTenantInput
): Promise<{ tenantId: string; propertyId: string }> {
  const acq = input.acquisition;
  // Every tenant starts a 14-day, no-card trial the moment it's born (docs/17 §6).
  // This is the trial CLOCK — enforcement (the dashboard banner ladder + the public
  // site suspend overlay) reads `trialEndsAt`/`subscriptionStatus` off this row, so
  // the trial is a lived, enforced feature independent of whether Stripe billing has
  // been provisioned yet. The platform's own tenant is exempted downstream by the
  // billing gate (isPlatformTenant), so stamping it here is harmless.
  const trialEndsAt = new Date(Date.now() + TRIAL_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  const tenant = await tx.tenant.create({
    data: {
      name: input.name,
      slug: input.slug,
      email: input.email,
      subscriptionStatus: 'trialing',
      trialEndsAt,
      // Falls back to the brand THIS PROCESS serves, not to a literal. Each
      // brand's account app is its own deployment, so a signup that names no
      // brand belongs to whichever one took it — and a Google signup cannot
      // name one, because the hook runs before the tenant exists to carry it.
      platformBrand: input.platformBrand ?? currentPlatformBrand(),
      // Attribution (docs/80 §8.3) — written once. Denormalized channel/source/
      // campaign drive the acquisition report; the full snapshots ride along for
      // model recompute.
      ...(acq && {
        acquisitionChannel: acq.channel,
        acquisitionSource: acq.source,
        acquisitionCampaign: acq.campaign,
        acquiredAt: new Date(),
        ...(acq.firstTouch && {
          acquisitionFirstTouch: acq.firstTouch as unknown as Prisma.InputJsonValue,
        }),
        ...(acq.lastTouch && {
          acquisitionLastTouch: acq.lastTouch as unknown as Prisma.InputJsonValue,
        }),
      }),
    },
  });

  await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenant.id}::text, true)`;

  // Every tenant is born with one PRIMARY web property (docs/49) + its always-on
  // `<slug>.sparx.zone` subdomain, so host→property resolution and the Builder
  // render path have a site from day one. The default site's NAME is seeded from
  // the tenant name (docs/49) — it is the CUSTOMER-FACING site name every storefront/
  // email surface reads, so it must be a real name from the start, never "Default".
  // The merchant renames it in Settings → Sites (or onboarding updates it to the
  // business name). The host keeps the bare `<slug>.sparx.zone` (slug 'primary' is
  // reserved, never in the host).
  const property = await tx.property.create({
    data: {
      tenantId: tenant.id,
      slug: 'primary',
      name: input.name,
      isPrimary: true,
    },
  });
  // The caller's zone, else the brand's own, else the deployment default. The
  // literal used to be the last word, so a Piggles tenant provisioned by any
  // path that did not pass `zoneDomain` — Google signup, an invited owner — got
  // a site on another company's domain.
  const zone =
    input.zoneDomain ??
    platformBrandIdentity(input.platformBrand ?? currentPlatformBrand()).zoneDomain ??
    process.env.SPARX_ZONE_DOMAIN ??
    'sparx.zone';
  await tx.domain.create({
    data: {
      tenantId: tenant.id,
      propertyId: property.id,
      host: `${input.slug}.${zone}`,
      type: 'subdomain',
      status: 'active',
      isCanonical: true,
    },
  });

  // Default consent state (docs/53) — born `mode='off'` so the banner stays dark
  // until the merchant opts into GDPR/CCPA. Seeding the row now (rather than lazily
  // on first read) means the consent surface + `computeBannerEnabled` always have a
  // concrete row to read, and a tenant is never missing this core site-state.
  // Per SITE, not per tenant (docs/131 §3.9) — so a second site provisioned
  // later gets its own row and its own regime, rather than inheriting the
  // first business's banner and policy version.
  await tx.consentSettings.create({ data: { tenantId: tenant.id, propertyId: property.id } });

  return { tenantId: tenant.id, propertyId: property.id };
}
