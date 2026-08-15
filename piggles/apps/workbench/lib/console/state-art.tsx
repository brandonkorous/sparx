'use client';

// Piggles in the empty, waiting and failed states.
//
// ── WHY SHE BELONGS HERE ────────────────────────────────────────────────────
//
// DESIGN.md §7 names exactly four places the mascot earns her keep: empty
// states, onboarding, success moments and 404s. An empty pane is the first of
// those and the most common by a wide margin, so this is where a person meets
// her most — a shop owner who opens Bookings on a quiet Tuesday and finds a pig
// dozing next to "Nothing booked this week" has been told something true by
// something friendly, which is the entire brief.
//
// The platform's own answer is a lucide glyph toned by state (red for a failure,
// amber for a filter, the app's hue for a first run). That is a real improvement
// over five identical grey pictures — but it is still five identical PICTURES
// told apart by a colour. A character tells them apart by POSE, which carries
// further and needs no reading.
//
// ── WHAT SHE MUST NEVER BECOME ──────────────────────────────────────────────
//
// Small. `sm` is 96px, and that is deliberate at every state: this appears in a
// pane somebody is trying to work in, and a character filling the region is a
// mood board rather than a state. The words still carry the meaning — she agrees
// with them, she never replaces them (DESIGN.md: "she must never be the only
// indicator of a state").
//
// And she is never present for money, tax, payroll, deletion or a capacity
// block. That is not a rule this file has to remember: `MascotIntent` is a
// closed union with no member for any of them, so there is no pose to reach for
// — see @piggles/mascot's intents.ts.
//
// ── THE PER-APP POSES ───────────────────────────────────────────────────────
//
// `mascotForApp` maps a Piggles app to its own empty-state pose — a calendar for
// Bookings, an invoice for Invoices, boxes for Stock. Most of those are not
// drawn yet and fall through to a generic pose today; the chains are already
// correct, so the day that batch lands, fifteen empty states get specific with
// no edit here and none at any call site.

import { MODULE_TO_APP } from '@piggles/config';
// The pose LOOKUPS come from the package root (no React in it, so it is safe
// anywhere); the component comes from ./react. Keeping them apart is the whole
// reason the package splits that way.
import { mascotForApp, resolveIntent } from '@piggles/mascot';
import { PigglesMascot } from '@piggles/mascot/react';
import type { ProductStateArtProps } from '@/lib/product';

export function PigglesStateArt({ state, module }: ProductStateArtProps) {
  // A pane that knows which app it belongs to gets that app's own picture. One
  // that does not — a cross-cutting surface, a dialog — falls through to the
  // generic pose for the state, which is still better than a grey glyph.
  const app = module ? MODULE_TO_APP[module] : undefined;

  if (state === 'first-run' || state === 'empty') {
    // An empty list is an invitation, and the invitation is app-shaped: what is
    // missing from Bookings is not what is missing from Stock.
    const pose = app ? mascotForApp(app).id : resolveIntent('empty').id;
    return <PigglesMascot pose={pose} size="sm" className="-mb-2" />;
  }

  if (state === 'no-results') {
    // Not the same as empty, and the pose is the whole distinction: something IS
    // here, the filter is hiding it. She is looking for it.
    return <PigglesMascot intent="no-results" size="sm" className="-mb-2" />;
  }

  if (state === 'unreachable') {
    // A recoverable system fault — the server did not answer. NOT a payment
    // failure and NOT a security event; both of those are money or trust, and
    // both are plain and calm with no character anywhere near them.
    return <PigglesMascot intent="server-error" size="sm" className="-mb-2" />;
  }

  if (state === 'missing') {
    // The record is gone. Nothing is broken and nothing can be retried, so this
    // is the lost-and-looking pose rather than the something-went-wrong one.
    return <PigglesMascot intent="not-found" size="sm" className="-mb-2" />;
  }

  // Waiting. Deliberately the smallest of the lot: this one appears for a second
  // and then leaves, so it should register and not perform.
  return <PigglesMascot intent="loading" size="sm" />;
}
