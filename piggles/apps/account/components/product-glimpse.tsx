import { Badge } from '@wizeworks/silicaui-react';
import { PigglesMascot } from '@piggles/mascot/react';

// The mascot at her desk, with two cards from the product floating beside her.
//
// ── WHAT THIS IS FOR ────────────────────────────────────────────────────────
//
// The panel beside the form makes a claim — one place for the whole business —
// and a claim is worth less than a look. Two cards from two different apps,
// wearing two different group hues, say "these live together" faster than the
// line above them can be read, and they show the six-colour system doing its job
// before anybody has an account to see it in. The pig is the warmth; the cards
// are the argument.
//
// It is DECORATIVE, and the code says so out loud: the whole block is
// `aria-hidden`, so the figures in it are never announced as facts to somebody
// using a screen reader. That matters more than it looks. The platform has a
// standing rule that a value nobody measured must never render as one, and the
// only thing keeping these numbers on the right side of it is that they are
// obviously an illustration on a page where the reader has no account yet. Do
// not reuse this component anywhere a signed-in person could mistake it for
// their own business.
//
// ── WHY THE CARDS SIT WHERE THEY SIT, AND WHY THEY ARE SMALL ────────────────
//
// Not by eye. The artwork's alpha channel was sampled on a 12×8 grid to find
// where it is actually empty, and there is exactly one usable clear region: the
// top-left quadrant, x 0–42% and y 0–37%, above the laptop lid. At the panel's
// real width that region is about 222×117 CSS pixels — which is the whole
// constraint, and the thing eyeballing got wrong twice.
//
// The first attempt used full-width rows carried over from the version with no
// artwork behind them. Measured on the page they came out 243px and 285px wide,
// the second reaching 71% — straight across the pig's face. Cards on this panel
// have to be SMALL, which is also what the reference does: little floating
// chips, not list rows.
//
// The rules that keep it right:
//
//   • Nothing may cross x 50%. That is where her head starts, in every row.
//   • Overlapping her ear or shoulder (x 42–50%) is fine and reads as depth.
//     Overlapping the FACE never does.
//   • The two cards may overlap each other. They are meant to look placed, not
//     laid out.
//
// If the artwork is ever re-cut or re-cropped, that region moves and these
// percentages go stale — the failure being cards over her face again. Re-sample
// the alpha grid before nudging them; guessing does not converge.
//
// ── THE ASSET ───────────────────────────────────────────────────────────────
//
// The `desk` pose from @piggles/mascot. It was previously a hand-cut copy of the
// same artwork at `public/piggles-at-desk.png` — identical master (1536×1024,
// subject box 1502×851), trimmed and resized by hand instead of by the ingest.
// Two copies of one asset meant a re-cut would have landed in the catalog and
// silently missed this screen, which is the exact drift the package exists to
// stop; the hand-cut copy is gone.
//
// THE GRID WAS RE-SAMPLED for the swap, as the note above requires. The package
// trims tighter (1200×683 against the old 1200×720, all of it bottom margin), so
// the clear region moves — and measured, it does not move enough to matter: the
// top-left quadrant reads 0% coverage across x 0–42%, y 0–37% in both cuts, and
// the row at y 38% is if anything CLEARER in the new one (68/62/57 against
// 90/85/80). The percentages below stand on measurement, not on assumption.
//
// The cutout is genuinely transparent: the alpha channel is 52% clear, 48%
// opaque and only 0.4% in between, and that fraction is edge antialiasing rather
// than a glow. That is what lets it sit directly on the pink wash. An asset with
// a baked backdrop would need a plate behind it and would stop being the same
// design, so keep any replacement cut the same way.

const CARDS: {
  app: string;
  label: string;
  figure: string;
  /** Only where a status is genuinely the point. A pill on both would turn an
   *  illustration into a dashboard. */
  status: string | null;
  /** Position inside the artwork's clear top-left region. */
  place: string;
}[] = [
  {
    app: 'bookings',
    label: 'Bookings',
    figure: '6 today',
    status: null,
    place: 'top-0 left-0 w-[40%]',
  },
  {
    app: 'invoices',
    label: 'Invoices',
    figure: '$1,250',
    status: 'Paid',
    place: 'top-[16%] left-[10%] w-[38%]',
  },
];

export function ProductGlimpse() {
  return (
    <div aria-hidden className="relative mt-8 hidden sm:block">
      <PigglesMascot
        pose="desk"
        // She IS the panel here — the column decides her width, not one of the
        // four fixed sizes. `sizes` is required with `fill` for that reason:
        // sized by the column, not by the viewport, since the panel is roughly
        // half of a 72rem shell at `lg` and full width below it.
        size="fill"
        sizes="(min-width: 1024px) 38rem, 100vw"
      />

      {CARDS.map((card) => (
        // `data-app` repoints `--color-module` for this card via the bridge in
        // @piggles/brand — the same attribute the console's rail uses, so these
        // read as the apps they name.
        <div
          key={card.app}
          data-app={card.app}
          className={`rounded-box bg-base-100 border-base-300 absolute flex items-center gap-2 border p-2.5 ${card.place}`}
        >
          <span className="bg-module h-7 w-1 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            {/* 12px and 14px — the one place in Piggles below the 16px body
                floor, and legitimately so: DESIGN.md reserves the small sizes
                for captions, and this whole block is `aria-hidden` decoration
                rather than text anybody is asked to read. Anything larger does
                not fit the artwork's clear region without covering her. */}
            <p className="text-module text-xs font-bold">{card.label}</p>
            <p className="truncate text-sm font-bold">{card.figure}</p>
          </div>
          {card.status ? (
            <Badge color="success" variant="soft" size="sm">
              {card.status}
            </Badge>
          ) : null}
        </div>
      ))}
    </div>
  );
}
