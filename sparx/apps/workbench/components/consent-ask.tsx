'use client';

// The one optional-tracking question sparx asks — asked once, answered once.
//
// ── WHY IT IS A DIALOG AND NOT A BAR ────────────────────────────────────────
//
// A consent bar across the bottom of a workspace is the shape that made consent
// UI universally hated, and every property of it is a reason people click
// whatever makes it go away: it arrives after you have already got where you
// were going, it is the wrong size for the question, it stays until dealt with,
// and dismissing it is the fastest route back to work. Bars get answered without
// being read, which means the answer is worth nothing.
//
// The dialog inverts that. It is the only thing on screen, both answers are the
// same size in the same row, and it appears exactly once — when there is no
// record — rather than persisting as furniture.
//
// A separate account domain would be better still, and it is what Piggles does,
// because there is nothing behind the question there to be interrupted. sparx
// has no such domain: the workbench IS where a sparx operator manages their
// account, so this is the earliest honest place to ask.
//
// ── IT RENDERS NOTHING IN THE NORMAL CASE ───────────────────────────────────
//
// `undefined` (still reading) and a real record both render null. Only `null` —
// no decision on file — opens it. So the moment somebody answers, this component
// is inert forever, and an operator who answered a year ago never sees it again.
//
// ── THERE IS NO DISMISS ─────────────────────────────────────────────────────
//
// No ✕, no escape-to-close, no click-outside. Not to trap anybody — both answers
// are one click away and equally easy — but because a dismissal is not an answer,
// and a dialog that can be waved away has to decide what waving it away MEANT.
// Every available reading of that is wrong: treating it as "no" records a
// refusal nobody made, and treating it as "not yet" brings the dialog back
// tomorrow, which is a bar with extra steps.

import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  useToast,
} from '@wizeworks/silicaui-react';
import { useQueryClient } from '@wizeworks/query';
import { PREFERENCES_KEY, useConsent } from '../lib/consent';

export function ConsentAsk() {
  const consent = useConsent();
  const queryClient = useQueryClient();
  const toast = useToast();
  // Which button was pressed — for DISPLAY only, so the pressed one carries the
  // spinner and the other stays live. A single `pending` boolean would spin both.
  const [pending, setPending] = useState<'yes' | 'no' | null>(null);

  // `undefined` is "still reading" and must not open anything: a dialog that
  // flashes on every load while a request is in flight is worse than one that
  // arrives a beat late.
  if (consent !== null) return null;

  const answer = async (analytics: boolean) => {
    setPending(analytics ? 'yes' : 'no');
    try {
      const response = await fetch('/api/consent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ analytics }),
      });
      if (!response.ok) throw new Error(String(response.status));
      // Refetch rather than write the answer into the cache by hand: the server
      // owns the `at` stamp, and a hand-written record would differ from the one
      // everything else reads.
      await queryClient.invalidateQueries({ queryKey: PREFERENCES_KEY });
    } catch {
      setPending(null);
      // The dialog STAYS OPEN on failure. Closing it would leave no record and
      // no way back to the question — the person would believe they had answered
      // and nothing would have been saved.
      toast.add({
        title: 'That did not save',
        description:
          'Your answer was not recorded. Try again — nothing is being collected either way.',
        type: 'error',
      });
    }
  };

  return (
    <Dialog open onOpenChange={() => undefined}>
      {/* No DialogHeader, so no ✕ — silica only renders one where you put one. */}
      <DialogContent className="max-w-lg">
        <DialogTitle>May we see how you use sparx?</DialogTitle>
        <DialogDescription>
          Which screens get opened, which ones get abandoned, and how long things take to load. It
          tells us what to fix next. It is never sold, never used for advertising, and it is not how
          we bill you.
        </DialogDescription>

        {/* Same size, same row, same prominence. The accepting answer carries
            color because it is the one being ASKED for and pretending otherwise
            would be coy. The declining answer is a full-size button rather than
            a grey link somebody has to hunt for — that hunt is the specific
            dishonesty this shape exists to avoid. It takes no `color`, which
            resolves to readable base ink and is the right control for an answer
            that is neither a risk nor a recommendation. */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            color="primary"
            size="lg"
            className="flex-1"
            loading={pending === 'yes'}
            disabled={pending !== null}
            onClick={() => void answer(true)}
          >
            Yes, that is fine
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            loading={pending === 'no'}
            disabled={pending !== null}
            onClick={() => void answer(false)}
          >
            No thanks
          </Button>
        </div>

        <p className="mt-4 text-sm">
          Either way you get the whole of sparx, and either way you can change your mind from
          Security &amp; access.
        </p>
      </DialogContent>
    </Dialog>
  );
}
