// The canvas and the inbox must agree about what a fallback token means.
//
// silicaui 0.49 added `resolveExpression` to the email host: the engine owns one token
// production — a bare dotted path — and hands every other `{{…}}` body to the host
// verbatim. That closed a gap the email builder had carried since the beginning, where
// `{{customer.firstName ?? "there"}}` never matched silica's own regex, so an author saw
// raw braces on the canvas while the send resolved the token correctly.
//
// The risk in closing it is a SECOND evaluator. If `resolveEmailExpression` and
// `interpolateEmailTokens` ever disagreed, the canvas would be confidently wrong instead
// of visibly approximate — which is worse, because nobody would check. So every case
// below asserts the two against each other rather than against a hand-written expectation.

import { describe, expect, it } from 'vitest';

import { interpolateEmailTokens, resolveEmailExpression } from './email-tokens';

/** The sample a canvas would resolve against: one present field, one empty, one absent. */
const DATA: Record<string, unknown> = {
  'customer.firstName': 'Alex',
  'customer.company': '',
  'order.number': 1042,
};

const resolve = (path: string): unknown => DATA[path];

/** Every body shape an author can write, including the ones that are mistakes. */
const BODIES = [
  'customer.firstName',
  'customer.firstName ?? "there"',
  "customer.firstName ?? 'there'",
  'customer.company ?? "your company"',
  'customer.company',
  'order.number',
  'order.number ?? "—"',
  'missing.path',
  'missing.path ?? "A customer"',
  'missing.path ?? ""',
  '  customer.firstName   ??   "there"  ',
];

describe('the canvas resolves a token exactly as the send does', () => {
  it.each(BODIES)('{{%s}}', (body) => {
    // What the SEND produces for this token, through the shipped interpolator.
    const sent = interpolateEmailTokens(`{{${body}}}`, resolve);
    // What the CANVAS produces, through the host hook.
    const canvas = resolveEmailExpression(body, resolve);
    expect(canvas?.value ?? `{{${body}}}`).toBe(sent);
  });

  it('has cases that actually exercise the fallback', () => {
    // Guard on the guard: if every case resolved to a present value, the assertions
    // above would pass without the fallback grammar being involved at all.
    expect(resolveEmailExpression('missing.path ?? "A customer"', resolve)?.value).toBe(
      'A customer'
    );
    // An EMPTY string is a value, not an absence — a field the customer left blank must
    // fall back the same way a missing one does, which is what the send already did.
    expect(resolveEmailExpression('customer.company ?? "your company"', resolve)?.value).toBe(
      'your company'
    );
  });

  it('leaves a body with no path in it alone', () => {
    // silica's contract: `undefined` means "I don't understand this", the literal
    // `{{…}}` stays exactly as authored, and an `unknown-expression` diagnostic fires.
    // Returning the fallback here would silently render `{{ }}` as nothing, hiding the
    // author's typo instead of showing it.
    for (const body of ['', '   ', '?? "there"'])
      expect(resolveEmailExpression(body, resolve)).toBeUndefined();
  });

  it('treats a nonsense path as a path, because the send does', () => {
    // `{{"just a string"}}` has no `??`, so the whole body reads as a path, it resolves
    // to nothing, and both sides render empty. That is arguably not the friendliest
    // answer to a typo — but PARITY is the property being defended here, and the send
    // has behaved this way since the grammar shipped. Changing it is a change to the
    // documented token grammar, not something to fix on one side.
    expect(resolveEmailExpression('"just a string"', resolve)).toEqual({ value: '' });
    expect(interpolateEmailTokens('{{"just a string"}}', resolve)).toBe('');
  });

  it('renders an empty fallback as empty rather than reverting to braces', () => {
    // `{{a ?? ""}}` is a deliberate "show nothing here" — understood, so it must resolve.
    expect(resolveEmailExpression('missing.path ?? ""', resolve)).toEqual({ value: '' });
  });
});
