'use server';

import { redirect } from 'next/navigation';
import { requireSession } from '@sparx/auth';
import { withTenant } from '@sparx/db';
import { PIGGLES_GROUPS, type PigglesGroup } from '@piggles/brand';
import { modulesForGroups } from '@piggles/config';
import { announceActivations, moduleFlags, withRequirements } from '@/lib/activate-modules';
import { text, textAll } from '@/lib/form';

// Onboarding, which is two questions long.
//
// ── WHY SO SHORT ────────────────────────────────────────────────────────────
//
// The platform's stated goal is a working business in under five minutes, and
// Piggles cannot use the usual trick for filling that time: sparx asks which
// modules you want, because modules are what it bills for. Piggles includes
// every app on every plan, so there is nothing to choose and nothing to sell.
//
// What is left is genuinely two things — what the business is called, and what
// it does. The first is data the product needs. The second does two jobs, and
// keeping them straight is the whole subtlety of this file.
//
// ── WHAT THE SECOND ANSWER DOES ─────────────────────────────────────────────
//
// It decides which apps are ON THE RAIL, and it ACTIVATES the platform modules
// behind them. The second half is not bookkeeping: `module.activated` is what
// seeds the CRM's pipeline, the automation catalogue, commerce's tax and
// shipping defaults, finance's accounts and the default emails. A business that
// said it sells things should arrive at a Sell app that is already set up, not
// at fifteen apps each waiting for someone to configure them.
//
// ── AND WHAT IT MUST NEVER DO: GATE ─────────────────────────────────────────
//
// This is the rule most likely to be broken later by someone reading the answer
// as an entitlement. An app whose module is not active is NOT a locked door — it
// stays listed, and turning it on is one tap with no price attached ("Add app").
// The answer decides what starts SET UP and VISIBLE, never what somebody is
// ALLOWED to open. The moment it decides the latter, Piggles has reinvented
// module pricing without charging for it — all of the friction, none of the
// revenue (piggles/CLAUDE.md RULE #2).
//
// The practical test: ticking nothing here must still leave a completely usable
// product, three taps from selling. It does.

export interface OnboardingState {
  error: string | null;
}

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const session = await requireSession();
  const businessName = text(formData, 'businessName');

  if (!businessName) return { error: 'Your business needs a name — you can change it later.' };
  if (businessName.length > 120) return { error: 'That name is a little too long.' };

  // The answer is validated against the real group list rather than trusted:
  // this ends up in a JSON column that the console will read to build a rail, and
  // an unknown key there is a rail item that resolves to nothing.
  const does = textAll(formData, 'does').filter((g): g is PigglesGroup =>
    (PIGGLES_GROUPS as readonly string[]).includes(g)
  );

  // The modules behind the chosen groups, plus anything they REQUIRE (B2B
  // without Commerce is not a smaller feature set, it is a broken one). Computed
  // before the transaction so a bad mapping fails here rather than half-way
  // through a rename.
  const modules = withRequirements(modulesForGroups(does));

  // `withTenant`, NOT `prisma.$transaction`.
  //
  // `properties` is under FORCE row-level security, so an UPDATE issued without
  // `app.tenant_id` set matches NOTHING — and `updateMany` reports that by
  // returning `{ count: 0 }`, which is not an error. The first version of this
  // used the raw client: the tenant rename worked (the `tenants` dispatch row is
  // deliberately non-RLS), the site rename silently did not, and the business
  // went on sending receipts under "Marta's workspace". Nothing failed, nothing
  // logged, and only opening the row showed it.
  try {
    await withTenant({ tenantId: session.user.tenantId }, async (tx) => {
      // Read-modify-write on `settings`, MERGED — never assigned. It is a shared
      // per-tenant JSON blob that other parts of the platform already write to,
      // so replacing it would silently drop whatever else is in there. The
      // Piggles keys are namespaced for the same reason.
      const current = await tx.tenant.findUniqueOrThrow({
        where: { id: session.user.tenantId },
        select: { settings: true },
      });
      const settings =
        current.settings && typeof current.settings === 'object' && !Array.isArray(current.settings)
          ? (current.settings as Record<string, unknown>)
          : {};

      await tx.tenant.update({
        where: { id: session.user.tenantId },
        data: {
          name: businessName,
          settings: {
            ...settings,
            // The platform's own module flags — the shape every gate reads.
            // Merged over what is there, never assigned: a module already on for
            // another reason must not be switched off by writing this one.
            modules: moduleFlags(settings.modules as Record<string, unknown> | undefined, modules),
            piggles: {
              ...((settings.piggles as Record<string, unknown> | undefined) ?? {}),
              // What the rail shows on day one. A WORKSPACE PREFERENCE, and the
              // console must read it as nothing more — every app stays entitled
              // and reachable from the launcher whatever is in here.
              railGroups: does,
              onboardedAt: new Date().toISOString(),
            },
          },
        },
      });

      // The PRIMARY site's name is customer-facing — it is what appears on the
      // storefront, in emails, and on invoices. It was seeded with the generated
      // placeholder ("Brandon's workspace") at provisioning, so leaving it alone
      // here would mean a real business sending real receipts under a name
      // nobody chose. Renaming both is the point of asking.
      const renamed = await tx.property.updateMany({
        where: { tenantId: session.user.tenantId, isPrimary: true },
        data: { name: businessName },
      });

      // Assert the write LANDED. `updateMany` matching nothing is not an error,
      // and every plausible cause here is a bug rather than a user mistake:
      // missing tenant context, a tenant with no primary site, RLS refusing the
      // row. Throwing rolls the whole transaction back, so the person is told to
      // try again instead of being shown a success screen over a half-applied
      // change — which is what happened the first time this ran.
      if (renamed.count === 0) {
        throw new Error(`onboarding: no primary site renamed for tenant ${session.user.tenantId}`);
      }
    });
  } catch {
    return { error: 'We could not save that just now. Please try again.' };
  }

  // AFTER the commit, never inside it. A consumer that wakes on this event has
  // to find the flag already true; publishing first races the seeding against
  // the write. Best-effort — see lib/activate-modules for why a failure here
  // must not undo the rename that already succeeded.
  await announceActivations(session.user.tenantId, session.user.id, modules);

  // Straight into the console — not to an account home. Somebody who has just
  // finished setting up wants to see their business, and the account app's job
  // is done until they need to change something about their subscription.
  redirect('/handoff');
}
