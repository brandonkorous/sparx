import { STORY_EXAMPLES } from '@wizeworks/story-schemas';
import { renderStoryOg } from '@/lib/og-story';

// The site's primary social card is the marketing hero's told story, frozen — the
// salon example ("I want to start a salon for people, where they can book
// appointments and order online… bella-salon.sparx.zone"). It reads from the SAME
// grammar the hero types, so the share preview and the homepage stay identical;
// renderStoryOg bakes the module-hued chips to literal hues satori can draw. See
// lib/og-story.tsx.

// `nodejs`, not `edge` — this card is prerendered to a static .body file at build
// time, which is what makes the response a buffered file with a real
// Content-Length. On `edge` it was compiled per request (satori + the yoga/resvg
// wasm), measured at ~2.4s vs ~0.24s static, and streamed back chunked with NO
// Content-Length. LinkedIn's image fetcher validates size against Content-Length
// before downloading, so a chunked OG response is rejected — which is why the
// cards worked everywhere except LinkedIn. Nothing here needs the edge runtime
// (system fonts, inline SVG, no network), so this matches the other module cards.
export const runtime = 'nodejs';
export const alt = 'sparx — Your story, multiplied.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// The salon is the lead example in the shared set (a 4-module story that fits the
// card cleanly); the homepage hero opens on the same one. Guarded so an empty set
// fails the build loudly rather than rendering a card with no story.
const SALON = STORY_EXAMPLES[0];
if (!SALON) throw new Error('STORY_EXAMPLES is empty — no story to render the OG card from.');
const SALON_STORY = SALON.story;

export default function Image() {
  return renderStoryOg({
    story: SALON_STORY,
    headline: { lead: 'Your story,', accent: 'multiplied.' },
  });
}
