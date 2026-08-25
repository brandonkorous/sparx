'use client';

// Is this web address free? Debounced, because it runs on every keystroke of the
// name field and each check is a round trip.

import { useEffect, useState } from 'react';
import type { OnboardingActions } from '../../../lib/onboarding/api';
import type { SlugCheck } from './step-workspace';

export interface SlugState {
  normalized: string;
  unchanged: boolean;
  check: SlugCheck;
  /** Free to use — either untouched (already theirs) or confirmed available. */
  ok: boolean;
}

export function useSlugCheck(
  slug: string,
  savedSlug: string,
  actions: OnboardingActions
): SlugState {
  const [check, setCheck] = useState<SlugCheck>({ status: 'idle' });
  const normalized = slug.trim().toLowerCase();
  const unchanged = normalized === savedSlug.trim().toLowerCase();

  useEffect(() => {
    if (!normalized || unchanged) {
      setCheck({ status: 'idle' });
      return;
    }
    setCheck({ status: 'checking' });
    const handle = setTimeout(() => {
      void actions
        .checkSlug(normalized)
        .then((result) => setCheck({ status: 'done', result }))
        .catch(() => setCheck({ status: 'idle' }));
    }, 400);
    return () => clearTimeout(handle);
  }, [normalized, unchanged, actions]);

  return {
    normalized,
    unchanged,
    check,
    ok: unchanged || (check.status === 'done' && check.result.available === true),
  };
}
