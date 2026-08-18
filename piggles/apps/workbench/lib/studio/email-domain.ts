'use client';

// The one place the email studio reaches into the platform's email vocabulary.
//
// One seam, deliberately: the scope it imports from is being renamed
// (piggles/docs/migration/), and a single import statement makes that a one-line
// change here rather than a sweep through the panes. Everything below is
// re-exported for the rest of the studio to use.
//
// The sample data is EMAIL's, not the site canvas's. On an email
// `customer.firstName` means the person this is being sent to; resolved against
// the site's preview root it would print a plausible wrong name — which is worse
// than raw braces, because nothing about it looks wrong.
//
// The expression evaluator is the platform's own, the SAME one the send uses. A
// second one would let the canvas and the inbox disagree about what a fallback
// means, and a fallback is what stops a nameless customer reading "Hi  — thanks".

import { useMemo } from 'react';
import {
  createSilicaResolver,
  defaultSilicaFormat,
  emailMergeTags,
  groupMergeTags,
  resolveEmailExpression,
  EMAIL_CONTENT_BLOCKS,
  SAMPLE_EMAIL_DATA,
  type MergeTag,
} from '@wizeworks/builder-schemas';
import type { EmailPreviewHost } from '@wizeworks/studio/react';

export { EMAIL_CONTENT_BLOCKS, emailMergeTags, groupMergeTags, type MergeTag };

/** A resolved value as text, or undefined when there is nothing showable. */
function showable(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  // A number or a flag reads fine; a record or a list does not, and
  // `[object Object]` on a canvas is worse than leaving the tag as authored.
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

export function useEmailPreview(): EmailPreviewHost {
  return useMemo(() => {
    const resolver = createSilicaResolver({
      root: SAMPLE_EMAIL_DATA,
      format: defaultSilicaFormat,
      hideWhenEmpty: true,
    });
    const path = (ref: string) => resolver.resolveBinding(ref, {})?.value;
    return {
      resolveBinding: (ref) => showable(path(ref)),
      resolveExpression: (expr) => resolveEmailExpression(expr, path)?.value,
    };
  }, []);
}
