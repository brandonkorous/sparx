import 'server-only';
import { type Prisma, withTenant } from '@wizeworks/db';
import type { PigglesGroup } from '@piggles/brand';
import { railAppIds } from '@piggles/config';
import { claimBusinessSlug } from './business-slug';

// The one transaction onboarding runs: the business is named, the rail
// preference is recorded, and the web address is claimed.
//
// `withTenant`, NOT `prisma.$transaction`. `properties` is under FORCE row-level
// security, so an UPDATE issued without `app.tenant_id` set matches NOTHING —
// and `updateMany` reports that by returning `{ count: 0 }`, which is not an
// error. The first version used the raw client: the tenant rename worked (the
// `tenants` dispatch row is deliberately non-RLS), the site rename silently did
// not, and the business went on sending receipts under "Marta's workspace".

export interface OnboardingAnswers {
  tenantId: string;
  businessName: string;
  does: PigglesGroup[];
  /** The address she chose, already tidied. Null means nothing usable was typed
   *  or derived, which keeps the generated placeholder. */
  address: string | null;
}

export async function saveOnboarding(answers: OnboardingAnswers): Promise<void> {
  await withTenant({ tenantId: answers.tenantId }, async (tx) => {
    const current = await tx.tenant.findUniqueOrThrow({
      where: { id: answers.tenantId },
      select: { settings: true, slug: true },
    });

    await tx.tenant.update({
      where: { id: answers.tenantId },
      data: {
        name: answers.businessName,
        settings: mergeSettings(current.settings, answers.does),
      },
    });

    // The PRIMARY site's name is customer-facing — it is what appears on the
    // site, in emails, and on invoices. It was seeded with the generated
    // placeholder ("Brandon's workspace") at provisioning, so leaving it alone
    // would mean a real business sending real receipts under a name nobody chose.
    const renamed = await tx.property.updateMany({
      where: { tenantId: answers.tenantId, isPrimary: true },
      data: { name: answers.businessName },
    });

    // Assert the write LANDED. `updateMany` matching nothing is not an error,
    // and every plausible cause here is a bug rather than a user mistake.
    // Throwing rolls the whole transaction back, so the person is told to try
    // again instead of being shown a success screen over a half-applied change.
    if (renamed.count === 0) {
      throw new Error(`onboarding: no primary site renamed for tenant ${answers.tenantId}`);
    }

    if (answers.address) {
      await claimBusinessSlug(tx, answers.tenantId, answers.address, current.slug);
    }
  });
}

/**
 * Read-modify-write, MERGED — never assigned. `settings` is a shared per-tenant
 * JSON blob other parts of the platform already write to, so replacing it would
 * silently drop whatever else is in there.
 *
 * NEITHER `modules` NOR `industry` is written, and both omissions are
 * deliberate. `settings.modules` is not ours: a flag write is only half an
 * activation, and the other half is announcing it on the in-process bus that
 * seeds each module's baseline, which only api-rest can do (lib/furnish.ts).
 * `settings.industry` is written by the industry-starter installer as the last
 * step of stamping the trade's config — setting it here would mark the trade as
 * chosen before its setup existed, and the workbench reads exactly that key to
 * decide the question is answered.
 */
function mergeSettings(raw: unknown, does: PigglesGroup[]): Prisma.InputJsonObject {
  const settings =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};

  return {
    ...settings,
    // What the rail shows on day one, RESOLVED to app ids here because this is
    // the only side that holds the app registry. A WORKSPACE PREFERENCE and
    // nothing more: every app stays included, working, and one tap away.
    rail: {
      ...((settings.rail as Record<string, unknown> | undefined) ?? {}),
      apps: railAppIds(does),
    },
    piggles: {
      ...((settings.piggles as Record<string, unknown> | undefined) ?? {}),
      // The RAW answer, kept because the WizeWorks board segments on it.
      railGroups: does,
      onboardedAt: new Date().toISOString(),
    },
  };
}
