import 'server-only';

import { platformRequest, PlatformRequestError } from '@wizeworks/auth-client-server';
import type { PigglesGroup } from '@piggles/brand';
import { railAppIds } from '@piggles/config';
import { AddressTakenError } from './business-slug';
import { RESERVED_ADDRESSES } from './address-rules';

// The one save onboarding runs: the business is named, the rail preference is
// recorded, and the web address is claimed, together or not at all.
//
// api-rest runs it as one transaction on the business of the person signed in
// (docs/154). What the answers MEAN stays here: which rail apps a "what do you
// do" answer turns on, and which addresses Piggles keeps for itself. api-rest
// stores them under the `piggles` key and reads nothing in them.

export interface OnboardingAnswers {
  businessName: string;
  /** What the business said it does, as rail groups. */
  does: PigglesGroup[];
  /** The web address as a slug, or null to keep the one it has. */
  address: string | null;
}

/** Throws `AddressTakenError` when the address belongs to somebody else. */
export async function saveOnboarding(answers: OnboardingAnswers): Promise<void> {
  try {
    await platformRequest('business/setup', {
      body: {
        name: answers.businessName,
        slug: answers.address,
        railApps: railAppIds(answers.does),
        brandSettings: { railGroups: answers.does },
        reserved: [...RESERVED_ADDRESSES],
      },
    });
  } catch (err) {
    if (err instanceof PlatformRequestError && err.status === 409) {
      throw new AddressTakenError(answers.address ?? '');
    }
    throw err;
  }
}

/**
 * Mark the setup finished. Called by the action AFTER furnishing has returned,
 * never with the save above, and the distinction is the whole point.
 *
 * `onboardedAt` used to be written beside the rail groups, so it recorded that
 * somebody PRESSED THE BUTTON, not that their business was ready. Furnishing is
 * the half that switches the modules on, and when it fails the person is still
 * mid-setup. It is also LOAD-BEARING: `/onboarding` refuses a business that has
 * it, so a business that finished a month ago cannot reopen the setup form over
 * a button that offers to set it all up again. See app/onboarding/page.tsx.
 *
 * Best-effort on purpose: the business is built and usable by the time this
 * runs, and failing the signup over a bookkeeping field would throw away the
 * thing that just succeeded. A miss costs the guard, not the account.
 */
export async function markOnboardingFinished(): Promise<void> {
  await platformRequest('business/brand-settings', {
    body: { onboardedAt: new Date().toISOString() },
  });
}
