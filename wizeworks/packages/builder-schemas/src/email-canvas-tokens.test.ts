// Every merge token in a shipped default must be one the BUILDER CANVAS can render.
//
// silica resolves `{{…}}` in email copy itself, and its token regex matches a BARE path
// — `[a-zA-Z0-9_.]` and nothing else. A token carrying sparx's `?? "fallback"` extension
// never matches, passes through projection verbatim, and shows an author raw braces in
// the editor. Sends were always fine (`interpolateEmailTokens` runs over the projected
// HTML and does understand fallbacks), so the damage was confined to the one surface
// where someone is actually looking at the email while they work on it.
//
// The defaults carried 31 of them — 29 greetings and two full names. They now use
// `customer.greeting` / `customer.displayName`, derived never-blank at send time by
// `deriveCustomerNames`, which removes the need for a fallback rather than working
// around the engine. `??` remains supported for anyone who wants it; see
// `email/src/silica/__tests__/merge-token-fallbacks.test.ts`.
//
// This test is what stops it coming back: a default authored with `?? "…"` fails here
// rather than shipping an email that reads as broken in the editor that made it.

import { describe, expect, it } from 'vitest';

import { DEFAULT_EMAIL_TEMPLATES } from './default-emails';

/** What silica's own token pass will match. Anything else reaches the canvas as text. */
const CANVAS_RENDERABLE = /^\{\{[a-zA-Z0-9_.]+\}\}$/;

/** Every `{{…}}` occurrence anywhere in a document, however deeply nested. */
function tokensIn(value: unknown, found: string[] = []): string[] {
  if (typeof value === 'string') {
    found.push(...(value.match(/\{\{[^}]*\}\}/g) ?? []));
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) tokensIn(v, found);
  }
  return found;
}

describe('shipped default emails only use canvas-renderable merge tokens', () => {
  it('finds tokens to check at all', () => {
    // Guard on the guard: if the walk ever stops finding tokens (a shape change), the
    // assertion below would pass by vacuity.
    const all = DEFAULT_EMAIL_TEMPLATES.flatMap((t) => tokensIn(t.doc));
    expect(all.length).toBeGreaterThan(50);
  });

  it('no default carries a token the editor cannot display', () => {
    const offenders = DEFAULT_EMAIL_TEMPLATES.flatMap((t) =>
      [...new Set(tokensIn(t.doc))]
        .filter((token) => !CANVAS_RENDERABLE.test(token))
        .map((token) => `${t.key} — ${token}`)
    );
    // Joined so a failure prints the offending tokens themselves.
    expect(offenders.join('\n')).toBe('');
  });

  it('greets with a name that cannot come out blank', () => {
    // The specific trap this replaced: `{{customer.firstName}}` on its own renders
    // "Hi " for an anonymous checkout. A default may greet with `customer.greeting`,
    // never with the raw first name.
    const raw = DEFAULT_EMAIL_TEMPLATES.flatMap((t) =>
      tokensIn(t.doc)
        .filter((token) => token === '{{customer.firstName}}')
        .map(() => t.key)
    );
    expect([...new Set(raw)].join(', ')).toBe('');
  });
});
