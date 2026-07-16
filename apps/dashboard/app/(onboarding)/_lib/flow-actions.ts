'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api-rest-client';
import { ONBOARDING_FLOW_HREF, type OnboardingFlow } from '@/lib/onboarding-entry';

// Switching between the two onboarding front ends (`/story` ⇄ `/onboarding`). Both
// share one backend, so this is purely a routing choice — nothing is torn down and
// nothing is lost either way. Classic progress (`currentStep`, `completed`) and a story
// draft persist independently, so an owner can bounce between the two and pick each up
// exactly where they left it.

/** Record the owner's front-end choice, then take them there. The recorded `flow` is
 *  what makes the move stick: it outranks every derived routing hint, so the dashboard
 *  guard and the resume banner honor the switch instead of bouncing them back (see
 *  `onboardingEntryHref`).
 *
 *  Best-effort by design — the PATCH is not allowed to block the navigation. Neither
 *  onboarding route is gated, so a failed save still lands the owner in the flow they
 *  asked for; they'd just resume in the other one on a later visit. Refusing to move
 *  them because a preference write failed would be the worse trade. */
export async function switchOnboardingFlowAction(flow: OnboardingFlow): Promise<void> {
  try {
    await api.patch('/v1/tenant/onboarding', { flow });
    revalidatePath('/onboarding');
    revalidatePath('/story');
  } catch {
    // Swallowed deliberately — see above. `redirect` must stay outside the try: it
    // signals via a thrown NEXT_REDIRECT that a catch here would eat.
  }
  redirect(ONBOARDING_FLOW_HREF[flow]);
}
