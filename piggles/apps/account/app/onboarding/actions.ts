'use server';

import { redirect } from 'next/navigation';
import { requireSession } from '@sparx/auth';
import { withTenant } from '@sparx/db';
import { PIGGLES_GROUPS, type PigglesGroup } from '@piggles/brand';
import { APPS } from '@piggles/config';
import { furnishTenant } from '@/lib/furnish';
import { isKnownTrade } from '@/lib/trades';
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
// What is left is genuinely two things — what the business IS (its name and its
// line of work), and what it DOES. Both are data the product needs, and each is
// put to a use that is easy to mix up, which is the whole subtlety of this file.
//
// ── WHAT EACH ANSWER DOES ───────────────────────────────────────────────────
//
// The LINE OF WORK is handed to the platform, where it does two jobs at once:
// it picks the sample dataset (a bakery gets a bakery's products, customers,
// bookings and articles) and it selects the config presets stamped into each
// app. One slug, both jobs — the platform calls it `settings.industry`, and the
// installer is what writes it, so the workbench's own "what kind of business"
// screen agrees with what was chosen here instead of asking again.
//
// WHAT YOU DO decides which apps are ON THE RAIL. That is the whole of its job.
//
// ── WHAT NEITHER ANSWER DOES: GATE ──────────────────────────────────────────
//
// This is the rule most likely to be broken later by someone reading an answer
// as an entitlement. **Every module is switched on for every business, no matter
// what was ticked** (RULE #2: every app ships enabled; the answer HIDES, it
// never gates). Ticking "I sell things" does not buy Commerce and leaving it
// unticked does not withhold it — it decides what is on the rail on day one, and
// the launcher still lists all fifteen.
//
// It used to activate only the modules behind the ticked groups, and that was
// wrong in a way the copy on the screen made worse: the screen promises
// "everything is included either way", while a module that is off returns 404,
// runs no workers and stores no rows. So the unticked apps WERE locked doors,
// and Piggles had reinvented module pricing without charging for it — all of the
// friction, none of the revenue. Switching everything on is what makes the
// promise on the screen true, and it is also what lets the sample data furnish
// all fifteen apps instead of the three somebody happened to tick.
//
// ── WHAT THIS FILE DOES NOT DO ──────────────────────────────────────────────
//
// It names the business and records the rail preference, and then hands off.
// Switching the apps on, stamping the trade's setup and filling the account are
// ONE platform operation with a load-bearing internal order, and it runs in
// api-rest because that is the only process where it can be correct — see
// lib/furnish.ts for the bus that made doing it here silently wrong.
//
// The practical test: ticking nothing here must still leave a completely usable
// product, three taps from selling. It does.

export interface OnboardingState {
  error: string | null;
}

/**
 * The rail this answer earns: every app in a group they ticked, plus the ones
 * that start on every rail.
 *
 * Ticking NOTHING must still leave a usable product, which is why the
 * `defaultEnabled` half is unconditional — the practical test at the top of this
 * file is that a business who answers nothing is still three taps from selling.
 */
function railApps(groups: PigglesGroup[]): string[] {
  return APPS.filter((app) => app.defaultEnabled || groups.includes(app.group)).map(
    (app) => app.id
  );
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

  const chosen = text(formData, 'industry');
  const industry = chosen && isKnownTrade(chosen) ? chosen : null;

  // The look. Not validated against a list here on purpose: the catalog is the
  // platform's and the picker was built FROM it, so a second copy of the valid
  // keys in this app is a copy that drifts. The furnishing endpoint re-checks the
  // key against the tenant's own brand and skips a template it does not
  // recognise — a bad value costs the site's look, never the signup.
  const blueprintKey = text(formData, 'blueprintKey') || undefined;

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
            // NEITHER `modules` NOR `industry` is written here, and both
            // omissions are deliberate.
            //
            // `settings.modules` is not ours to write. A flag write is only half
            // an activation — the other half is announcing it on the in-process
            // bus that seeds each module's baseline, which only api-rest can do
            // (lib/furnish.ts). Writing the flag from here would make every gate
            // report the app as ON while none of its setup had run, and the
            // furnish step that follows would then see nothing to change and
            // announce nothing. The flag being absent until the platform sets it
            // is what keeps those two halves together.
            //
            // `settings.industry` is written by the industry-starter installer,
            // as the last step of stamping the trade's config. Setting it here
            // would mark the trade as chosen before its setup existed — and the
            // workbench reads exactly that key to decide the question is
            // answered, so the setup would then never be offered.
            // What the rail shows on day one, RESOLVED to app ids here because
            // this is the only side that holds the app registry — api-rest
            // stores the list and hands it back, and holding a copy of another
            // product's ids is how it would drift.
            //
            // A WORKSPACE PREFERENCE and nothing more: every app stays included,
            // working, and one tap away under All apps. Modules are not touched
            // — this used to switch on only the ticked ones, which made the
            // unticked apps locked doors on a screen promising the opposite.
            rail: {
              ...((settings.rail as Record<string, unknown> | undefined) ?? {}),
              apps: railApps(does),
            },
            piggles: {
              ...((settings.piggles as Record<string, unknown> | undefined) ?? {}),
              // The RAW answer, kept because the WizeWorks board segments on it.
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

  // AFTER the commit, never inside it: furnishing reads the tenant from another
  // process, so it has to find the rename already there.
  //
  // NOT best-effort, unlike the naming above — and that is the one judgement
  // call in this file worth defending. Everything furnishing does is what makes
  // the business USABLE: the apps switched on and seeded, the trade's setup
  // stamped, something in every list. Swallowing a failure here would redirect
  // somebody into precisely the empty workspace this whole path exists to
  // prevent, and they would have no idea anything had gone wrong — the failure
  // would look exactly like the product.
  //
  // So it is shown, and retrying is safe: every step is idempotent (modules
  // already on are not re-announced, presets are skip-if-present, a sample load
  // clears its own prior rows), and the rename above is an update. Pressing the
  // button again finishes the job rather than doubling it.
  try {
    await furnishTenant({ tenantId: session.user.tenantId, industry, blueprintKey });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: 'error',
        tenantId: session.user.tenantId,
        industry,
        err: err instanceof Error ? err.message : String(err),
        msg: 'piggles onboarding: furnishing the tenant failed',
      })
    );
    return {
      error: 'We saved your details but could not finish setting things up. Please try again.',
    };
  }

  // Straight into the workbench — not to an account home. Somebody who has just
  // finished setting up wants to see their business, and the account app's job
  // is done until they need to change something about their subscription.
  redirect('/handoff');
}
