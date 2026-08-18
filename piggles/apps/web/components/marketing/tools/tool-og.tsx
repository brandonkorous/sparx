import { BRAND, GROUP_HEX } from '@piggles/brand';
import { OG_SIZE, renderOg } from '@piggles/brand/og';
import { APP_GROUP } from '@piggles/config';
import { mascotForApp, resolveIntent } from '@piggles/mascot';
import { getTool } from './registry';
import { searchTitleFor } from './tool-metadata';

/**
 * One registry entry → the tool's social card.
 *
 * Seventeen tool pages already project their whole `<head>` from one entry
 * (tool-metadata.ts, and the same reasoning applies here twice over). A card is
 * the part of a page that gets seen by people who have not visited it, and
 * seventeen hand-written cards is seventeen chances for one to keep the old name
 * of an app, or the pink accent on a page that is green.
 *
 * Three things come out of the entry, and none of them is a new decision:
 *
 *   • the headline is the SEARCHABLE title — the phrase somebody typed to find
 *     this, which is the right thing to confirm back to them in a preview;
 *   • the accent is the hue of the app the tool hands you on to, so the card and
 *     the page it opens are the same colour;
 *   • the pose is that app's own pose, from MASCOT_BY_APP. The QR code maker
 *     wears My Site's; the margin calculator wears Money's. The picture says
 *     which part of the product this is a free sample of before a word is read.
 *
 * ── WHY THE SUBTITLE IS THE FIRST SENTENCE ─────────────────────────────────
 *
 * `tagline` runs 100–174 characters — written for a card in a grid with room to
 * breathe, not for a 708px column. Its first sentence is 21–148, and it is always
 * a COMPLETE sentence somebody wrote on purpose ("What should I charge?", "Can
 * everybody actually read that?"). Taking it is not truncation: nothing is cut
 * mid-thought and no ellipsis appears. Clamping the string at N characters would
 * be, which is why this does not do that.
 */
const SENTENCE = /^.*?[.?!](?=\s|$)/;

function firstSentence(text: string): string {
  return SENTENCE.exec(text)?.[0] ?? text;
}

export function toolOgImage(slug: string) {
  const tool = getTool(slug);

  // The registry is the source of truth for which tools exist — a slug missing
  // from it 404s on the page itself, so the card falls back to the brand rather
  // than throwing and producing no image at all.
  if (!tool) {
    return renderOg({
      title: 'Free tools for small businesses',
      subtitle: 'No sign-up, no watermark, nothing uploaded.',
      pose: resolveIntent('hero'),
    });
  }

  const group = APP_GROUP[tool.app];

  return renderOg({
    title: searchTitleFor(tool),
    subtitle: firstSentence(tool.tagline),
    // `home` has no entry in GROUP_HEX — its hue IS the brand pink, which differs
    // by theme and so is deliberately not duplicated into that map.
    accent: group && group !== 'home' ? GROUP_HEX[group] : BRAND.primary,
    pose: mascotForApp(tool.app),
  });
}

export { OG_SIZE };

/** The `alt` every tool card shares, built from the entry for the same reason
 *  the rest of it is. */
export function toolOgAlt(slug: string): string {
  const tool = getTool(slug);
  return tool
    ? `${searchTitleFor(tool)} — free, in your browser, no sign-up`
    : 'Free tools for small businesses';
}
