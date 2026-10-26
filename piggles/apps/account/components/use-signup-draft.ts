'use client';

import { useCallback, useEffect, useState } from 'react';
import { keepSignupDraft, restoreSignupDraft, type SignupDraft } from '@/lib/signup-draft';

export interface SignupDraftState {
  /** The kept answers, once read after mount; null until then or when none. */
  draft: SignupDraft | null;
  /** Bumped on each restore. Key the fields with it so their defaults re-apply. */
  version: number;
  /** Call on every change to the form. */
  keep: (form: HTMLFormElement) => void;
}

/** Restores the signup draft after a reload and after a failed attempt, which resets the form. */
export function useSignupDraft(attempt: unknown): SignupDraftState {
  const [draft, setDraft] = useState<SignupDraft | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const kept = restoreSignupDraft();
    if (!kept) return;
    setDraft(kept);
    setVersion((n) => n + 1);
  }, [attempt]);

  const keep = useCallback((form: HTMLFormElement) => keepSignupDraft(new FormData(form)), []);
  return { draft, version, keep };
}
