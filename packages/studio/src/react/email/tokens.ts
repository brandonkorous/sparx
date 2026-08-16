'use client';

// Merge tags, resolved for the canvas.
//
// An author writing "Hi {{customer.firstName ?? "there"}}" is deciding what a
// nameless customer reads. Showing them raw braces hides that decision behind
// the exact syntax it was worth using, so the canvas resolves tags the same way
// the send does — through the host, which owns the expression language.
//
// A tag the host does not recognise is LEFT AS AUTHORED, never blanked. An
// unknown tag is usually a typo, and a typo that renders as nothing looks like a
// value that happened to be empty.

import type { EmailPreviewHost } from '../host';

/** `{{ anything }}`, non-greedy so two tags on one line stay two tags. */
const TAG = /\{\{([\s\S]*?)\}\}/g;

/** A bare dotted path — the one production the engine resolves itself, by
 *  handing it to `resolveBinding`. Everything else is the host's expression. */
const PATH = /^[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*$/;

export function resolveMergeTags(text: string, preview: EmailPreviewHost | undefined): string {
  if (!text.includes('{{') || !preview) return text;

  return text.replace(TAG, (whole, body: string) => {
    const expr = body.trim();
    if (!expr) return whole;
    const resolved = PATH.test(expr)
      ? preview.resolveBinding?.(expr)
      : preview.resolveExpression?.(expr);
    return resolved ?? whole;
  });
}
