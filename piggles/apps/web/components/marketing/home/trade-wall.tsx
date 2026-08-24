import { PigglesMascot } from '@piggles/mascot/react';
import { MASCOT_POSES, type MascotPoseId } from '@piggles/mascot';
import type { PigglesGroup } from '@piggles/brand';

// ── 2 · Whatever ──────────────────────────────────────────────────────────────
//
// The one section with no panel under it. It wants air rather than a container,
// and it sits directly above the dark turn — so the open ground is also what
// gives that panel its entrance. That decision is what makes this the right
// section to run a full-bleed wall in: nothing has to be cut into a panel.
//
// ── IT WAS A LIST OF WORDS, AND WORDS ARE THE SLOW WAY TO DO THIS ───────────
//
// The section's job is RECOGNITION — it is the honest substitute DESIGN.md §10
// names for a logo wall, letting a florist recognise herself without anybody
// claiming she has already signed up. Reading "A barber." is slower than seeing
// one, and this was also the only section on the page with no picture in it,
// sitting between the film and the dark turn. Batch 07 is eleven trades drawn
// for exactly this: the same character, the same apron, eleven jobs.
//
// ── SIZING IS ITS OWN PROBLEM, AND IT IS BELOW ─────────────────────────────
//
// Batch 07 is not uniformly framed: aspect ratios run 0.998 (`workshop`) to
// 1.422 (`supplier`), and how much of a frame Piggles occupies runs 0.439
// (`shed`) to 0.779 (`supplier`). With eleven scenes on screen together that
// spread is the whole difficulty of this section — see `scene()` below.
//
// ── HUES ───────────────────────────────────────────────────────────────────
//
// Five group hues over eleven trades, arranged so no two adjacent cards in a
// lane share one AND the last does not match the first — the lane loops, so the
// wrap is an adjacency too. Not the brand pink: it is the CTA color on this
// page and a label wearing it competes with the button.
interface Trade {
  pose: MascotPoseId;
  word: string;
  group: PigglesGroup;
}

export const TRADES: Trade[] = [
  { pose: 'bakery', word: 'A bakery.', group: 'sell' },
  { pose: 'barber', word: 'A barber.', group: 'people' },
  { pose: 'potter', word: 'A potter.', group: 'run' },
  { pose: 'garage', word: 'A garage.', group: 'web' },
  { pose: 'market-stall', word: 'A market stall.', group: 'money' },
  { pose: 'salon', word: 'A salon.', group: 'run' },
  { pose: 'tailor', word: 'A tailor.', group: 'sell' },
  { pose: 'art-studio', word: 'A studio.', group: 'people' },
  { pose: 'workshop', word: 'A workshop.', group: 'web' },
  { pose: 'supplier', word: 'A supplier.', group: 'money' },
  { pose: 'shed', word: 'A shed.', group: 'run' },
];

// ── HOW BIG A SCENE IS, AND WHY IT IS NEITHER OF THE OBVIOUS ANSWERS ────────
//
// There are two defensible ways to size eleven scenes in eleven cards and they
// disagree, so this splits the difference on purpose.
//
//   Normalise the CHARACTER — <PigglesMascot size="md"> — and Piggles is exactly
//   the same height in all eleven. It is the mathematically correct answer and
//   it looks wrong, because nobody reads the pig: they read the card. A potter
//   at a wheel is a compact composition and fills 224px of a 350px card; a
//   garage is a wide one and wants 416px. Same pig, and the potter card reads as
//   half empty next to a garage that overflows.
//
//   Normalise the SCENE — every image the card's width — and every card is
//   equally full, but the pig then swings from 131px in the garage to 246px in
//   the potter. At that size she stops being a character in a shop and becomes a
//   close-up, and the wall stops looking like one character in eleven jobs.
//
// So: the midpoint of the two. Each scene renders half way between the width
// that equalises the character and the width that fills the card. Measured on
// screen against both extremes — the extremes are each visibly wrong in their
// own direction and this is not.
//
// It is COMPUTED from the catalog rather than eleven hand-tuned numbers, which
// is what keeps it honest when the art is re-cut: `subject` and the aspect ratio
// are the two things that decide how pig-dominant a scene is, the ingest
// measures both, and a new batch re-tunes this with no edit here.
//
// Quantised onto a ladder of literal percentage classes for the same reason
// <PigglesMascot> quantises its widths: Tailwind scans source TEXT, so a
// computed `w-[${n}%]` generates no class at all and the scene silently falls
// back to its container. Percentages rather than pixels so it survives a card
// that is 350px on one screen and 420px on another.
const CARD_REF = 350;
const CHARACTER_TARGET = 152;
const SCENE_STEPS = [
  { pct: 80, w: 'w-[80%]' },
  { pct: 85, w: 'w-[85%]' },
  { pct: 90, w: 'w-[90%]' },
  { pct: 95, w: 'w-[95%]' },
  { pct: 100, w: 'w-[100%]' },
  { pct: 105, w: 'w-[105%]' },
  { pct: 110, w: 'w-[110%]' },
];

function scene(pose: MascotPoseId) {
  const art = MASCOT_POSES[pose];
  // The width that would put her at CHARACTER_TARGET — the component's own
  // arithmetic, repeated here because we need the number rather than the class.
  const even = (CHARACTER_TARGET / art.subject) * (art.width / art.height);
  const wanted = ((even + CARD_REF) / 2 / CARD_REF) * 100;
  let step = SCENE_STEPS[0]!;
  for (const s of SCENE_STEPS) {
    if (Math.abs(s.pct - wanted) < Math.abs(step.pct - wanted)) step = s;
  }
  // `sizes` is a plain string, so it is NOT quantised — it states the real
  // rendered width at each breakpoint. A `sizes` that disagrees with the
  // rendered width is invisible: the image looks right and arrives
  // under-resolved. Card is ~CARD_REF from `lg` and 74vw below it.
  return {
    width: step.w,
    sizes: `(min-width: 1024px) ${Math.round((CARD_REF * step.pct) / 100)}px, ${Math.round((74 * step.pct) / 100)}vw`,
  };
}

/** The cards are CONTENT-HEIGHT on purpose. A fixed aspect ratio would leave a
 *  pocket of empty panel above every scene shorter than the tallest one, and
 *  the ragged rhythm a wall of cards wants is already sitting in the artwork.
 *  Taking the height from the art gets that variation for free and leaves no
 *  hole anywhere.
 *
 *  The wall and floor are `.trade-card` in globals.css, derived from this
 *  card's `data-group` hue. No border: the two tones already separate the card
 *  from the ground, and a hairline on top of them is a second answer to a
 *  question that has one. */
function TradeCard({ trade }: { trade: Trade }) {
  const { width, sizes } = scene(trade.pose);
  return (
    <figure
      data-group={trade.group}
      className="trade-card rounded-section flex w-[74vw] shrink-0 snap-center flex-col overflow-hidden shadow sm:w-[46vw] lg:w-auto lg:shrink"
    >
      <figcaption className="ink-module font-heading px-5 pt-5 text-xl font-black sm:text-2xl lg:px-6 lg:pt-6">
        {trade.word}
      </figcaption>
      {/* No bottom padding, and the scene sits on the card's bottom edge: every
          cut in the batch is anchored on a counter, bench or table that runs
          most of its width, so putting that edge ON the card's edge — and on
          the floor the card draws there — is what makes her stand IN the card
          rather than float on it.

          `self-center` rather than a centring margin, because the widest scenes
          are OVER 100% and are meant to crop. An auto margin resolves to zero
          once the box is wider than its container, so the overflow would go
          entirely to one side and a garage would sit visibly off-centre; cross-
          axis centring in a column flex overflows both edges evenly. */}
      <div className={`mt-4 self-center ${width}`}>
        <PigglesMascot pose={trade.pose} size="fill" sizes={sizes} />
      </div>
    </figure>
  );
}

/** One column: two copies of the same cards, travelling exactly one copy's
 *  height so the second arrives where the first began.
 *
 *  `lg:self-start` IS LOAD-BEARING. The two lanes hold different numbers of
 *  cards, and as grid items of a fixed-height wall they are both sized to the
 *  TALLER one's row. The short lane then stretches, and a grid distributes that
 *  slack between its rows — which are the two copies. The visible symptom was a
 *  ~390px hole between the last card of one copy and the first of the next, in
 *  the right-hand column only; the invisible one is worse, because a lane taller
 *  than its content means -50% is no longer one copy and the loop drifts. Both
 *  vanish when the lane stays content-height.
 *
 *  THE GAP BELONGS TO THE COPY, NOT TO THE LANE, and this is the second half of
 *  the same arithmetic. With `gap` on the lane its height is `2C + gap`, so a -50%
 *  translation moves `C + gap/2` — half a gap short of where the next copy
 *  starts, and the wall visibly jumps once every cycle. Giving each copy a
 *  trailing `pb` equal to its internal gap makes a copy `C + gap` tall and the
 *  lane exactly twice that, so -50% is precisely one copy. The lane itself must
 *  therefore carry NO gap. */
export function TradeLane({ trades, down = false }: { trades: Trade[]; down?: boolean }) {
  return (
    <div className={`trade-lane contents lg:grid lg:self-start ${down ? 'trade-lane-down' : ''}`}>
      {[0, 1].map((copy) => (
        <div
          key={copy}
          // The duplicate exists to make the loop seamless and says
          // nothing new — eleven trades are announced once, not twice.
          // It is also hidden outright below `lg`, where the wall is a
          // horizontal row and there is no loop to be seamless.
          aria-hidden={copy === 1}
          className={`${copy === 1 ? 'hidden' : 'contents'} lg:grid lg:content-start lg:gap-3.5 lg:pb-3.5`}
        >
          {trades.map((trade) => (
            <TradeCard key={trade.pose} trade={trade} />
          ))}
        </div>
      ))}
    </div>
  );
}
