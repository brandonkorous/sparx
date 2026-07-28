'use client';

// The platform badge — a social network's own mark, in its own colour.
//
// This is the ONE sanctioned place in the workbench for hard-coded colour, cleared with
// Brandon on 2026-07-28. The rule it steps around (RULE #1: colour comes from tokens, so
// it can answer light/dark) exists to keep OUR surfaces coherent. These are not our
// surfaces: Pinterest red and Facebook blue belong to Pinterest and Facebook, mean
// nothing else, and are the fastest thing on screen to recognise — which is the entire
// job of a badge sitting at 14px under an account's face. A token cannot express them.
//
// Two consequences, both deliberate:
//
//   * The glyph is always WHITE on the brand circle, not an ink token. A fixed foreground
//     on a fixed background is theme-independent by construction — there is no light/dark
//     question to answer, so there is no token to reach for.
//   * The three brands whose colour IS black (X, TikTok, Threads) let their circle melt
//     into a dark theme's surface. That is fine and not worth a workaround: the white
//     glyph carries the recognition, and the caller's `ring-base-100` keeps the badge
//     separated from the avatar it sits on.
//
// Glyphs come from lucide where lucide has them. The four it dropped are drawn here in
// the same 24-grid, 2px-stroke idiom so a row of badges looks like one set rather than
// four traced logos and five outlines. They are simplified on purpose — at badge size,
// silhouette is all that survives, and a faithful trace of a wordmark would only add
// bytes and a trademark question.

import type { ReactElement, SVGProps } from 'react';
import { Facebook, Instagram, Linkedin, Store, Youtube, type LucideIcon } from 'lucide-react';

/** Each platform's own colour. Not tokens, and not eligible to become tokens — see above. */
const BRAND_HEX: Record<string, string> = {
  facebook_page: '#1877F2',
  instagram: '#E4405F',
  threads: '#000000',
  linkedin: '#0A66C2',
  x: '#000000',
  tiktok: '#000000',
  pinterest: '#E60023',
  youtube: '#FF0000',
  google_business: '#4285F4',
};

/** Shared geometry so a hand-drawn glyph sits at the same weight as a lucide one. */
function Glyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

/** Pinterest: the stem and the bowl of its P. */
function PinterestGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M10 21l2.2-7.6" />
      <path d="M12.4 13.6a4.6 4.6 0 1 1 4.1-4.6c0 2.7-1.7 4.6-3.8 4.6" />
    </Glyph>
  );
}

/** TikTok: the quaver — note head, stem, flag. */
function TikTokGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M9.5 12.5a3.5 3.5 0 1 0 3.5 3.5V4" />
      <path d="M13 4.2c.6 2.4 2.5 3.9 5 3.9" />
    </Glyph>
  );
}

/** Threads: the open loop and its hook. */
function ThreadsGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M12 21c-4.4 0-7.4-3.4-7.4-9S7.6 3 12 3c3.3 0 5.6 1.6 6.4 4.2" />
      <path d="M11 16.6c0-1.4 1.4-2.2 3.4-2.2 2.5 0 4.1 1.2 4.1 3.1 0 1.9-1.5 3.1-3.5 3.1" />
    </Glyph>
  );
}

/** X: the mark it renamed itself to. */
function XGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M5.5 5.5l13 13" />
      <path d="M18.5 5.5l-13 13" />
    </Glyph>
  );
}

type GlyphComponent = LucideIcon | ((props: SVGProps<SVGSVGElement>) => ReactElement);

const GLYPH: Record<string, GlyphComponent> = {
  facebook_page: Facebook,
  instagram: Instagram,
  threads: ThreadsGlyph,
  linkedin: Linkedin,
  x: XGlyph,
  tiktok: TikTokGlyph,
  pinterest: PinterestGlyph,
  youtube: Youtube,
  // Google Business Profile has no mark of its own — it is a listing, not a network — so
  // it wears a storefront, which is what the listing actually is.
  google_business: Store,
};

/** Whether this platform has a mark to draw. Callers that lay out around the badge ask
 *  first, so an unknown platform collapses the space instead of reserving a hole in it. */
export function hasPlatformMark(platform: string): boolean {
  return platform in GLYPH;
}

/**
 * One platform's badge. `className` sets the size (and anything else the caller needs);
 * everything inside scales to it, so a 14px badge and a 24px one are the same drawing.
 *
 * `platform` is a plain string because that is what the API hands back — the workbench
 * deliberately does not narrow it. An unrecognised one renders NOTHING rather than a
 * guess or a mystery grey disc: a badge that cannot say which network this is has no job.
 *
 * Decorative by default: it is nearly always paired with the account name in the same
 * row, and a screen reader announcing "Pinterest" twice per destination is noise. Pass
 * `label` where the badge stands alone.
 */
export function PlatformMark({
  platform,
  className = 'size-4',
  label,
}: {
  platform: string;
  className?: string;
  label?: string;
}) {
  const Icon = GLYPH[platform];
  if (!Icon) return null;
  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {/* The brand fill rides an SVG rather than a background utility so the one place
          that carries a hard-coded colour is this file, not a Tailwind arbitrary value
          scattered through the surfaces. */}
      <svg viewBox="0 0 24 24" className="absolute inset-0 size-full">
        <circle cx="12" cy="12" r="12" fill={BRAND_HEX[platform]} />
      </svg>
      <Icon className="relative size-[62%] text-white" strokeWidth={2.5} aria-hidden />
    </span>
  );
}
