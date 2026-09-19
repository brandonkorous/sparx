// THE SERVER SAYS "REDIRECT". THIS SCREEN IS CALLED OLD LINKS.
//
// The routes are shared with the other console, where "redirect" is the right
// word, and their 4xx sentences are shown to the person verbatim. So a shop
// owner who added the same old address twice read:
//
//     A redirect from "/shipping" already exists.
//
// on a screen whose own vocabulary note says "'Redirects' is infrastructure".
//
// And the translation had a trap in it. `isDuplicateRedirectError` decides
// whether to offer the way out, and it decides by looking for "already exists"
// in that sentence — which the plain version does not contain.

import { describe, expect, it } from 'vitest';
import { ApiError } from '@wizeworks/api-client';

import { isDuplicateRedirectError, redirectErrorMessage } from './redirects-format';

/** A 409 as the client raises it, carrying the route's own sentence. */
const refusal = (message: string): ApiError =>
  new ApiError(409, {
    success: false,
    error: { code: 'CONFLICT', message, request_id: 'r', details: null },
  });

describe('the three refusals the routes can send', () => {
  it('says a duplicate without the word', () => {
    expect(redirectErrorMessage(refusal('A redirect from "/shipping" already exists.'), 'x')).toBe(
      'There is already an old link from "/shipping".'
    );
  });

  it('says a self-reference without the word', () => {
    expect(redirectErrorMessage(refusal('A redirect cannot point to itself.'), 'x')).toBe(
      'An old link cannot point at itself.'
    );
  });

  it('says a loop without the word OR the word "loop"', () => {
    // "Loop" is its own piece of jargon, which is why this one is not a swap.
    expect(redirectErrorMessage(refusal('Redirect would create a loop via /a → /b.'), 'x')).toBe(
      'That would send visitors round in a circle: /a → /b.'
    );
  });

  it('never leaves the word on screen, whatever the sentence is', () => {
    // The rule, rather than the three examples. A refusal added to the routes
    // tomorrow still arrives on this screen.
    for (const message of [
      'A redirect from "/x" already exists.',
      'A redirect cannot point to itself.',
      'Redirect would create a loop via /a → /b.',
      'Too many redirects in a chain from /a.',
      'That redirect is not allowed here.',
    ]) {
      expect(redirectErrorMessage(refusal(message), 'x')).not.toMatch(/redirect/i);
    }
  });
});

describe('a refusal with nowhere to go', () => {
  it('falls back to the caller when the server sent no sentence', () => {
    expect(redirectErrorMessage(new Error('boom'), 'Nothing was changed.')).toBe(
      'Nothing was changed.'
    );
  });
});

describe('the way out of a duplicate', () => {
  it('is still offered after the sentence is translated', () => {
    // THE TRAP. The plain sentence says "There is already an old link from …",
    // which contains neither "already exists" nor "redirect". Routing this
    // through the display text would switch the button off on every duplicate —
    // the one case it exists for.
    const duplicate = refusal('A redirect from "/shipping" already exists.');
    expect(isDuplicateRedirectError(duplicate)).toBe(true);
    expect(redirectErrorMessage(duplicate, 'x')).not.toMatch(/already exists/i);
  });

  it('is not offered for the other two, which have nowhere to send anybody', () => {
    expect(isDuplicateRedirectError(refusal('A redirect cannot point to itself.'))).toBe(false);
    expect(isDuplicateRedirectError(refusal('Redirect would create a loop via /a → /b.'))).toBe(
      false
    );
  });
});
