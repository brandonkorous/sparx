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
// ── SIZE IS A NAMED CHOICE ───────────────────────────────────────────────────
//
// Not a free `width`, because the two decisions have to agree: the rendered width
// and the `sizes` hint that tells the browser which srcset entry to download. Set
// one and forget the other and you serve a 1200px master into a 96px slot. Four
// named sizes cover the real placements and keep the mascot at consistent scale
// across surfaces, which is most of what stops her looking pasted on.
//
// `fill` is the fifth, for the case the fixed widths genuinely cannot express: a
// bespoke composition where she IS the panel and the column decides her width.
// It takes `sizes` as a REQUIRED prop rather than defaulting one, because the
// right answer there depends on the layout and a wrong default is invisible —
// the image looks correct and quietly downloads four times what it needed.
//
// ── AND SIZE IS OFTEN TWO CHOICES ────────────────────────────────────────────
//
// `size={{ base: 'md', lg: 'lg' }}`. A mascot judged on a 1440px screen is
// routinely oversized on a phone — 288px is a fifth of the desktop column and
// three quarters of a 390px viewport, which turns a supporting figure into the
// section. Handling that at the call site means hand-writing `lg:w-72` next to a
// `sizes` string that still claims 176px, and the mismatch is invisible: the
// image looks right and arrives under-resolved. So the pair is computed here,
// from one prop, and stays consistent by construction.
//
// The class strings must be LITERAL — Tailwind scans source text, so a template
// like `lg:${…}` produces a class nothing generates and the mascot silently
// falls back to `max-w-full`, filling whatever column she is in. That is not
// hypothetical; it is what shipped for an hour. Each consuming app also needs
// `@source '../../../packages/mascot/src/**/*.{ts,tsx}'` in its globals.css, for
// the same reason.

const SIZES = {
  /** Inline beside a sentence — a tip, a compact empty row. */
  sm: { width: 'w-24', atLg: 'lg:w-24', px: '96px' },
  /** The default: an empty state inside a card or a panel. */
  md: { width: 'w-44', atLg: 'lg:w-44', px: '176px' },
  /** A full-page empty state, or an onboarding step. */
  lg: { width: 'w-72', atLg: 'lg:w-72', px: '288px' },
  /** The mascot as the subject: auth split shells, marketing sections. */
  xl: { width: 'w-112', atLg: 'lg:w-112', px: '448px' },
  /** She fills her container. Requires an explicit `sizes`. */
  fill: { width: 'w-full', atLg: 'lg:w-full', px: '' },
} as const;

export type MascotSize = keyof typeof SIZES;

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
  const base = SIZES[spec.base];
  const wide = SIZES[spec.lg];

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
      sizes={
        sizes ?? (spec.base === spec.lg ? base.px : `(min-width: 1024px) ${wide.px}, ${base.px}`)
      }
      priority={priority}
      // `max-w-full` so the two large sizes still fit a narrow phone rather than
      // pushing the page sideways.
      className={`h-auto max-w-full ${base.width} ${wide.atLg} ${className}`}
    />
  );
}
