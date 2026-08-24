'use server';

import { requireSession } from '@wizeworks/auth';
import { PIGGLES_GROUPS, type PigglesGroup } from '@piggles/brand';
import { furnishTenant } from '@/lib/furnish';
import { isKnownTrade } from '@/lib/trades';
import { AddressTakenError, slugifyAddress, slugifyBusinessName } from '@/lib/business-slug';
import { saveOnboarding } from '@/lib/onboarding-save';
import { text, textAll } from '@/lib/form';

// Onboarding, which is three questions long.
//
// ── WHY SO SHORT ────────────────────────────────────────────────────────────
//
// The platform's stated goal is a working business in under five minutes, and
// Piggles cannot use the usual trick for filling that time: sparx asks which
// modules you want, because modules are what it bills for. Piggles includes
// every app on every plan, so there is nothing to choose and nothing to sell.
//
// ── WHAT EACH ANSWER DOES ───────────────────────────────────────────────────
//
// The LINE OF WORK is handed to the platform, where it does two jobs at once: it
// picks the sample dataset (a bakery gets a bakery's products, customers,
// bookings and articles) and it selects the config presets stamped into each
// app. One slug, both jobs.
//
// WHAT YOU DO decides which apps are ON THE RAIL. That is the whole of its job.
//
// The WEB ADDRESS is the third, and it is here because it can never be here
// again: an address is an identifier, identifiers do not change, and this is the
// last moment before the site is published on it. Left unasked, a bakery lived
// at quiet-haven-3783.piggles.site forever (issue #010).
//
// ── WHAT NEITHER ANSWER DOES: GATE ──────────────────────────────────────────
//
// **Every module is switched on for every business, no matter what was ticked**
// (RULE #2: every app ships enabled; the answer HIDES, it never gates). Ticking
// "I sell things" does not buy Commerce and leaving it unticked does not
// withhold it.
//
// It used to activate only the modules behind the ticked groups, and that was
// wrong in a way the copy on the screen made worse: the screen promises
// "everything is included either way", while a module that is off returns 404,
// runs no workers and stores no rows. So the unticked apps WERE locked doors,
// and Piggles had reinvented module pricing without charging for it.
//
// ── WHAT THIS FILE DOES NOT DO ──────────────────────────────────────────────
//
// It reads the form and hands off. The transaction is lib/onboarding-save.ts;
// switching the apps on, stamping the trade's setup and filling the account are
// ONE platform operation with a load-bearing internal order, and it runs in
// api-rest because that is the only process where it can be correct — see
// lib/furnish.ts for the bus that made doing it here silently wrong.

export interface OnboardingState {
  error: string | null;
  /** Named when the error belongs to one field, so the screen can point at it
   *  instead of dropping a sentence above the form. */
  field?: 'webAddress';
  /**
   * Where to send the browser once setup has finished — `/handoff`, the one door
   * across to the console.
   *
   * ── WHY THIS IS RETURNED AND NOT `redirect()`ed ─────────────────────────────
   *
   * `redirect()` inside a server action does not send an HTTP redirect to the
   * browser; it tells the Next CLIENT ROUTER to navigate, and the client router
   * fetches an RSC payload for the target before going there. `/handoff` answers
   * 303 to another ORIGIN, so that fetch dies on CORS and the router falls back
   * to a real navigation — hitting `/handoff` TWICE.
   *
   * `/handoff` mints a SINGLE-USE token. Two hits means the second one arrives
   * after the first has been spent, which is a brand-new customer bounced back
   * to the sign-in page at the end of setting up their business.
   */
  done?: string;
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

  // Whatever the address field says, falling back to the suggestion the field
  // was showing. Null keeps the generated placeholder, which is what happens for
  // a name in a script this cannot make a DNS label out of.
  const typed = text(formData, 'webAddress');
  const address = typed ? slugifyAddress(typed) : slugifyBusinessName(businessName);

  if (typed && !address) {
    return {
      error: 'That web address will not work. Use letters, numbers and hyphens.',
      field: 'webAddress',
    };
  }

  try {
    await saveOnboarding({ tenantId: session.user.tenantId, businessName, does, address });
  } catch (err) {
    // A taken address is the one failure here somebody can actually fix, so it
    // is told apart from the rest and pointed at the field that owns it.
    if (err instanceof AddressTakenError) {
      return {
        error: `${err.slug} is already taken. Try another web address.`,
        field: 'webAddress',
      };
    }
    return { error: 'We could not save that just now. Please try again.' };
  }

  // AFTER the commit, never inside it: furnishing reads the tenant from another
  // process, so it has to find the rename already there.
  //
  // NOT best-effort, unlike the naming above. Everything furnishing does is what
  // makes the business USABLE: the apps switched on and seeded, the trade's setup
  // stamped, something in every list. Swallowing a failure here would redirect
  // somebody into precisely the empty workspace this whole path exists to
  // prevent, and the failure would look exactly like the product.
  //
  // Retrying is safe: every step is idempotent, and the rename above is an
  // update. Pressing the button again finishes the job rather than doubling it.
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
  // finished setting up wants to see their business.
  return { error: null, done: '/handoff' };
}
