'use client';

import { useEffect, useState } from 'react';
import type { PigglesGroup } from '@piggles/brand';
import { slugifyAddressTyping, slugifyBusinessName } from '@/lib/address-rules';
import type { OnboardingDraft } from '@/lib/onboarding-draft';
import type { OnboardingState } from '@/app/onboarding/actions';
import { useAnswersDraft } from './use-answers-draft';

/** The brand's own showcase — always offered, always first, preselected. */
export const SHOWCASE_KEY = 'piggles-starter';

export interface Answers {
  name: string;
  setName: (value: string) => void;
  trade: string;
  setTrade: (value: string) => void;
  /** The web address, following the name until she edits it herself. */
  address: string;
  setAddress: (value: string) => void;
  look: string;
  setLook: (value: string) => void;
  picked: PigglesGroup[];
  toggle: (group: PigglesGroup) => void;
  heard: string;
  setHeard: (value: string) => void;
  /** Bumped on every failed attempt. Key the fields with it — see below. */
  attempt: number;
}

function initialAnswers(suggestedName: string): OnboardingDraft {
  return {
    name: suggestedName,
    trade: '',
    address: '',
    ownAddress: false,
    look: SHOWCASE_KEY,
    picked: [],
    heard: '',
  };
}

const toggled = (cur: PigglesGroup[], group: PigglesGroup): PigglesGroup[] =>
  cur.includes(group) ? cur.filter((x) => x !== group) : [...cur, group];

/** The answers, out of reach of React's reset after a form action (issue 163) and kept across a reload. */
export function useOnboardingAnswers(suggestedName: string, state: OnboardingState): Answers {
  const [v, setV] = useState(() => initialAnswers(suggestedName));
  const [attempt, setAttempt] = useState(0);
  const set = (key: 'name' | 'trade' | 'look' | 'heard') => (value: string) =>
    setV((cur) => ({ ...cur, [key]: value }));

  useEffect(() => {
    if (state.error) setAttempt((n) => n + 1);
  }, [state]);
  useAnswersDraft(v, setV);

  // The address follows the name until she edits it; then it is hers. Tidied as typed (issue #181).
  return {
    name: v.name,
    setName: set('name'),
    trade: v.trade,
    setTrade: set('trade'),
    address: v.ownAddress ? v.address : (slugifyBusinessName(v.name) ?? ''),
    setAddress: (value: string) =>
      setV((cur) => ({ ...cur, ownAddress: true, address: slugifyAddressTyping(value) })),
    look: v.look,
    setLook: set('look'),
    picked: v.picked,
    toggle: (group: PigglesGroup) =>
      setV((cur) => ({ ...cur, picked: toggled(cur.picked, group) })),
    heard: v.heard,
    setHeard: set('heard'),
    attempt,
  };
}
