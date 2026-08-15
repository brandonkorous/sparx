'use server';

import { redirect } from 'next/navigation';
import { requireSession } from '@sparx/auth';
import { safeInternalPath } from '@piggles/config';
import { writeConsent } from '@/lib/consent';
import { text } from '@/lib/form';

// Records the answer and sends them on.
//
// Two submit buttons post to one action and differ only by value, which is what
// makes this a DECISION rather than a form with a preferred outcome: there is no
// "cancel", no way to leave without answering, and no third path that quietly
// means yes. Whichever button is pressed writes a real record, and both are
// equally easy to press.
//
// The write is NOT best-effort here, unlike the same write at signup. There, a
// failure leaves an account that works and a question that gets asked again a
// moment later. Here, the question IS the screen — swallowing a failure would
// send somebody into the console having been told their answer was recorded when
// it was not, and the next visit would ask them the same thing again with no
// explanation.

export interface ConsentState {
  error: string | null;
}

export async function recordConsent(
  _prev: ConsentState,
  formData: FormData
): Promise<ConsentState> {
  const session = await requireSession();
  const answer = text(formData, 'analytics');

  // Neither value present means the form was posted by something other than the
  // two buttons on it. Refuse rather than guessing — and every guess available
  // here is a guess about consent.
  if (answer !== 'yes' && answer !== 'no') {
    return { error: 'Please pick one of the two answers.' };
  }

  try {
    await writeConsent(session.user.id, session.user.tenantId, answer === 'yes');
  } catch {
    return { error: 'We could not save that just now. Please try again.' };
  }

  // Sanitised to a same-origin path: this value arrives in the query string, and
  // an unchecked one is an open redirect on the domain that holds the session.
  const next = safeInternalPath(text(formData, 'next'), '/account');

  // OUTSIDE the try/catch — `redirect()` throws a control-flow signal, and a
  // catch around it swallows the navigation and leaves the form apparently dead.
  redirect(next);
}
