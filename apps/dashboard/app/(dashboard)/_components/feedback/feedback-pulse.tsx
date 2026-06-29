'use client';

import * as React from 'react';
import { Button } from '@sparx/ui';
import { useQuery } from '@sparx/query';
import { X } from 'lucide-react';
import { getFeedbackPulseAction, recordPulseEventAction } from '../../_shell/feedback-actions';

// The non-intrusive pulse (docs/112 §5): a dismissible bottom-right slide-in —
// never a modal. Eligibility is decided SERVER-side; the client only decides
// *when* to ask the server (after a natural lull / a positive-completion event),
// so a cold page-load mid-task never triggers it.
//
// Behavior trigger: armed either by a `sparx:positive-completion` window event
// (flows can opt in by dispatching it after a save/publish) or, failing that,
// after a minimum session dwell — both stand-ins for "a natural breath." Once
// armed we ask the server once; a returned descriptor shows the card. Shown /
// dismissed / answered are all recorded so the cadence + cap (§5.2) hold.

const ARM_AFTER_MS = 60_000;

// Mirror the server's suppression list (api-rest feedback.ts) so we don't even
// ask on a sensitive surface.
const SUPPRESSED_PREFIXES = [
  '/commerce/checkout',
  '/settings/billing',
  '/onboarding',
  '/sign-in',
  '/sign-up',
];

const SENTIMENTS: readonly { value: number; emoji: string; label: string }[] = [
  { value: 1, emoji: '😞', label: 'Frustrating' },
  { value: 2, emoji: '😐', label: 'Okay' },
  { value: 3, emoji: '🙂', label: 'Good' },
  { value: 4, emoji: '😍', label: 'Love it' },
];

// One ask per browser session, regardless of remounts.
let shownThisSession = false;

// Holds the last picked sentiment between answer() and "Share more".
const pendingSentiment = { current: undefined as number | undefined };

export function FeedbackPulse({
  currentRoute,
  onShareMore,
}: {
  currentRoute: string;
  onShareMore: (sentiment: number) => void;
}) {
  const [armed, setArmed] = React.useState(false);
  const [phase, setPhase] = React.useState<'hidden' | 'asking' | 'thanks'>('hidden');

  const suppressed = SUPPRESSED_PREFIXES.some((p) => currentRoute.startsWith(p));

  // Arm on a positive-completion event, or after a dwell timeout.
  React.useEffect(() => {
    if (shownThisSession) return;
    function arm() {
      setArmed(true);
    }
    window.addEventListener('sparx:positive-completion', arm);
    const t = window.setTimeout(arm, ARM_AFTER_MS);
    return () => {
      window.removeEventListener('sparx:positive-completion', arm);
      window.clearTimeout(t);
    };
  }, []);

  const { data: descriptor } = useQuery({
    queryKey: ['feedback', 'pulse', currentRoute],
    queryFn: () => getFeedbackPulseAction(currentRoute),
    enabled: armed && !shownThisSession && !suppressed && phase === 'hidden',
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
    retry: false,
  });

  // Reveal the card once when the server says we're eligible.
  React.useEffect(() => {
    if (descriptor && phase === 'hidden' && !shownThisSession) {
      shownThisSession = true;
      setPhase('asking');
      void recordPulseEventAction('shown');
    }
  }, [descriptor, phase]);

  if (phase === 'hidden' || !descriptor) return null;

  function answer(sentiment: number) {
    void recordPulseEventAction('answered', sentiment);
    setPhase('thanks');
    // Give them the option to elaborate, then fade on its own.
    window.setTimeout(() => setPhase('hidden'), 6000);
    pendingSentiment.current = sentiment;
  }

  function dismiss() {
    void recordPulseEventAction('dismissed');
    setPhase('hidden');
  }

  return (
    <div
      role="dialog"
      aria-label="Quick feedback"
      aria-live="polite"
      className="motion-safe:animate-in motion-safe:slide-in-from-bottom-4 fixed right-4 bottom-4 z-40 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 shadow-lg"
    >
      <Button
        variant="ghost"
        size="sm"
        aria-label="Dismiss"
        onClick={dismiss}
        className="absolute top-1.5 right-1.5"
      >
        <X className="h-4 w-4" />
      </Button>

      {phase === 'asking' ? (
        <PulseAsk question={descriptor.question} onAnswer={answer} onDismiss={dismiss} />
      ) : (
        <PulseThanks onShareMore={() => onShareMore(pendingSentiment.current ?? 3)} />
      )}
    </div>
  );
}

function PulseAsk({
  question,
  onAnswer,
  onDismiss,
}: {
  question: string;
  onAnswer: (sentiment: number) => void;
  onDismiss: () => void;
}) {
  return (
    <>
      <p className="pr-5 text-sm font-medium text-[var(--color-text-primary)]">{question}</p>
      <div className="mt-3 flex items-center justify-between gap-1">
        {SENTIMENTS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onAnswer(s.value)}
            aria-label={s.label}
            title={s.label}
            className="flex h-10 w-10 items-center justify-center rounded-md text-xl transition-transform hover:scale-110 hover:bg-[var(--color-bg-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:outline-none"
          >
            {s.emoji}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-2 text-xs text-[var(--color-text-tertiary)] underline-offset-2 hover:underline"
      >
        Not now
      </button>
    </>
  );
}

function PulseThanks({ onShareMore }: { onShareMore: () => void }) {
  return (
    <>
      <p className="pr-5 text-sm font-medium text-[var(--color-text-primary)]">Thanks! 🙏</p>
      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Anything you’d like to add?</p>
      <Button color="primary" variant="soft" size="sm" className="mt-3" onClick={onShareMore}>
        Share more
      </Button>
    </>
  );
}
