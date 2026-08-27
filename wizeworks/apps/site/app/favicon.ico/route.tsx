// GET /favicon.ico — the tenant's own mark. Never a platform mark.
//
// Every browser requests this path by convention, whether or not the document
// declares an icon. That convention is why the platform's mark used to end up in
// the tab of every tenant who had not uploaded one: `layout.tsx` was careful to
// emit NO <link rel="icon"> in that case, on the reasoning that the browser's own
// default is the honest fallback, but a static `public/favicon.ico` sat at exactly
// the path the browser falls back to and answered with the sparx "x". A Piggles
// tenant's website advertised a company its owner has never heard of, on the one
// asset nobody thinks to check (piggles/CLAUDE.md RULE #0, issue 254).
//
// Two answers, both of them the tenant's own:
//
//   they chose a favicon  → 307 to it
//   they chose none       → their INITIAL, drawn on their own primary color
//
// The generated initial is why this is a route and not a deleted file. A blank tab
// is honest but says nothing, and every unbranded site's tab looks like every
// other one — a business owner with her own site open beside two others cannot
// tell which is hers. A letter in her own brand color is unmistakably HER site,
// looks finished, and still puts no second company on a customer's screen.

import { ImageResponse } from 'next/og';

import { mediaUrl } from '@/lib/media';
import { resolveSite } from '@/lib/site-context';

// The tenant is resolved from the Host, so this cannot be statically rendered.
export const dynamic = 'force-dynamic';

/** Long enough that the crawlers hammering this path miss the origin, short
 *  enough that changing your logo shows up the same day. Tenants edit a favicon
 *  about once, but the day they do it is the day they are looking. */
const CACHE_CONTROL = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

/** Drawn at 64px so it stays clean when a browser scales it down to 16 for the tab
 *  and up for a bookmark tile. */
const SIZE = 64;

/** Only for a site with no primary color of its own — a neutral square, chosen
 *  because it makes no brand claim on the owner's behalf. Literal hex is
 *  sanctioned here: this is a generated image, and Satori cannot resolve a CSS
 *  custom property (CLAUDE.md RULE #1). */
const NEUTRAL_GROUND = '#1c1c1c';
const NEUTRAL_INK = '#ffffff';

/**
 * The letter to draw: the first character a reader would say out loud.
 *
 * Leading punctuation is skipped so "'t Winkeltje" draws a W rather than an
 * apostrophe, but a name that is ENTIRELY symbols keeps its first character —
 * that is genuinely what the business is called. Returns null only for a name
 * with nothing in it, where there is no honest letter to invent.
 */
function initial(name: string): string | null {
  const chars = [...name.trim()];
  const letter = chars.find((c) => /\p{L}|\p{N}/u.test(c)) ?? chars[0];
  return letter ? letter.toUpperCase() : null;
}

/** A theme color the tenant actually set. An empty string is a CLEARED field,
 *  not a color, so it resolves to null and lets the fallback run — which `??`
 *  alone would not do. */
function chosenColor(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

/** Black or white, whichever the eye can actually read on this ground. Uses
 *  relative luminance rather than a lightness guess, so a saturated mid-tone
 *  like a brand orange resolves correctly instead of by accident. */
function readableInk(hex: string): string {
  const digits = /^#?([0-9a-f]{6})$/i.exec(hex.trim())?.[1];
  if (!digits) return NEUTRAL_INK;
  const n = parseInt(digits, 16);
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255);
  return luminance > 0.4 ? '#000000' : '#ffffff';
}

export async function GET(): Promise<Response> {
  const site = await resolveSite();

  // An unknown host has no owner to speak for, so it gets nothing.
  if (!site) {
    return new Response(null, { status: 404, headers: { 'cache-control': CACHE_CONTROL } });
  }

  const chosen = mediaUrl(site.theme?.faviconMediaId ?? null, site.slug);
  if (chosen) {
    // Built by hand rather than with `Response.redirect`, which takes no headers —
    // and an uncached redirect on this path would send every bot to the origin.
    return new Response(null, {
      status: 307,
      headers: { location: chosen, 'cache-control': CACHE_CONTROL },
    });
  }

  const letter = initial(site.name);
  if (!letter) {
    return new Response(null, { status: 404, headers: { 'cache-control': CACHE_CONTROL } });
  }

  const ground = chosenColor(site.theme?.colorPrimary) ?? NEUTRAL_GROUND;
  const ink = chosenColor(site.theme?.colorPrimaryForeground) ?? readableInk(ground);

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: ground,
        color: ink,
        // Optical centering: a capital letter's ink sits above the box's middle,
        // so the glyph is nudged down to look centered rather than measure it.
        paddingTop: 2,
        fontSize: 44,
        fontWeight: 700,
        fontFamily: 'system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {letter}
    </div>,
    { width: SIZE, height: SIZE, headers: { 'cache-control': CACHE_CONTROL } }
  );
}
