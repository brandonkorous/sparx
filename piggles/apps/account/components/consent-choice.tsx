'use client';

import { useActionState, useState } from 'react';
import { Alert, AlertDescription, Button } from '@wizeworks/silicaui-react';
import { marketingUrl, PRODUCT } from '@piggles/config';
import { recordConsent, type ConsentState } from '@/app/cookie-choices/actions';

// The one optional-tracking question Piggles asks, as a screen rather than a bar
// across the bottom of somebody's workspace.
//
// ── WHY IT IS A SCREEN ──────────────────────────────────────────────────────
//
// It was a banner in the console: a slab pinned over the work, arriving after
// somebody had already got where they were going, asking them to deal with
// housekeeping while looking at their business. Every property of that shape is
// a reason people click whatever makes it go away — it interrupts, it overlays,
// it is the wrong size for the question, and answering it is the fastest route
// back to what you were doing.
//
// A screen on getpiggles.com inverts all of it. Nothing is behind it to be
// interrupted, the two answers are the only things on it, and it sits on the
// domain where a customer already deals with WizeWorks — beside their
// subscription and their details, which is what this is.
//
// ── THE TWO ANSWERS ─────────────────────────────────────────────────────────
//
// Same size, same row, same prominence, and no way past without pressing one.
// The accepting answer carries color because it is the one being ASKED for and
// pretending otherwise would be coy; the declining answer is a full-size outline
// button rather than a grey link somebody has to hunt for, which is the specific
// dishonesty that made consent UI universally hated.
//
// NO MASCOT (DESIGN.md §7). Empty states, onboarding and success moments earn
// it. A question about whether somebody may be measured is none of those, and a
// cartoon softening it is exactly the "childish" failure the brand rules warn
// about.

export function ConsentChoice({
  next,
  current,
}: {
  /** Where to go once answered. Already sanitised at the page. */
  next: string;
  /** The existing answer, when this is a revisit rather than the first ask. */
  current: boolean | null;
}) {
  const [state, action, pending] = useActionState<ConsentState, FormData>(recordConsent, {
    error: null,
  });
  // Which button was pressed — for DISPLAY only. `useFormStatus` and
  // `useActionState`'s pending flag are both form-wide, so neither can say which
  // of two submitters is working; this pairs with `pending` to give the pressed
  // one a spinner and leave the other alone.
  //
  // LOAD-BEARING: the spinner is gated on `pending && pressed`, never on
  // `pressed` alone. Silica's `loading` prop disables the button, and disabling
  // a submitter inside its own click handler CANCELS the submission — React
  // flushes the state update before the browser dispatches `submit`, the button
  // is disabled by then, and the form silently never posts. That is exactly what
  // happened here: the spinner appeared, no request was ever made, and the
  // screen sat spinning forever with nothing in the console to explain it.
  // `pending` only turns true once the submission is already under way, so
  // gating on it cannot race the thing it is reporting on.
  const [pressed, setPressed] = useState<'yes' | 'no' | null>(null);

  return (
    <form action={action} className="mt-8 flex flex-col gap-6">
      <input type="hidden" name="next" value={next} />

      {state.error ? (
        <Alert color="danger" variant="soft">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row">
        {/* Order matters and this is the order: the answer being asked for goes
            first on desktop reading order, and both are reachable with one
            thumb on a phone because they stack full-width. */}
        <Button
          type="submit"
          name="analytics"
          value="yes"
          color="primary"
          size="lg"
          className="flex-1"
          loading={pending && pressed === 'yes'}
          onClick={() => setPressed('yes')}
        >
          {current === true ? 'Keep helping' : 'Yes, that is fine'}
        </Button>
        <Button
          type="submit"
          name="analytics"
          value="no"
          color="neutral"
          variant="outline"
          size="lg"
          className="flex-1"
          loading={pending && pressed === 'no'}
          onClick={() => setPressed('no')}
        >
          {current === false ? 'Still no' : 'No thanks'}
        </Button>
      </div>

      <p className="text-base">
        Either way you get the whole of {PRODUCT.name}, and either way you can change your mind from
        your account. The full list —{' '}
        <a
          className="font-semibold underline"
          href={marketingUrl('cookies')}
          target="_blank"
          rel="noreferrer"
        >
          every cookie we set
        </a>{' '}
        — runs to four.
      </p>
    </form>
  );
}
