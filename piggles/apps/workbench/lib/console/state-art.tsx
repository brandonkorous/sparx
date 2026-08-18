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
// The platform's own answer is a Font Awesome glyph toned by state (red for a failure,
// amber for a filter, the app's hue for a first run). That is a real improvement
// over five identical grey pictures — but it is still five identical PICTURES
// told apart by a color. A character tells them apart by POSE, which carries
// further and needs no reading.
//
// ── SIZE: TWO VALUES, AND WHY IT USED TO BE ONE ─────────────────────────────
//
// This file used to say 96px at every state, and argued for it: a character
// filling a pane somebody is trying to work in is a mood board rather than a
// state. That argument still holds, and it was written when every pose was the
// FIGURE ALONE — at 96px a whole pig reads perfectly.
//
// The 2026-08-15 art changed what a pose is. Eleven of the fifteen app poses are
// now SCENES: a shop shelf, a service counter, a meeting room with two chairs, a
// packing bench, a round table with the one prop that says which app this is. At
// 96px that prop is a smudge — measured, not guessed, on the marketing film,
// where a calendar and a parcel were indistinguishable at 144px. Which defeats
// the paragraph below: the whole claim is that a character tells five states
// apart BY POSE, and a pose nobody can see tells you nothing.
//
// So there are two sizes now, and the split is not arbitrary:
//
//   • `md` (176px) for empty and first-run. That pane has nothing else in it —
//     she is not competing with work, she IS the content until there is some.
//   • `sm` (96px) everywhere else. Those four poses are all figure-only
//     (magnifier, wrench, spinner), so they read at 96 exactly as before, and
//     each of them sits over a pane a person is trying to get past.
//
// The words still carry the meaning at both sizes — she agrees with them, she
// never replaces them (DESIGN.md: "she must never be the only indicator of a
// state").
//
// And she is never present for money, tax, payroll, deletion or a capacity
// block. That is not a rule this file has to remember: `MascotIntent` is a
// closed union with no member for any of them, so there is no pose to reach for
// — see @piggles/mascot's intents.ts.
//
// ── THE PER-APP POSES ───────────────────────────────────────────────────────
//
// `mascotForApp` maps a Piggles app to its own empty-state pose, and as of the
// 2026-08-15 art all fifteen are specific — a calendar propped beside a laptop
// for Bookings, a counter for Customers, a shelf for Stock, a meeting room for
// My Team. None of them falls through to a generic pose any more, which is why
// the size above had to move: the specificity only exists if it is visible.

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
    // `md`, not `sm` — eleven of the fifteen app poses are scenes now, and the
    // prop that says WHICH app this is disappears at 96px. See the size note in
    // the header.
    return <PigglesMascot pose={pose} size="md" className="-mb-2" />;
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
