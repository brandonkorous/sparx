'use client';

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import {
  keepOnboardingDraft,
  restoreOnboardingDraft,
  type OnboardingDraft,
} from '@/lib/onboarding-draft';
import { clearSignupDraft } from '@/lib/signup-draft';

/** Restores the setup answers after a reload, then keeps every change in this tab. */
export function useAnswersDraft(
  answers: OnboardingDraft,
  setAnswers: Dispatch<SetStateAction<OnboardingDraft>>
): void {
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const kept = restoreOnboardingDraft();
    if (kept) setAnswers((current) => ({ ...current, ...kept }));
    // Reaching setup means the signup worked, so its draft has done its job.
    clearSignupDraft();
    setRestored(true);
  }, [setAnswers]);

  // Saved only after the restore, or the first save would overwrite the draft with defaults.
  const snapshot = JSON.stringify(answers);
  useEffect(() => {
    if (restored) keepOnboardingDraft(JSON.parse(snapshot) as OnboardingDraft);
  }, [restored, snapshot]);
}
