import { PigglesMascot } from '@piggles/mascot/react';

// Piggles at her desk, under the three claims on the brand panel.
//
// ── WHAT THIS USED TO BE, AND WHY THE CARDS WENT ────────────────────────────
//
// Two small cards floated over the artwork's clear top-left corner — "Bookings ·
// 6 today" and "Invoices · $1,250 · Paid" — wearing their apps' hues. The idea
// was that two cards from two different apps say "these live together" faster
// than the line above them can be read, and show the six-color system working
// before anybody has an account to see it in.
//
// They were removed on Brandon's call (2026-08-15) and the call is right. The
// figures were invented, so the cards were a picture of a dashboard nobody has —
// on the one page where the reader has no account and no way to tell. Everything
// else on this panel is a claim the product actually keeps; two made-up numbers
// beside them are the weakest thing on the page and they were sitting in the
// strongest position on it.
//
// The rule that survives them, because it is the reason they never sat over her
// face: if anything is ever placed on top of this artwork again, SAMPLE THE
// ALPHA CHANNEL first. On this cut (1150×909) the clear region is the top-left
// block, x 0–33% and y 0–37%. It moves whenever the pose changes, and guessing
// does not converge — it took two attempts and a measurement last time.
//
// ── THE POSE, AND WHY IT IS NOT THE OBVIOUS ONE ─────────────────────────────
//
// `laptop-coffee`. Two poses could have taken this, and they are the same table
// at the same distance. The difference is where she is looking:
//
//   • `laptop-focus` — head down, both hands on the keyboard, absorbed. A
//     picture of somebody who has not noticed you walked in.
//   • `laptop-coffee` — looks up, mug in hand, open smile.
//
// This screen is a DOOR. Somebody is deciding whether to put their livelihood on
// this, or coming back to work they have already started, and this panel is the
// only warmth on it. The pose that ignores them is the wrong one however good it
// looks, so the deciding property is her eyeline and not the composition.
//
// ── THE ASSET ───────────────────────────────────────────────────────────────
//
// From @piggles/mascot, never a raw path. There used to be a hand-cut copy of the
// old artwork at `public/piggles-at-desk.png`, and two copies of one asset meant a
// re-cut would land in the catalog and silently miss this screen — which is the
// exact drift the package exists to stop, and exactly what the 2026-08-15
// re-delivery would have triggered. The hand-cut copy is gone; keep it that way.
//
// The cutout is genuinely transparent — no baked backdrop — which is what lets it
// sit directly on the pink wash. An asset with a plate behind it would stop being
// the same design, so keep any replacement cut the same way.

export function ProductGlimpse() {
  return (
    // `aria-hidden` because she is decoration: the three claims above her carry
    // the meaning and she agrees with them, which is the standing rule for the
    // mascot everywhere (DESIGN.md — never the only indicator of anything).
    <div aria-hidden className="mt-8 hidden sm:block">
      <PigglesMascot
        pose="laptop-coffee"
        // She IS the panel here — the column decides her width, not one of the
        // four fixed sizes. `sizes` is required with `fill` for that reason:
        // sized by the column, not by the viewport, since the panel is roughly
        // half of a 72rem shell at `lg` and full width below it.
        size="fill"
        sizes="(min-width: 1024px) 38rem, 100vw"
      />
    </div>
  );
}
