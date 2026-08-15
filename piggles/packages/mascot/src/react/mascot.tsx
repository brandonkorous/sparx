import Image from 'next/image';
import { MASCOT_POSES, type MascotPoseId } from '../catalog';
import { mascotForApp, resolveIntent, type MascotIntent } from '../intents';

// <PigglesMascot> — the one way Piggles appears on a screen.
//
// A server component: it is an image and a lookup, nothing interactive.
//
// ── WHY NOT THE DELIVERED HELPER ─────────────────────────────────────────────
//
// Each batch ships its own `PigglesCharacter.jsx`: a `<picture>` element with
// hardcoded relative paths and an untyped string id. It would render a ~90KB
// full-resolution asset at every size on every device, because a bare <img> has
// no srcset — and it would fail closed on a typo, returning `null` and leaving a
// hole nobody notices in review. `next/image` gives the responsive srcset, AVIF,
// and lazy loading for free; the typed id gives the compiler.
//
// ── SIZE IS HOW BIG *SHE* IS, NOT HOW WIDE THE IMAGE IS ──────────────────────
//
// This is the one thing in the package worth reading twice, because the obvious
// implementation is wrong and looks right until two poses sit next to each other.
//
// A named size used to set the image's WIDTH. That works while every pose frames
// the character the same way, and the poses do not: `builder` is the figure alone
// at aspect ratio 0.72, and `calendar-desk` is a table with a laptop and a
// calendar on it at 1.49. Give both the same 176px width and the pig in one comes
// out 203px tall and the pig in the other 107px — nearly double, in the same slot,
// for no reason a viewer can see. On the marketing film, where six poses cut one
// after another in the same corner, it reads as the artwork lurching about.
//
// So `sm | md | lg | xl` are CHARACTER heights, and the image width that produces
// one is arithmetic:
//
//     imageWidth = (characterHeight / pose.subject) × (pose.width / pose.height)
//
// `pose.subject` is the fraction of the artwork the character occupies, measured
// from her own pink mass by the ingest — see catalog.ts. Every pose therefore
// renders her at the same size and the furniture around her takes whatever room
// it needs, which is the correct way round: the pig is the subject and the desk
// is context.
//
// `fill` is the fifth, for the case the fixed sizes genuinely cannot express: a
// bespoke composition where she IS the panel and the column decides her width.
// It takes `sizes` as a REQUIRED prop rather than defaulting one, because the
// right answer there depends on the layout and a wrong default is invisible —
// the image looks correct and quietly downloads four times what it needed.
//
// ── WHY A LADDER AND NOT THE EXACT NUMBER ────────────────────────────────────
//
// The computed width is a per-pose number, and a per-pose number cannot become a
// Tailwind class: the class strings must be LITERAL, because Tailwind scans
// source text. A template like `w-[${n}px]` produces a class nothing generates,
// and the mascot silently falls back to `max-w-full` and fills whatever column
// she is in. That is not hypothetical; it is what shipped for an hour. (An inline
// `style` would dodge it and is banned — piggles/CLAUDE.md.)
//
// So the width is quantised onto the ladder below, every rung of it written out
// so Tailwind emits all of them. The rungs are 8px apart where the mascot
// actually lands and coarser at the extremes, which keeps the worst rounding
// under about 5% — a difference nobody can see, against the 90% difference this
// replaces.
//
// Each consuming app still needs `@source
// '../../../packages/mascot/src/**/*.{ts,tsx}'` in its globals.css, for the same
// literal-class reason.
//
// ── AND SIZE IS OFTEN TWO CHOICES ────────────────────────────────────────────
//
// `size={{ base: 'md', lg: 'lg' }}`. A mascot judged on a 1440px screen is
// routinely oversized on a phone, so the pair is computed here from one prop and
// the `sizes` hint moves with it. Setting the width at the call site instead is
// how she ends up blurry: `sizes` keeps claiming the old number, the browser
// downloads that srcset entry, and CSS stretches it.

/** Named size → how tall PIGGLES HERSELF renders, in CSS pixels.
 *
 *  The values are what the old image widths produced for a figure-only pose
 *  (ratio ~1.0, subject ~0.87), so surfaces that were tuned against those poses
 *  are unchanged and only the wide scenes move — which is the whole point. */
const CHARACTER_PX = {
  /** Inline beside a sentence — a tip, a compact empty row. */
  sm: 84,
  /** The default: an empty state inside a card or a panel. */
  md: 152,
  /** A full-page empty state, or an onboarding step. */
  lg: 250,
  /** The mascot as the subject: auth split shells, marketing sections. */
  xl: 390,
} as const;

interface WidthStep {
  px: number;
  base: string;
  atLg: string;
}

/** Every width the mascot may render at. LITERAL class strings — see above.
 *
 *  Annotated rather than `as const`: the rungs are picked at runtime, so the
 *  literal types buy nothing and widen the result to the first entry. What has to
 *  stay literal is the class STRINGS in this source, which Tailwind scans — and
 *  they do either way. */
const WIDTH_STEPS: readonly WidthStep[] = [
  { px: 64, base: 'w-16', atLg: 'lg:w-16' },
  { px: 72, base: 'w-18', atLg: 'lg:w-18' },
  { px: 80, base: 'w-20', atLg: 'lg:w-20' },
  { px: 88, base: 'w-22', atLg: 'lg:w-22' },
  { px: 96, base: 'w-24', atLg: 'lg:w-24' },
  { px: 104, base: 'w-26', atLg: 'lg:w-26' },
  { px: 112, base: 'w-28', atLg: 'lg:w-28' },
  { px: 120, base: 'w-30', atLg: 'lg:w-30' },
  { px: 128, base: 'w-32', atLg: 'lg:w-32' },
  { px: 136, base: 'w-34', atLg: 'lg:w-34' },
  { px: 144, base: 'w-36', atLg: 'lg:w-36' },
  { px: 152, base: 'w-38', atLg: 'lg:w-38' },
  { px: 160, base: 'w-40', atLg: 'lg:w-40' },
  { px: 176, base: 'w-44', atLg: 'lg:w-44' },
  { px: 192, base: 'w-48', atLg: 'lg:w-48' },
  { px: 208, base: 'w-52', atLg: 'lg:w-52' },
  { px: 224, base: 'w-56', atLg: 'lg:w-56' },
  { px: 240, base: 'w-60', atLg: 'lg:w-60' },
  { px: 256, base: 'w-64', atLg: 'lg:w-64' },
  { px: 272, base: 'w-68', atLg: 'lg:w-68' },
  { px: 288, base: 'w-72', atLg: 'lg:w-72' },
  { px: 320, base: 'w-80', atLg: 'lg:w-80' },
  { px: 352, base: 'w-88', atLg: 'lg:w-88' },
  { px: 384, base: 'w-96', atLg: 'lg:w-96' },
  { px: 416, base: 'w-104', atLg: 'lg:w-104' },
  { px: 448, base: 'w-112', atLg: 'lg:w-112' },
  { px: 512, base: 'w-128', atLg: 'lg:w-128' },
  { px: 576, base: 'w-144', atLg: 'lg:w-144' },
  { px: 640, base: 'w-160', atLg: 'lg:w-160' },
  { px: 704, base: 'w-176', atLg: 'lg:w-176' },
];

const FILL_STEP: WidthStep = { px: 0, base: 'w-full', atLg: 'lg:w-full' };

/** The rung whose width renders this pose's character closest to `target`. */
function stepFor(pose: { width: number; height: number; subject: number }, target: number) {
  const wanted = (target / pose.subject) * (pose.width / pose.height);
  let best = WIDTH_STEPS[0]!;
  for (const step of WIDTH_STEPS) {
    if (Math.abs(step.px - wanted) < Math.abs(best.px - wanted)) best = step;
  }
  return best;
}

export type MascotSize = keyof typeof CHARACTER_PX | 'fill';

/** Every size but `fill` — the ones that can be paired across a breakpoint.
 *  `fill` cannot: it is already relative to its container at every width. */
export type FixedMascotSize = Exclude<MascotSize, 'fill'>;

type Selector =
  | { pose: MascotPoseId; intent?: never; app?: never }
  | { intent: MascotIntent; pose?: never; app?: never }
  /** The empty state of a `@piggles/config` app, by its registry id. */
  | { app: string; pose?: never; intent?: never };

type Sizing =
  | { size?: FixedMascotSize | { base: FixedMascotSize; lg: FixedMascotSize }; sizes?: never }
  | { size: 'fill'; sizes: string };

export type PigglesMascotProps = Selector &
  Sizing & {
    className?: string;
    /** Defaults to `''`, because she is decorative almost everywhere — the words
     *  next to her carry the meaning. Pass real text ONLY when the artwork itself
     *  is the information, which is rare and probably means something is missing
     *  from the copy. She must never be the only indicator of a state
     *  (DESIGN.md); a success screen says so in words, and she agrees with it. */
    alt?: string;
    /** For an above-the-fold mascot only — an auth shell or a marketing hero.
     *  Everywhere else she is below the fold and should stay lazy. */
    priority?: boolean;
  };

export function PigglesMascot({
  pose,
  intent,
  app,
  size = 'md',
  sizes,
  className = '',
  alt = '',
  priority = false,
}: PigglesMascotProps) {
  const resolved = pose ? MASCOT_POSES[pose] : intent ? resolveIntent(intent) : mascotForApp(app);
  const spec = typeof size === 'string' ? { base: size, lg: size } : size;

  // Solved per pose from its own framing, then snapped to a literal rung. `fill`
  // opts out entirely: there the container decides and `sizes` is required.
  const base = spec.base === 'fill' ? FILL_STEP : stepFor(resolved, CHARACTER_PX[spec.base]);
  const wide = spec.lg === 'fill' ? FILL_STEP : stepFor(resolved, CHARACTER_PX[spec.lg]);

  return (
    <Image
      src={resolved.src}
      alt={alt}
      // The TRUE intrinsic size of the trimmed artwork, from the catalog. The
      // delivery canvases are not it — see the ingest script's header.
      width={resolved.width}
      height={resolved.height}
      // 1024px is Tailwind's `lg`, and it has to be written out because a media
      // query in a `sizes` attribute cannot reference the framework's breakpoint.
      // If the class below ever moves to another breakpoint, this moves with it.
      //
      // These are the SAME numbers as the classes below, by construction — which
      // is the point of computing both here. A `sizes` that disagrees with the
      // rendered width is invisible: the image looks right and arrives
      // under-resolved.
      sizes={
        sizes ??
        (base.px === wide.px ? `${base.px}px` : `(min-width: 1024px) ${wide.px}px, ${base.px}px`)
      }
      priority={priority}
      // `max-w-full` so a wide scene at a large size still fits a narrow phone
      // rather than pushing the page sideways.
      className={`h-auto max-w-full ${base.base} ${wide.atLg} ${className}`}
    />
  );
}
