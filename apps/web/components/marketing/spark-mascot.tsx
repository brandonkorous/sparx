'use client';

import { useEffect, useState } from 'react';

/**
 * SparkMascot — the sparx "spark" brand character.
 *
 * The body is spark.svg's silhouette. The face is intentionally NOT in the
 * source SVG (it's left faceless on purpose) so it can be a separate,
 * animatable layer — which this component draws and animates: a gentle idle
 * bob + blink, plus an optional expression `cycle` for hero moments.
 *
 * Reuse it anywhere the brand wants a beat of personality by passing a single
 * `expression` — e.g. empty states (`asleep`), success toasts (`excited`),
 * error screens (`sad`). For dark/indigo backgrounds use the default
 * `tone="white"`; for light backgrounds use `tone="indigo"` so the face stays
 * legible. Motion lives in marketing.css (`.spark-mascot*`) and honours
 * prefers-reduced-motion; the `cycle` timer also pauses under reduced motion.
 */

// Body silhouette: the FULL images/SVG/spark.svg path (outer + inner subpaths).
// With an even-odd fill the inner subpath carves out the centre, so this renders
// as the brand's OUTLINED, HOLLOW star — the middle is open and shows the
// background through it, exactly like the source mark (it is NOT a solid blob).
const BODY_PATH =
  'M152.23,120.4l1.73-3.16,6.45-11.87,5.86-11.09L218.99,0c-16.14,10.34-30.22,21.03-44.98,32.22l-63.12,47.84c-.8.61-2.27,1.44-3.18,1.84l-.14-1.17-.06-.91-.05-.75-.09-1.63.05-6.58v-7.17s-.08-5.81-.08-5.81l-.38-13.49c-1,1.09-1.98,2.59-2.76,4.15l-6.56,13.16-21.84,45.65-4.76,9.95L0,152.73l45.74,31.87c2.36,1.64,3.41,3.56,3.05,6.14l-1.45,23.97-.42,10.52-1.5,17.55-.24,12.56c5.53-2.85,8.43-5.52,12.26-8.76l4.82-4.07,26.11-21.96,6.41-5.35,7.02-5.6,7.17,19.34c1.13,3.05,1.96,6.33,3.62,9.27l3.32-9.52,5.67-16.98,5.02-15.13,67.39-27.04-43.93-42.12,2.16-7.03ZM66.82,218.17c-1.8,1.73-3.96,3.76-6.1,5l.38-5.21.74-3.22.61-3.97.44-3.12,3.27-28.96-7.12-5.41-22.63-17.2-3.71-2.81,6.75-2.78,36.94-15.96,4.34-6.81,6.45-10.74,5.08-8.47,2.75,10.94,51.85-42.33c5.42-4.43,9.65-8.64,16.97-12.75-6.87,14.94-14.89,28.89-22.53,43.27l-3.14,5.9-5.85,11.25-3.73,8.8,33.68,31.25-34.3,13.33c-11.61,4.51-22.37,10.02-32.4,16.57-4.59,3-9.24,6.15-13.21,9.8l-6.69,6.15Z';

// ── FACE ALIGNMENT — read before touching ─────────────────────────────────
// The face is NOT in spark.svg; it is drawn here so it can move. These numbers
// are tuned to spark.svg's interior (native viewBox 0 0 218.99 255.34) and
// verified on the live indigo hero. Do NOT eyeball-nudge them, and re-check
// them if BODY_PATH ever changes.
//
//   • The "head" lobe (the broad area that reads as a face) sits just LEFT of
//     geometric centre — x ≈ 103, not 109 — because the body mass leans left
//     under the tall up-right spike.
//   • Eye baseline cy = 150 is ~59% down the 255-tall body, on the fullest
//     part of the lobe. Lower and the smile crowds the bottom point; higher
//     and the eyes climb onto the narrowing spike.
//   • The eyes flank the lobe centre with a 34u gap (cx 86 / 120). Upright
//     ovals (ry 8.5 > rx 6) read friendly rather than bug-eyed.
//   • The mouth shares the lobe centre (x ≈ 103) and sits ~22u below the eyes.
const EYES = { lx: 86, rx: 120, cy: 150, rxv: 6, ryv: 8.5 } as const;

// Now that the body is an OUTLINE, the face is drawn a touch smaller than the
// hollow so it sits inside the stroke without crowding the inner edges. The
// whole face layer is scaled around the face centre (cx/cy), so the EYES anchor
// above stays the single source of truth for placement.
const FACE = { scale: 0.82, cx: 103, cy: 158 } as const;

export type SparkExpression =
  | 'neutral'
  | 'happy'
  | 'wink'
  | 'excited'
  | 'content'
  | 'surprised'
  | 'sad'
  | 'asleep';

// Each face = the two eyes' vertical scale (1 = open, 0.1 ≈ closed) + the mouth
// path. Every mouth `d` is anchored to the lobe centre (x ≈ 103, y ≈ 168–178)
// so it always lines up under the eyes. `mouthFill` closes an open "o" mouth
// (excited / surprised); otherwise the mouth is a stroked line.
const FACES: Record<
  SparkExpression,
  { mouth: string; lY: number; rY: number; mouthFill: boolean }
> = {
  neutral: { mouth: 'M90,172 q13,10 26,0', lY: 1, rY: 1, mouthFill: false },
  happy: { mouth: 'M86,170 q17,17 34,0', lY: 0.7, rY: 0.7, mouthFill: false },
  wink: { mouth: 'M89,171 q14,12 28,0', lY: 0.12, rY: 1, mouthFill: false },
  excited: { mouth: 'M92,168 a11,11 0 0 0 22,0 z', lY: 1.15, rY: 1.15, mouthFill: true },
  content: { mouth: 'M92,173 q11,7 22,0', lY: 0.5, rY: 0.5, mouthFill: false },
  surprised: {
    mouth: 'M97,170 a6,6 0 1 0 12,0 a6,6 0 1 0 -12,0 z',
    lY: 1.25,
    rY: 1.25,
    mouthFill: true,
  },
  sad: { mouth: 'M90,178 q13,-9 26,0', lY: 0.92, rY: 0.92, mouthFill: false },
  asleep: { mouth: 'M94,174 q9,4 18,0', lY: 0.1, rY: 0.1, mouthFill: false },
};

const TONES = {
  // The body is an OUTLINED (hollow) star, so the face sits over the open centre
  // rather than on a fill. The face is drawn in the SAME colour as the outline
  // so the whole mark is one consistent monochrome stroke on any surface: pure
  // white linework on the indigo hero, brand indigo on a light surface. No drop
  // shadow — the mark is flat linework so it sits flush with the rest of the UI,
  // which carries no shadows of its own.
  white: { ink: '#ffffff' },
  indigo: { ink: 'var(--color-primary, #6366f1)' },
} as const;

export function SparkMascot({
  expression = 'happy',
  cycle,
  intervalMs = 2400,
  size = 168,
  tone = 'white',
  bob = true,
  blink = true,
  title = 'spark',
  className,
}: {
  expression?: SparkExpression;
  /** Auto-rotate through these expressions (hero use). Pauses under reduced motion. */
  cycle?: SparkExpression[];
  intervalMs?: number;
  size?: number;
  tone?: keyof typeof TONES;
  /** Whole-body float. Off in the hero so it doesn't pull focus from the
   *  rotating headline; the face stays alive on its own. */
  bob?: boolean;
  /** Eye blink — keeps the face living even when the body is still. */
  blink?: boolean;
  title?: string;
  className?: string;
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!cycle || cycle.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => setStep((n) => n + 1), intervalMs);
    return () => clearInterval(timer);
  }, [cycle, intervalMs]);

  const active: SparkExpression = cycle?.length
    ? (cycle[step % cycle.length] ?? expression)
    : expression;
  const face = FACES[active];
  const palette = TONES[tone];

  return (
    <span
      className={['spark-mascot', bob ? 'spark-mascot--bob' : '', className]
        .filter(Boolean)
        .join(' ')}
      style={{ width: size }}
    >
      <svg
        viewBox="-14 -12 247 292"
        width={size}
        role="img"
        aria-label={title}
        style={{ width: '100%', height: 'auto', overflow: 'visible' }}
      >
        <path d={BODY_PATH} fill={palette.ink} fillRule="evenodd" />
        {/* Face layer, scaled down a touch so it sits inside the hollow outline.
            The eyes scale around their OWN centre (transform-box: fill-box in
            CSS) so blink + expression changes happen in place. */}
        <g
          transform={`translate(${FACE.cx} ${FACE.cy}) scale(${FACE.scale}) translate(${-FACE.cx} ${-FACE.cy})`}
        >
          <g
            className={['spark-mascot__eyes', blink ? 'spark-mascot__eyes--blink' : '']
              .filter(Boolean)
              .join(' ')}
          >
            <ellipse
              className="spark-mascot__eye"
              cx={EYES.lx}
              cy={EYES.cy}
              rx={EYES.rxv}
              ry={EYES.ryv}
              fill={palette.ink}
              style={{ transform: `scaleY(${face.lY})` }}
            />
            <ellipse
              className="spark-mascot__eye"
              cx={EYES.rx}
              cy={EYES.cy}
              rx={EYES.rxv}
              ry={EYES.ryv}
              fill={palette.ink}
              style={{ transform: `scaleY(${face.rY})` }}
            />
          </g>
          <path
            className="spark-mascot__mouth"
            d={face.mouth}
            fill={face.mouthFill ? palette.ink : 'none'}
            stroke={palette.ink}
            strokeWidth={5.5}
            strokeLinecap="round"
          />
        </g>
      </svg>
    </span>
  );
}
