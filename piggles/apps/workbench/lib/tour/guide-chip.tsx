'use client';

// The guide itself: a chip on the status strip, and a card next to whatever the
// step is about.
//
// ── WHY THE CHIP LIVES DOWN HERE AND THE CARD DOES NOT ──────────────────────
//
// The chip is a handle — where the offer arrives, where "3 of 7" lives, and the
// thing still sitting there when somebody wanders off mid-guide and comes back.
// The strip already does exactly that job for the occasional "how's it going?"
// ask (components/feedback/sentiment-chip.tsx): it is the one shelf in the
// product that is never in the way.
//
// The CARD is not a handle, it is the sentence, and a sentence belongs beside the
// thing it describes. Anchoring it here rather than to the chip is the whole
// difference between reading about a nav row and hunting for it — see
// ./anchor.ts, and lib/tour/use-guide.ts for why that costs the design nothing.
//
// ── WHAT IT LOOKS LIKE ──────────────────────────────────────────────────────
//
// Offering: one pink button on the strip — "New here? Show me around."
// Running:  the step's words in a card against the ringed element, with where you
//           are ("2 of 7"), Back, Next, and a way out that is a real button.
//           A step with no anchor keeps the card above the chip.
// Idle:     nothing at all. Like every chip on this strip, it is either saying
//           something or absent.

import { useEffect } from 'react';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@wizeworks/silicaui-react';
import { faWandMagicSparkles } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import './guide.css';
import { guideSide, useGuideAnchor } from './anchor';
import { currentStep, useGuideActions, useGuideState } from './use-guide';

export function GuideChip() {
  const state = useGuideState();
  const step = currentStep(state);
  const { accept, decline, next, back, leave } = useGuideActions();

  // The element this step is ringing, or null on the openings and handoffs.
  // It is what the card is positioned against — see ./anchor.ts.
  const anchor = useGuideAnchor(step);

  // Esc leaves — the one keyboard habit everybody already has for "I am done
  // with this". It does not close a popover here because the popover is not
  // dismissible on its own: closing it while the guide ran would strand somebody
  // mid-walk with a chip that says a step number and nothing else.
  useEffect(() => {
    if (state.phase !== 'running') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') leave();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [state.phase, leave]);

  if (state.phase === 'idle') return null;

  if (state.phase === 'offering') {
    return (
      <span className="flex items-center gap-1">
        {/* Primary, because it is the thing being offered and a grey button
            offering help reads as an apology for offering it. */}
        <Button color="primary" variant="soft" size="xs" className="gap-1.5" onClick={accept}>
          <Icon glyph={faWandMagicSparkles} className="size-3.5" aria-hidden />
          {state.guide.offer}
        </Button>
        {/* A real button, the same size, saying the actual word. A ✕ would make
            declining feel like closing something you were not meant to close. */}
        <Button variant="ghost" size="xs" onClick={decline}>
          No thanks
        </Button>
      </span>
    );
  }

  const position = `${String(state.index + 1)} of ${String(state.guide.steps.length)}`;
  const last = state.index === state.guide.steps.length - 1;

  return (
    // `open` and no `onOpenChange`: the popover belongs to the guide, not to the
    // person's click. It opens when a step does and closes when the guide ends.
    <Popover open>
      <PopoverTrigger>
        <Button color="primary" variant="soft" size="xs" className="gap-1.5">
          <Icon glyph={faWandMagicSparkles} className="size-3.5" aria-hidden />
          <span className="max-w-64 truncate">{step?.title ?? 'Showing you around'}</span>
          <span className="tabular-nums">{position}</span>
        </Button>
      </PopoverTrigger>
      {/* Beside the thing being explained, whenever there IS one. The card only
          falls back to the strip on a step with no anchor — the openings and the
          handoffs, which are about the product rather than about any one control.

          `sticky` because a nav row can scroll under the card in a long panel and
          the words should not sail off with it. `sideOffset` clears the ring,
          which draws 2px outside the box with a 2px offset (./guide.css).

          `piggles-guide-card` is a HOOK, not a paint: ./guide.css uses it to raise
          the POSITIONER this popup sits in. The card has to clear the dock's
          floating tools (`z-[9000]`, lib/dock/window-canvas.tsx) — without that,
          an anchorless step lands in exactly their corner and Next cannot be
          clicked, because the Tidy-up control is on top of it. The class cannot
          carry the z-index itself: this element is `position: static`, so a
          z-index on it does nothing at all. */}
      <PopoverContent
        side={anchor ? guideSide(anchor) : 'top'}
        align={anchor ? 'center' : 'end'}
        anchor={anchor ?? undefined}
        sideOffset={anchor ? 10 : undefined}
        sticky={anchor ? true : undefined}
        className="piggles-guide-card w-96"
      >
        <PopoverTitle>{step?.title}</PopoverTitle>
        {/* 16px, full ink. It is the only thing in this feature anybody reads. */}
        <p className="mt-2 text-base">{step?.body}</p>
        <div className="mt-4 flex items-center gap-2">
          {/* "Stop here" is gone on the last step: stopping and finishing are
              the same act there, and offering both would record somebody who
              read the whole thing as having walked out of it. */}
          {last ? null : (
            <Button variant="ghost" size="sm" onClick={leave}>
              Stop here
            </Button>
          )}
          <span className="flex-1" />
          <Button variant="outline" size="sm" disabled={state.index === 0} onClick={back}>
            Back
          </Button>
          {/* Both are `next`. Past the last step it ends the guide as FINISHED,
              which is the difference between "they have seen this" and "they got
              partway and left". */}
          <Button color="primary" size="sm" onClick={next}>
            {last ? 'Got it' : 'Next'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
