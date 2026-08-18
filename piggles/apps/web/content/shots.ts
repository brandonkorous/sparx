import type { PigglesAppId } from '@piggles/config';

// The product-screenshot registry — ONE source of truth for every capture of the
// real console, shared by the app-page heroes and by anything else that wants to
// show the software.
//
// ── WHY A REGISTRY AND NOT A PATH IN EACH PAGE ──────────────────────────────
//
// These images are being captured once and used at least twice: the hero
// carousel on /apps/[app], and the documentation pages that come later. Two
// consumers hardcoding `/product/stock/levels-desktop-light.png` is two places
// to edit when a surface is re-shot, and the second one is always the one nobody
// remembers. A page asks this file what shots exist for an app; it never spells
// a filename.
//
// It also means a docs page can ask for a SURFACE by name — "show me the stock
// count screen" — without knowing which viewports or themes were captured, or
// which of them exist yet.
//
// ── THE FILE NAMING CONTRACT ────────────────────────────────────────────────
//
//   public/product/<app>/<surface>-<viewport>-<theme>.png
//   public/product/stock/levels-desktop-light.png
//   public/product/stock/levels-mobile-dark.png
//
// A DIRECTORY PER APP, because fifteen apps at eight files each is 120 images
// and a flat folder of them is unusable. `<surface>` is a name rather than a
// number — `stock-1.png` tells a docs author nothing, and the whole point of
// this registry is that a docs page can ask for `counts` and get it.
//
// The theme and viewport are in the FILENAME rather than in a folder because
// they are the two axes that always both exist for a given surface, so a glob of
// one surface's four files sorts together.
//
// ── NEVER REPLACE AN IMAGE IN PLACE ─────────────────────────────────────────
//
// Next serves optimised images with a long `max-age`, so overwriting a path
// keeps rendering the old picture — in the browser, and on a live site in the
// CDN and in every returning visitor's cache, with nothing to invalidate it.
// Re-shooting a surface means a new `surface` slug (or a dated suffix) and an
// edit here. public/photos/README.md records the same rule after it bit twice.

/** The two viewports every surface is captured at. `mobile` is not a nicety —
 *  "it works on a phone, standing up, with one hand" is a claim /who-its-for
 *  makes in as many words, and a phone-shaped capture is that claim evidenced. */
export type ShotViewport = 'desktop' | 'mobile';

/** Both themes are captured for every shot, and the PAGE picks — the visitor's
 *  theme is already known, so serving the matching image is strictly better than
 *  making them click to it. Theme is not a carousel slide. */
export type ShotTheme = 'light' | 'dark';

export interface ProductShot {
  /**
   * Stable slug for the SURFACE, not for the image. Matches what the console
   * calls the screen, so a docs page can ask for it by the name a reader would
   * use: `levels`, `counts`, `batches`, `locations`.
   */
  surface: string;
  /** What to call this slide in the UI. Sentence case, the customer's words. */
  label: string;
  /**
   * Describes WHAT IS IN THE FRAME, for somebody who cannot see it. Never what
   * the page wants it to prove — the failure public/photos/README.md exists to
   * stop, where a caption got written from a filename.
   */
  alt: string;
  /**
   * Read ALONGSIDE the picture, so it does the job the picture cannot: whose
   * workspace this is and what to notice. Deliberately NOT the alt text — that
   * inventories the frame, and printing it under the image tells a sighted
   * reader what their own eyes just told them.
   */
  caption: string;
  /** Viewports actually captured. `desktop` always; `mobile` when shot. */
  viewports: ShotViewport[];
}

/**
 * The pixel size every capture is taken at. ONE source of truth: the script
 * divides by its scale factor to get a canvas, the page declares it on <Image>.
 *
 * MOBILE IS 9:19 BECAUSE THE FRAME IS. silica's `.mockup-phone-display` is
 * `aspect-ratio: 9 / 19` with `overflow: hidden` — a fixed box, 240 × 507 as
 * rendered. A capture at a real handset's shape (iPhone 14 is 9:19.5) is
 * PROPORTIONALLY TALLER than that box and can never sit flush in it. The frame
 * belongs to the design system and does not move, so the picture matches the
 * frame rather than the other way round.
 *
 * Desktop is 16:10, which is only the canvas the browser frame is given.
 */
export const SHOT_SIZE: Record<ShotViewport, { width: number; height: number }> = {
  desktop: { width: 2880, height: 1800 },
  mobile: { width: 1188, height: 2508 },
};

/** Where a given shot's file lives. The ONLY place a product-image path is
 *  spelled — every consumer goes through here. */
export function shotSrc(
  app: PigglesAppId,
  shot: ProductShot,
  viewport: ShotViewport,
  theme: ShotTheme
): string {
  return `/product/${app}/${shot.surface}-${viewport}-${theme}.png`;
}

/**
 * Every captured surface, per app, in the order they should appear as carousel
 * slides — the most representative screen first, because it is the one a visitor
 * who never touches the controls will see.
 *
 * An app with NO entry is not broken and not a TODO: <AppFigure> falls back to
 * its six `does[]` titles, which is a finished state on its own. Add an app here
 * only when there is real data behind every screen listed, captured from the
 * Wildroot Flowers workspace (see public/product/README.md).
 */
export const APP_SHOTS: Partial<Record<PigglesAppId, ProductShot[]>> = {
  stock: [
    {
      surface: 'levels',
      label: 'What you have, and where',
      alt: 'Two windows side by side in the Piggles workspace. On the left, twelve stock lines across a shop cooler and a dry store, each with what is left to sell and a state; two read "Running low". On the right, the product list with prices.',
      caption:
        'Wildroot Flowers on a Thursday — stock and the catalog open together, two lines running low before anybody had to go and look.',
      viewports: ['desktop', 'mobile'],
    },
    {
      surface: 'batches',
      label: 'Which batch, and how long it has',
      alt: 'A floating window listing four batches of cut stems in the shop cooler, each with how many remain and when it expires: one expired a day ago, the others in two, four and nine days. A second window sits behind it.',
      caption:
        'Flowers have a clock on them. One batch of ranunculus went over yesterday, three more are inside a fortnight — and the shop knew without opening the cooler.',
      viewports: ['desktop', 'mobile'],
    },
    {
      surface: 'reorder',
      label: 'What to reorder, and why',
      alt: 'A list of three items to reorder, each showing its supplier, how much is available, how long delivery takes, how fast it sells, how many to order, how many are already on the way, and when it runs out.',
      caption:
        'Not a low-stock alert — a quantity, with the working shown. Two of the three have no supplier on file yet, and it says so rather than guessing.',
      viewports: ['desktop', 'mobile'],
    },
    {
      surface: 'locations',
      label: 'Everywhere you keep things',
      alt: 'Three locations listed — a shop cooler and a dry store in Asheville, North Carolina, and a main warehouse — each marked as somewhere the business owns and currently in use. A batches tab sits alongside.',
      caption:
        'A cooler and a dry store are two different places to a florist, and stock is counted per place rather than as one number.',
      viewports: ['desktop', 'mobile'],
    },
  ],
};
