import type { AttributionSnapshot } from '@sparx/attribution';
import type { Prisma } from '@prisma/client';
import { randomFriendlySlug } from './friendly-slug';

// Tenant provisioning shared by every account-creation path: email/password
// sign-up (signUpMerchant) and — once wired — the Google OAuth user-creation
// hook. Keeping it here means there is ONE place that knows a tenant is born
// with a primary property + its `<slug>.sparx.zone` subdomain, so both paths
// stay in lockstep and the onboarding wizard always has a tenant to refine.

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
}

/**
 * Create the tenant + its primary web property + the always-on
 * `<slug>.sparx.zone` subdomain, inside the caller's transaction. Sets the
 * tenant RLS GUC so the FORCE-RLS `properties` insert passes its WITH CHECK
 * (authPrisma connects as sparx_owner, which IS subject to FORCE RLS). The GUC
 * is transaction-local, so it never leaks past the caller's commit.
 */
export async function provisionTenant(
  tx: Prisma.TransactionClient,
  input: ProvisionTenantInput
): Promise<{ tenantId: string; propertyId: string }> {
  const acq = input.acquisition;
  const tenant = await tx.tenant.create({
    data: {
      name: input.name,
      slug: input.slug,
      email: input.email,
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
  // render path have a site from day one. The display NAME is "Default" — a
  // tenant is a workspace that HAS sites; the host keeps the bare
  // `<slug>.sparx.zone` (slug 'primary' is reserved, never in the host).
  const property = await tx.property.create({
    data: {
      tenantId: tenant.id,
      slug: 'primary',
      name: 'Default',
      isPrimary: true,
    },
  });
  const zone = process.env.SPARX_ZONE_DOMAIN ?? 'sparx.zone';
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

  return { tenantId: tenant.id, propertyId: property.id };
}
