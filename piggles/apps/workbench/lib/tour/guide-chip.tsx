'use client';

// The guide itself, as one control on the status strip.
//
// ── WHY IT LIVES DOWN HERE ──────────────────────────────────────────────────
//
// Because the alternative covers the work. See lib/tour/use-guide.ts for the
// argument in full; the short version is that a console whose premise is "you
// decide what is on screen" cannot explain itself by taking the screen away.
//
// The strip already does exactly this job for the occasional "how's it going?"
// ask (components/feedback/sentiment-chip.tsx), and it works for the same reason
// it works here: it is the one shelf in the product that is never in the way.
//
// ── WHAT IT LOOKS LIKE ──────────────────────────────────────────────────────
//
// Offering: one pink button — "New here? Show me around."
// Running:  the step's own words in a popover ABOVE the chip, with where you are
//           ("2 of 7"), Back, Next, and a way out that is a real button.
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
import { currentStep, useGuideActions, useGuideAnchor, useGuideState } from './use-guide';

export function GuideChip() {
  const state = useGuideState();
  const step = currentStep(state);
  const { accept, decline, next, back, leave } = useGuideActions();

  useGuideAnchor(step);

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
      {/* Upward — it sits on the bottom edge, so a downward panel would clip. */}
      <PopoverContent side="top" align="end" className="w-96">
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
