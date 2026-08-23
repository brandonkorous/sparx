'use client';

import { useEffect, useState } from 'react';
import type { PigglesGroup } from '@piggles/brand';
import type { OnboardingState } from '@/app/onboarding/actions';

/** The brand's own showcase — always offered, always first, preselected. */
export const SHOWCASE_KEY = 'piggles-starter';

export interface Answers {
  name: string;
  setName: (value: string) => void;
  trade: string;
  setTrade: (value: string) => void;
  look: string;
  setLook: (value: string) => void;
  picked: PigglesGroup[];
  toggle: (group: PigglesGroup) => void;
  /** Bumped on every failed attempt. Key the fields with it — see below. */
  attempt: number;
}

/**
 * The two answers, the look, and a key that survives a failed attempt.
 *
 * React resets a form's DOM after every `<form action>` finishes, failures
 * included, and then re-applies only the props that CHANGED — so after a failure
 * nothing changed, and each field keeps whatever the reset left it holding.
 * Controlled is not enough on its own: `apparel === apparel` writes nothing, and
 * the trade came back reading "Food & drink", the first option a browser can
 * land on when the empty one is disabled (issue 163).
 *
 * So the answers live here, out of reach of the reset, and `attempt` re-mounts
 * the fields with them.
 */
export function useOnboardingAnswers(suggestedName: string, state: OnboardingState): Answers {
  const [name, setName] = useState(suggestedName);
  const [trade, setTrade] = useState('');
  const [look, setLook] = useState(SHOWCASE_KEY);
  const [picked, setPicked] = useState<PigglesGroup[]>([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (state.error) setAttempt((n) => n + 1);
  }, [state]);

  const toggle = (group: PigglesGroup) =>
    setPicked((cur) => (cur.includes(group) ? cur.filter((x) => x !== group) : [...cur, group]));

  return { name, setName, trade, setTrade, look, setLook, picked, toggle, attempt };
}
