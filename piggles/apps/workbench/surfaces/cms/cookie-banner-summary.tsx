'use client';

// What visitors will see, from the choices on screen. It reads the DRAFT, so it
// says "once you save" until the site is actually showing it.

import { Alert, AlertContent, AlertDescription, AlertTitle } from '@wizeworks/silicaui-react';
import type { CookieBannerMode } from './cookie-banner-data';
import { visitorViewWords } from './cookie-banner-words';

export function CookieBannerSummary({
  mode,
  kinds,
  policyPublished,
  unsaved,
}: {
  mode: CookieBannerMode;
  kinds: readonly string[];
  /** Whether this site's Cookie Policy page is published. */
  policyPublished: boolean;
  /** True while the approach or kinds on screen differ from what is saved. */
  unsaved: boolean;
}) {
  const words = visitorViewWords(mode, kinds, policyPublished);
  return (
    <Alert color={words.tone} variant="soft" aria-live="polite">
      <AlertContent>
        <AlertTitle>
          {unsaved ? `Once you save: ${lowerFirst(words.title)}` : words.title}
        </AlertTitle>
        <AlertDescription>
          {words.detail}
          {unsaved ? ' Until then your site keeps showing what you last saved.' : ''}
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
