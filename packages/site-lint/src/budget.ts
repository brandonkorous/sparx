// What a first visit actually downloads — measured, not guessed.
//
// WHY THIS IS SEPARATE FROM THE FINDINGS. Everything else in this package reports a
// DEFECT: a link to nothing, text nobody can read. Weight is not a defect. A heavy
// page is a trade — a photographer's portfolio is supposed to be full of large
// pictures, and telling them it is "broken" would be wrong. So the budget is a
// MEASUREMENT shown beside the findings, never a finding: no severity, no effect on
// `status`, nothing for the publish confirm to react to. The owner is told what their
// page weighs and roughly what that means on a phone, and decides.
//
// WHAT THE NUMBER IS. Two things only, because they are the two this engine can
// actually count: the bytes of the composed HTML, and the bytes of the picture files
// the page references. It is therefore a FLOOR on what a visit costs, never the total.
// Not counted: the stylesheet, webfonts, JavaScript, video, anything a third-party
// embed pulls in, and any picture hosted somewhere we cannot size (counted, but as
// `imagesUnsized`). Every surface showing these numbers has to say so — a floor
// presented as a total is a number that lies in the safe-looking direction.
//
// WHY THE CALLER SUPPLIES THE IMAGE SIZES. This engine is pure: no network, no
// database, no clock. It cannot fetch a picture to weigh it. So it names the files a
// site references (`imageSourcesOf`) and the caller — which does have a media library
// — hands back the sizes it knows. A source with no entry in that map is counted and
// reported as unsized rather than assumed to be free.

import { checkClassString, renderSilicaBody } from '@sparx/silica-catalog';

import type { SiteLintInput } from './types';
import { imageSrc, isImageNode, type ContentNode, type DocumentInventory } from './walk';
import type { Node as SilicaNode } from '@wizeworks/silicaui-html';

/* ── Where "heavy" starts ───────────────────────────────────────────────────── */

/**
 * The thresholds, in bytes, stated once and in one place.
 *
 * These are judgement calls, not physics, so they are written down where they can be
 * argued with rather than buried in a comparison. They are set for the visitor this
 * platform actually has to serve — someone on a phone, on mobile data, who leaves if
 * the page does not paint. On a typical 4G connection roughly 1.5 MB is a couple of
 * seconds; 3 MB is long enough that a good number of people give up.
 */
export const WEIGHT_BUDGET = {
  /** Markup alone. Past this the browser is parsing a lot of page before it can
   *  paint any of it, even on a fast connection. */
  htmlHeavy: 150_000,
  htmlVeryHeavy: 400_000,
  /** Markup plus pictures — what a first visit costs, as far as we can count it. */
  pageHeavy: 1_500_000,
  pageVeryHeavy: 3_000_000,
  /** One picture. Above this it is worth naming the file, because resizing a single
   *  photo is usually the entire fix. */
  imageHeavy: 500_000,
} as const;

/** How a page reads at a glance. `light` is not praise and `very-heavy` is not a
 *  failure — they are three bands so a list of pages can be scanned. */
export type WeightBand = 'light' | 'heavy' | 'very-heavy';

/* ── The report ─────────────────────────────────────────────────────────────── */

export interface PageWeight {
  pageId: string;
  pageName: string;
  slug: string;
  /** Bytes of the composed HTML — frame, page body and every saved piece expanded.
   *  Null if the page could not be rendered at all, which is worth showing as
   *  "unknown" rather than as zero. */
  htmlBytes: number | null;
  /** Pictures the page shows. A named file is counted ONCE however many times it
   *  appears — the same logo in the header and the footer is one download — and an
   *  image filled in from a record counts as one per block, since each one is a
   *  different picture at render time. */
  imageCount: number;
  /** Bytes of the pictures whose size we know. */
  imageBytes: number;
  /** Pictures on this page whose weight is NOT in `imageBytes`, for either of two
   *  reasons: the file is hosted outside the media library, or it comes from a
   *  record and is not chosen until the page renders. Their weight is real, which is
   *  exactly why the count is here rather than silently absent. */
  imagesUnsized: number;
  /** `htmlBytes + imageBytes`. A floor on what a first visit downloads. */
  totalBytes: number;
  band: WeightBand;
}

/** A picture big enough to be worth naming. */
export interface HeavyImage {
  src: string;
  bytes: number;
  /** How many pages reference it. A heavy file in the header is one fix that makes
   *  every page lighter, and that is only visible from this number. */
  pageCount: number;
}

export interface SiteBudget {
  /** Every page, HEAVIEST FIRST — the order someone reading this wants them in. */
  pages: PageWeight[];
  /** Every picture at or over `WEIGHT_BUDGET.imageHeavy`, heaviest first. Not a
   *  truncated top-N: the threshold is the whole criterion, so nothing is dropped
   *  quietly. */
  heavyImages: HeavyImage[];
  /** Distinct class names that emit no CSS anywhere on the site.
   *
   *  This counts NAMES; the findings list counts BLOCKS, so "2 styling names" beside
   *  "5 blocks affected" is not a contradiction — it is one typo repeated. Both come
   *  from the catalog's `checkClassString`, so they cannot disagree about what is
   *  broken, only about what they are counting. */
  unbackedClasses: string[];
  /** The heaviest page's total — the single number that decides how the site feels
   *  to someone who lands on the wrong page first. */
  heaviestPageBytes: number;
  /** Distinct picture FILES across the site whose size we could not look up. Bound
   *  images are not in here — they have no file to be distinct by — so a page's
   *  `imagesUnsized` can exceed what this accounts for, by design. */
  unsizedImages: number;
}

/* ── Measuring ──────────────────────────────────────────────────────────────── */

const encoder = new TextEncoder();

function byteLength(text: string): number {
  return encoder.encode(text).length;
}

/**
 * The bytes of an inline `data:` picture, which needs no lookup — the file IS the
 * attribute. Worth measuring rather than skipping: an inlined SVG logo or a pasted
 * screenshot lands in the markup of every page, where it is invisible to anyone
 * looking at a media library for something big.
 */
function dataUriBytes(src: string): number | null {
  const comma = src.indexOf(',');
  if (comma < 0) return null;
  const meta = src.slice(0, comma);
  const payload = src.slice(comma + 1);
  if (/;base64$/i.test(meta)) {
    // Four base64 characters carry three bytes; the trailing `=` padding carries none.
    const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
  }
  try {
    return byteLength(decodeURIComponent(payload));
  } catch {
    // A malformed escape sequence. The raw length is still the right order of
    // magnitude, and refusing to answer would report a real weight as unknown.
    return byteLength(payload);
  }
}

/** What one picture weighs: inline data measured directly, everything else looked up
 *  in the sizes the caller supplied. Null means "we do not know", never "nothing". */
function weightOf(src: string, sizes: Readonly<Record<string, number>> | undefined): number | null {
  if (src.startsWith('data:')) return dataUriBytes(src);
  const known = sizes?.[src];
  return typeof known === 'number' && Number.isFinite(known) ? known : null;
}

function bandOf(htmlBytes: number | null, totalBytes: number): WeightBand {
  if ((htmlBytes ?? 0) > WEIGHT_BUDGET.htmlVeryHeavy || totalBytes > WEIGHT_BUDGET.pageVeryHeavy) {
    return 'very-heavy';
  }
  if ((htmlBytes ?? 0) > WEIGHT_BUDGET.htmlHeavy || totalBytes > WEIGHT_BUDGET.pageHeavy) {
    return 'heavy';
  }
  return 'light';
}

/**
 * Every picture file the site references, so a caller can go and size them.
 *
 * Walks the AUTHORED trees rather than the composed documents, because the caller has
 * to ask this BEFORE the check runs — it is the input to the lookup whose answer is
 * then handed to `lintSite`. Inline `data:` sources are left out: they need no lookup,
 * and a caller querying a media library for a 40 KB URI string would get nothing back
 * and learn nothing from it.
 */
export function imageSourcesOf(input: SiteLintInput): string[] {
  const found = new Set<string>();

  const collect = (node: SilicaNode): void => {
    if (node.kind === 'outlet') return;
    if (isImageNode(node)) {
      const src = imageSrc(node);
      if (src && !src.startsWith('data:')) found.add(src);
    }
    for (const child of node.children ?? []) {
      if (typeof child !== 'string') collect(child);
    }
  };

  for (const page of input.pages) collect(page.root);
  if (input.frame?.root) collect(input.frame.root);
  for (const symbol of Object.values(input.symbols ?? {})) collect(symbol.root);

  return [...found].sort();
}

/** The composed HTML a visitor receives, or null if it could not be produced.
 *
 *  Rendered WITHOUT a data host, which is the honest limit of a pure engine and has to
 *  be read the right way: a collection template renders ONE card here and many on the
 *  live page, so its measured weight is a floor, not an estimate. Everything a
 *  hand-authored page carries is counted exactly. */
function renderBytes(page: { root: SilicaNode }, input: SiteLintInput): number | null {
  try {
    const html = renderSilicaBody(page.root, {
      ...(input.frame?.root ? { frame: input.frame.root } : {}),
      symbols: input.symbols ?? {},
    });
    return byteLength(html);
  } catch {
    // A tree the renderer chokes on is a real problem, but it is the publish path's
    // problem to report. A measurement that crashes takes the whole check down with
    // it, and the check is most useful on exactly the sites that are broken.
    return null;
  }
}

/**
 * Measure a site whose pages have already been walked.
 *
 * Takes the inventories `lintSite` built rather than composing again: they are the
 * composed documents, with the frame spliced and saved pieces expanded, which is the
 * only version of a page whose picture list is the one a visitor downloads.
 */
export function measureSite(
  input: SiteLintInput,
  inventories: readonly DocumentInventory[]
): SiteBudget {
  const sizes = input.imageBytes;
  /** src → the pages that show it, so a header picture is attributed everywhere. */
  const usage = new Map<string, number>();
  const unsizedSrcs = new Set<string>();
  const pages: PageWeight[] = [];

  for (const inventory of inventories) {
    const seen = new Set<string>();
    let imageBytes = 0;
    let imagesUnsized = 0;
    let boundImages = 0;

    for (const visited of inventory.nodes) {
      const node: ContentNode = visited.node;
      if (!isImageNode(node)) continue;
      const src = imageSrc(node);
      if (!src) {
        // A bound image is a picture we know will be there and cannot weigh — the
        // file is a field on a record. Counted, so a product grid does not report as
        // a page with no pictures on it. An image with no source and no binding is
        // not counted at all: nothing downloads, and the findings already call it an
        // error.
        if (node.data != null) {
          boundImages += 1;
          imagesUnsized += 1;
        }
        continue;
      }
      if (seen.has(src)) continue;
      seen.add(src);
      usage.set(src, (usage.get(src) ?? 0) + 1);

      const bytes = weightOf(src, sizes);
      if (bytes == null) {
        imagesUnsized += 1;
        unsizedSrcs.add(src);
      } else {
        imageBytes += bytes;
      }
    }

    const htmlBytes = renderBytes(inventory.page, input);
    const totalBytes = (htmlBytes ?? 0) + imageBytes;
    pages.push({
      pageId: inventory.page.id,
      pageName: inventory.page.name,
      slug: inventory.page.slug,
      htmlBytes,
      imageCount: seen.size + boundImages,
      imageBytes,
      imagesUnsized,
      totalBytes,
      band: bandOf(htmlBytes, totalBytes),
    });
  }

  pages.sort((a, b) => b.totalBytes - a.totalBytes);

  const heavyImages: HeavyImage[] = [];
  for (const [src, pageCount] of usage) {
    const bytes = weightOf(src, sizes);
    if (bytes != null && bytes >= WEIGHT_BUDGET.imageHeavy) {
      heavyImages.push({ src, bytes, pageCount });
    }
  }
  heavyImages.sort((a, b) => b.bytes - a.bytes);

  const unbacked = new Set<string>();
  for (const inventory of inventories) {
    for (const visited of inventory.nodes) {
      const classes = visited.node.class;
      if (!classes) continue;
      for (const issue of checkClassString(classes)) {
        // A viewport variant emits real CSS and works on the live page — it is only
        // invisible in the preview. Counting it as weight-that-does-nothing would be
        // wrong, and the findings list already explains it properly.
        if (issue.reason !== 'viewport-variant') unbacked.add(issue.className);
      }
    }
  }

  return {
    pages,
    heavyImages,
    unbackedClasses: [...unbacked].sort(),
    heaviestPageBytes: pages[0]?.totalBytes ?? 0,
    unsizedImages: unsizedSrcs.size,
  };
}
