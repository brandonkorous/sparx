import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import {
  BRAND,
  ICON_BODY_PATH,
  ICON_NOSTRIL_PATHS,
  ICON_SNOUT_OPACITY,
  ICON_SNOUT_PATH,
  ICON_VIEWBOX,
  WORDMARK_ASPECT,
  WORDMARK_DOT_PATH,
  WORDMARK_LETTER_PATHS,
  WORDMARK_VIEWBOX,
} from './index';

// The social card for every Piggles page, in all three apps.
//
// ── WHY THIS LIVES IN @piggles/brand ────────────────────────────────────────
//
// It started as apps/web/lib/og.tsx, which was right while marketing was the only
// app with cards. It is not right now that account and workbench have them too: a
// card is the most-shared single artefact this brand has, and three copies of it
// is three chances for the wordmark, the rule, the warm ground or the strapline to
// drift apart — on the one surface where drift is most visible and least fixable,
// because a card that has been posted somewhere stays posted.
//
// So it sits next to the marks and the tokens it is made of, and the three apps
// import it. That is the same single-point-of-change argument as the design
// tokens: change the card here and every app follows with no edit at any route.
//
// It takes a POSE OBJECT rather than a pose id, which is what keeps this package a
// leaf. @piggles/mascot already depends on nothing; if brand imported its catalog,
// the two would be circular in spirit if not in fact — the character would become
// part of the brand's own definition rather than a thing rendered on it. Call sites
// resolve the pose with the mascot package's own vocabulary and hand the result
// over:
//
//     renderOg({ title: 'Bookings', pose: mascotForApp('bookings') })
//     renderOg({ title: 'Piggles',  pose: resolveIntent('hero') })
//
// ── LITERAL COLOR AND INLINE STYLE ARE CORRECT HERE, AND ONLY HERE ─────────
//
// satori resolves neither CSS custom properties nor class names — it renders a
// small subset of flexbox from inline `style` objects and nothing else. So an OG
// route is the sanctioned exception to BOTH the no-literal-color rule and the
// no-inline-`style` rule (root CLAUDE.md RULE #1; `sparx/apps/web/lib/og-*.tsx` is
// the same shape for sparx). It is an exception because there is no alternative,
// not because rendering an image is special.
//
// Colors still come from the `BRAND` / `GROUP_HEX` constants beside this file
// rather than being typed in, so a brand change lands in one place and every card
// follows. **Never write a hex literal in this file.**
//
// ── WHY THIS IS LIGHT AND SPARX'S IS NEAR-BLACK ─────────────────────────────
//
// sparx renders its cards on `#0A0A0A`: confident, technical, cold. Piggles is
// warm off-white with dark ink and one pink. Two brands competing for the same
// customer must not produce cards that look like the same company, and the card is
// the most-shared single artefact either brand has — so this is the one place
// where "looks different from sparx" is a functional requirement rather than a
// preference.
//
// The mark and wordmark are the REAL vector lockups, not type set in a fallback
// font. satori renders `<svg>`/`<path>` provided the root element has an explicit
// `display`, which the wrapping `<div>` supplies.

export const OG_SIZE = { width: 1200, height: 630 } as const;

// satori needs a font it has; Fredoka is not loaded at the edge and shipping the
// binary for one image is not worth the weight. The lockup carries the brand —
// the headline is set in the system stack on purpose.
const SYSTEM_FONT = 'system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif';

/** Outer padding, and the left edge everything on the card lines up to. */
const PAD = 72;

/** The mascot's column, and how far it sits in from the right edge. Everything
 *  else — headline, subtitle, footer rule — stops short of it, which is what
 *  makes her a column rather than a collision. */
const MASCOT_COLUMN = 430;
const MASCOT_INSET = 28;

/** Clear space between the text and her column.
 *
 *  Load-bearing, and it was zero by accident: TEXT_WIDTH subtracted one PAD while
 *  the artwork was inset by half of one, so the column began 36px INSIDE where the
 *  text ended. The art is absolutely positioned and paints last, so the wider
 *  scene poses drew a market stall straight over `meetpiggles.com`. Both edges are
 *  derived from the same three numbers now, so they cannot disagree again. */
const GUTTER = 24;

/** How tall PIGGLES HERSELF is on the card, before either cap below applies.
 *
 *  Not the image height, and the difference is the whole reason this is not a
 *  width. The poses are framed nothing like each other — `front-counter` is 93%
 *  character, `shed` is 44%, and the aspect ratios run 0.53 to 1.49. Sized to one
 *  width, the pig on one card comes out twice the pig on the next, in the same
 *  slot, for no reason a person scrolling a feed could see. So the card solves for
 *  her instead, exactly as <PigglesMascot> does on screen. */
const CHARACTER_PX = 300;

/** Tallest the artwork may be drawn.
 *
 *  Two jobs. It stops a portrait pose (`download` is 0.53 wide) from solving to
 *  790px on a 630px card, and it is what leaves clear ground above and below her
 *  once she is CENTRED — 500 against 630 keeps at least 65px of card on each side,
 *  so she reads as sitting in the column rather than filling it.
 *
 *  She used to bleed 46px off the bottom edge, which let a wide scene be cropped
 *  rather than shrunk. Centring gives that up on purpose: a figure cut by the
 *  frame reads as a mistake at thumbnail size, where most of these are seen, and
 *  the crop was buying scale on the four scene poses at the cost of every other
 *  card looking like it had slipped. */
const MAX_ART_HEIGHT = 500;

/** The text column — the width the headline, subtitle and footer rule share.
 *  Everything to the left of the gutter, and nothing to the right of it. */
const TEXT_WIDTH = OG_SIZE.width - PAD - GUTTER - MASCOT_COLUMN - MASCOT_INSET;

/** Three tiers, because the two kinds of card here are very different lengths.
 *  Every app page's title is its LABEL — one or two words — and one word set at
 *  the sentence size leaves the card looking like the headline failed to load.
 *  Sizing by length rather than by page type keeps it one code path. */
function titleSize(title: string): number {
  if (title.length <= 16) return 100;
  return title.length > 46 ? 58 : 74;
}

/** A pose, structurally. `MASCOT_POSES[id]`, `mascotForApp(id)` and
 *  `resolveIntent(i)` from @piggles/mascot all satisfy it — see the note above on
 *  why this is a shape rather than an import. */
export interface OgPose {
  /** Path to the PNG copy, relative to the app's `public/`. */
  og: string;
  width: number;
  height: number;
  /** Fraction of `height` the character herself occupies. */
  subject: number;
}

/** Read once per pose per build. These routes are prerendered, so this runs at
 *  `next build` — a handful of files, each read a single time however many cards
 *  name the pose. */
const encoded = new Map<string, string>();

/** Where `public/` sits, from wherever this happens to be running.
 *
 *  TWO shapes, because there are two moments this can run in and they do not agree
 *  about the working directory:
 *
 *   1. `next build`, which is when every OG route here renders. cwd is the app's
 *      own directory, so `public/` is right there.
 *   2. The container, if a card is ever served at request time instead. The
 *      Dockerfiles set `WORKDIR /app` and copy public/ to
 *      `piggles/apps/<app>/public` — `outputFileTracingRoot` is the repo root, so
 *      the standalone tree keeps the repo's shape and so does this path.
 *
 *  Only (1) happens today. (2) is four lines that stop a future `force-dynamic`
 *  OG route from failing in production having passed every check locally, which is
 *  the exact failure mode this codebase has been bitten by before. */
function publicDirs(): string[] {
  const cwd = process.cwd();
  return [
    join(cwd, 'public'),
    ...['web', 'account', 'workbench'].map((app) => join(cwd, 'piggles', 'apps', app, 'public')),
  ];
}

function mascotDataUri(pose: OgPose): string {
  const cached = encoded.get(pose.og);
  if (cached) return cached;

  const tried = publicDirs();
  let bytes: Buffer | undefined;
  for (const dir of tried) {
    try {
      bytes = readFileSync(join(dir, pose.og));
      break;
    } catch {
      // Next candidate.
    }
  }

  if (!bytes) {
    throw new Error(
      `OG mascot missing: ${pose.og} (looked in ${tried.join(', ')}). ` +
        `Run the ingest — pnpm --filter @piggles/mascot ingest — which generates ` +
        `public/mascot/og/ alongside the WebP the browser gets.`
    );
  }

  const uri = `data:image/png;base64,${bytes.toString('base64')}`;
  encoded.set(pose.og, uri);
  return uri;
}

/** Solve for the drawn size that puts HER at `CHARACTER_PX`, then let the column
 *  and the card height veto it. The vetoes are why the two knobs above can be set
 *  from what looks right rather than from the worst-case pose. */
function artSize(pose: OgPose): { width: number; height: number } {
  const ratio = pose.width / pose.height;
  const wanted = (CHARACTER_PX / pose.subject) * ratio;
  const shrink = Math.min(1, MASCOT_COLUMN / wanted, MAX_ART_HEIGHT / (wanted / ratio));

  return {
    width: Math.round(wanted * shrink),
    height: Math.round((wanted / ratio) * shrink),
  };
}

/** The mark, at the size a brand lockup has to be to read as one.
 *
 *  44 for a while, which is a NAV size — right on a 64px-tall header where it is
 *  the only thing on the row, and much too quiet on a 1200×630 card carrying a
 *  100px headline. It has to survive being a thumbnail in a feed, so it is now
 *  roughly two thirds the cap height of the largest headline rather than a third. */
function Lockup({ height = 68 }: { height?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width={height} height={height} viewBox={ICON_VIEWBOX} xmlns="http://www.w3.org/2000/svg">
        <path d={ICON_BODY_PATH} fill={BRAND.primary} />
        <path d={ICON_SNOUT_PATH} fill={BRAND.primary} opacity={ICON_SNOUT_OPACITY} />
        {ICON_NOSTRIL_PATHS.map((d) => (
          <path key={d} d={d} fill={BRAND.primary} />
        ))}
      </svg>
      <svg
        width={Math.round(height * 0.72 * WORDMARK_ASPECT)}
        height={Math.round(height * 0.72)}
        viewBox={WORDMARK_VIEWBOX}
        xmlns="http://www.w3.org/2000/svg"
      >
        {WORDMARK_LETTER_PATHS.map((d) => (
          <path key={d} d={d} fill={BRAND.ink} />
        ))}
        <path d={WORDMARK_DOT_PATH} fill={BRAND.primary} />
      </svg>
    </div>
  );
}

export function renderOg(opts: {
  /** The headline. Keep under ~70 characters — it steps down twice and no further. */
  title: string;
  /** One supporting line. Optional, and often better left off. */
  subtitle?: string;
  /** Accent for the rule and the full stop. A group hue on an app page, the brand
   *  pink everywhere else. Pass `GROUP_HEX[group]` — never a literal. */
  accent?: string;
  /** Bottom-right. Defaults to the marketing host. */
  footer?: string;
  /** Piggles, on the right. Every card has her; resolve the pose from
   *  @piggles/mascot by intent, by app, or by name where the art IS the point. */
  pose: OgPose;
}): ImageResponse {
  const { title, subtitle, accent = BRAND.primary, footer = 'meetpiggles.com', pose } = opts;

  const art = artSize(pose);

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        backgroundColor: BRAND.surfaceWarm,
        fontFamily: SYSTEM_FONT,
      }}
    >
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: `${PAD}px`,
        }}
      >
        <Lockup />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: TEXT_WIDTH }}>
          <div
            style={{
              // ONE WORD PER CHILD, and the full stop as the last of them.
              //
              // It was `<span>{title}</span>` beside the dot, which is right until
              // the headline wraps: a flex item is as wide as its LONGEST line, so
              // on a two-line title the dot lands at the end of line one's width
              // rather than after the final word — a coloured circle floating in
              // the middle of nowhere. Wrapping is now the common case, because the
              // mascot took 420px of the width the headline used to have.
              //
              // satori lays out flex and nothing else — there is no inline flow to
              // put the dot into — so the words become flex items and the dot
              // simply follows the last one. `columnGap` is the word space at that
              // point size (0.22em reads as one space against this stack), and
              // `alignItems: flex-end` is what sits it on the baseline.
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              columnGap: Math.round(titleSize(title) * 0.22),
              fontWeight: 800,
              fontSize: titleSize(title),
              letterSpacing: '-0.03em',
              lineHeight: 1.04,
              color: BRAND.ink,
            }}
          >
            {title.split(' ').map((word, i) => (
              <span key={`${word}-${String(i)}`}>{word}</span>
            ))}
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: 9999,
                backgroundColor: accent,
                marginLeft: -Math.round(titleSize(title) * 0.14),
                marginBottom: Math.round(titleSize(title) * 0.1),
              }}
            />
          </div>
          {subtitle ? (
            <span style={{ fontSize: 26, lineHeight: 1.4, color: BRAND.ink }}>{subtitle}</span>
          ) : null}
        </div>

        {/* Stops at the mascot column rather than running the full width, so the
              rule reads as the end of the text and not as a line drawn through her. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: TEXT_WIDTH,
            paddingTop: 24,
            borderTop: `3px solid ${accent}`,
          }}
        >
          <span style={{ fontSize: 17, color: BRAND.ink }}>
            Business software for people who have a business to run
          </span>
          <span style={{ fontSize: 17, color: BRAND.ink }}>{footer}</span>
        </div>
      </div>

      <img
        src={mascotDataUri(pose)}
        width={art.width}
        height={art.height}
        style={{
          position: 'absolute',
          // Centred on BOTH axes of her column — horizontally so a narrow figure
          // and a wide desk scene sit on the same axis instead of one hugging the
          // edge, vertically so every card puts her in the same place whatever
          // she is standing in. Computed rather than `top: 50%` + a transform,
          // because a number satori can add is one fewer thing to get wrong.
          right: MASCOT_INSET + Math.round((MASCOT_COLUMN - art.width) / 2),
          top: Math.round((OG_SIZE.height - art.height) / 2),
        }}
      />
    </div>,
    { ...OG_SIZE }
  );
}
