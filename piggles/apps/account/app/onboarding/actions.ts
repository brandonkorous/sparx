'use server';

import { requireSession } from '@wizeworks/auth';
import { PIGGLES_GROUPS, type PigglesGroup } from '@piggles/brand';
import { furnishTenant } from '@/lib/furnish';
import { heardAboutAnswer, type HeardAbout } from '@/lib/heard-about';
import { saveHeardAbout } from '@/lib/heard-about-save';
import { isKnownTrade } from '@/lib/trades';
import { AddressTakenError, slugifyAddress, slugifyBusinessName } from '@/lib/business-slug';
import { markOnboardingFinished, saveOnboarding } from '@/lib/onboarding-save';
import { text, textAll } from '@/lib/form';

// Onboarding reads the form and hands off: the line of work picks the sample data
// and presets, "what you do" decides the rail (it HIDES, never gates: RULE #2),
// and the web address is asked now because it can never change later (issue #010).

export interface OnboardingState {
  error: string | null;
  /** Named when the error belongs to one field, so the screen can point at it. */
  field?: 'webAddress';
  /** Where to go once set up (`/handoff`). Returned, not `redirect()`ed: a router
   *  fetch of a cross-origin 303 hits it twice and spends its single-use token. */
  done?: string;
}

interface Answers {
  businessName: string;
  does: PigglesGroup[];
  industry: string | null;
  blueprintKey: string | undefined;
  address: string | null;
  heard: HeardAbout | null;
}

function logError(tenantId: string, msg: string, err: unknown, extra: object = {}): void {
  const detail = err instanceof Error ? err.message : String(err);
  console.error(JSON.stringify({ level: 'error', tenantId, ...extra, err: detail, msg }));
}

/** The form, validated. The look is not checked here: the furnishing endpoint
 *  re-checks it against the brand's catalog, and a copy of that list here drifts. */
function readAnswers(formData: FormData): Answers | OnboardingState {
  const businessName = text(formData, 'businessName');
  if (!businessName) return { error: 'Your business needs a name. You can change it later.' };
  if (businessName.length > 120) return { error: 'That name is a little too long.' };

  const typed = text(formData, 'webAddress');
  const address = typed ? slugifyAddress(typed) : slugifyBusinessName(businessName);
  if (typed && !address) {
    return {
      error: 'That web address will not work. Use letters, numbers and hyphens.',
      field: 'webAddress',
    };
  }

  const chosen = text(formData, 'industry');
  return {
    businessName,
    // Checked against the real groups: an unknown key is a rail item that resolves to nothing.
    does: textAll(formData, 'does').filter((g): g is PigglesGroup =>
      (PIGGLES_GROUPS as readonly string[]).includes(g)
    ),
    industry: chosen && isKnownTrade(chosen) ? chosen : null,
    blueprintKey: text(formData, 'blueprintKey') || undefined,
    address,
    heard: heardAboutAnswer(text(formData, 'heardAbout')),
  };
}

/** Name the business and claim its address. A taken address is the one failure
 *  somebody can fix, so it points at its field. */
async function save(tenantId: string, a: Answers): Promise<OnboardingState | null> {
  try {
    await saveOnboarding({
      tenantId,
      businessName: a.businessName,
      does: a.does,
      address: a.address,
    });
    return null;
  } catch (err) {
    if (err instanceof AddressTakenError) {
      return {
        error: `${err.slug} is already taken. Try another web address.`,
        field: 'webAddress',
      };
    }
    return { error: 'We could not save that just now. Please try again.' };
  }
}

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const session = await requireSession();
  const tenantId = session.user.tenantId;
  const answers = readAnswers(formData);
  if ('error' in answers) return answers;

  const saveFailed = await save(tenantId, answers);
  if (saveFailed) return saveFailed;

  // Before furnishing, so the `module.activated` it causes carries the answer to
  // the signups board. Best-effort: an optional answer never fails a signup.
  if (answers.heard) {
    await saveHeardAbout(tenantId, answers.heard).catch((err: unknown) =>
      logError(tenantId, 'piggles onboarding: could not save where they heard', err)
    );
  }

  // NOT best-effort: furnishing is what makes the business usable. Every step is
  // idempotent, so pressing the button again finishes the job.
  try {
    await furnishTenant({
      tenantId,
      industry: answers.industry,
      blueprintKey: answers.blueprintKey,
    });
  } catch (err) {
    logError(tenantId, 'piggles onboarding: furnishing the tenant failed', err, {
      industry: answers.industry,
    });
    return {
      error: 'We saved your details but could not finish setting things up. Please try again.',
    };
  }

  // Only now is the business set up. Best-effort: losing it costs the guard, not the account.
  await markOnboardingFinished(tenantId).catch((err: unknown) =>
    logError(tenantId, 'piggles onboarding: could not mark the setup finished', err)
  );
  return { error: null, done: '/handoff' };
}
