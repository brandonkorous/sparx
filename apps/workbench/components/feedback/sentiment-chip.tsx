'use client';

// "How's sparx going?" — asked once a quarter, and never in the way.
//
// The dashboard asks this with a card that slides over the corner of the page.
// That does not translate: this app's premise is that the operator decides what
// occupies the screen, so an unbidden panel over someone's work is the one thing
// the whole layout model exists to prevent.
//
// The status bar already has exactly the right grammar for it — chips that
// appear only when they have something to report and vanish when they don't
// (running jobs, detached windows, the activity chip). An occasional question
// fits that shelf precisely: visible, ignorable, covering nothing.
//
// Eligibility (account age, quarterly cadence, dismissal backoff) is decided
// SERVER-side; the client only chooses WHEN to ask.

import { useEffect, useState } from 'react';
import { Button, Popover, PopoverContent, PopoverTrigger } from '@wizeworks/silicaui-react';
import { recordPulseEvent, usePulse } from '../../lib/api/feedback';
import { useWorkbench } from '../../lib/workbench/context';
import { useFeedback } from './provider';

/** A stand-in for "a natural breath" when nothing signals one explicitly. */
const ARM_AFTER_MS = 60_000;

/** How often an armed ask re-checks whether the workbench has gone quiet.
 *  Dirty state is PULL-based — nothing fires when a form flips clean — so it has
 *  to be asked for. Without this, arming while a pane held unsaved work would
 *  suppress the question for the rest of the session with nothing to lift it. */
const QUIET_POLL_MS = 5000;

const SENTIMENTS: readonly { value: number; emoji: string; label: string }[] = [
  { value: 1, emoji: '😞', label: 'Frustrating' },
  { value: 2, emoji: '😐', label: 'Okay' },
  { value: 3, emoji: '🙂', label: 'Good' },
  { value: 4, emoji: '😍', label: 'Love it' },
];

/** One ask per browser session, across every remount. */
let askedThisSession = false;

export function SentimentChip() {
  const { controller } = useWorkbench();
  const feedback = useFeedback();
  const [armed, setArmed] = useState(false);
  const [quiet, setQuiet] = useState(false);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<'hidden' | 'asking' | 'thanks'>('hidden');
  const [answered, setAnswered] = useState<number | null>(null);

  // Armed by an explicit positive completion (a flow can dispatch this after a
  // save or a publish), or failing that by dwell.
  useEffect(() => {
    if (askedThisSession) return;
    const arm = () => {
      setArmed(true);
    };
    window.addEventListener('sparx:positive-completion', arm);
    const timer = window.setTimeout(arm, ARM_AFTER_MS);
    return () => {
      window.removeEventListener('sparx:positive-completion', arm);
      window.clearTimeout(timer);
    };
  }, []);

  // Quiet means nothing anywhere in the window is holding unsaved work.
  useEffect(() => {
    if (!armed || phase !== 'hidden') return;
    const check = () => {
      setQuiet(!controller.hasUnsavedWork());
    };
    check();
    const timer = setInterval(check, QUIET_POLL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [armed, phase, controller]);

  const { data: descriptor } = usePulse(
    'workbench',
    armed && quiet && !askedThisSession && phase === 'hidden'
  );

  useEffect(() => {
    if (!descriptor || askedThisSession || phase !== 'hidden') return;
    askedThisSession = true;
    setPhase('asking');
    recordPulseEvent('shown');
  }, [descriptor, phase]);

  if (phase === 'hidden' || !descriptor) return null;

  const answer = (sentiment: number) => {
    recordPulseEvent('answered', sentiment);
    setAnswered(sentiment);
    setPhase('thanks');
    setOpen(false);
    // Leave the thank-you on the shelf briefly, then clear it. A permanent
    // fixture is how a strip full of signals becomes furniture.
    window.setTimeout(() => {
      setPhase('hidden');
    }, 8000);
  };

  const dismiss = () => {
    recordPulseEvent('dismissed');
    setOpen(false);
    setPhase('hidden');
  };

  if (phase === 'thanks') {
    return (
      <Button
        color="neutral"
        variant="ghost"
        size="xs"
        onClick={() => {
          setPhase('hidden');
          feedback.openSend({ source: 'pulse', sentiment: answered ?? 3 });
        }}
      >
        Thank you — say more?
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <Button color="neutral" variant="ghost" size="xs">
          How’s sparx going?
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <p className="font-medium">{descriptor.question}</p>
        <div className="mt-3 flex items-center justify-between gap-1">
          {SENTIMENTS.map((sentiment) => (
            <Button
              key={sentiment.value}
              color="neutral"
              variant="ghost"
              size="lg"
              shape="square"
              aria-label={sentiment.label}
              title={sentiment.label}
              onClick={() => {
                answer(sentiment.value);
              }}
            >
              <span aria-hidden className="text-xl leading-none">
                {sentiment.emoji}
              </span>
            </Button>
          ))}
        </div>
        <Button color="neutral" variant="ghost" size="sm" className="mt-2" onClick={dismiss}>
          Not now
        </Button>
      </PopoverContent>
    </Popover>
  );
}
