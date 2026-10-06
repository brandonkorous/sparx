// Saying what a design and its install MEAN, in an owner's words.
//
// Pure presentation vocabulary — no queries, no cache, nothing that needs a
// client boundary. Split out of blueprints-data so the reads stay reads and the
// wording stays in one place the gallery, the detail pane and the wizard can all
// quote from.

import { apiErrorMessage } from '../../lib/api-error';
import type { BlueprintContents } from './blueprints-data';

export type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/** What an install's status means, in an owner's words, with the tone that
 *  carries its color on a `<Badge>`. */
export function installState(
  status: string,
  /** Whether the public site is currently dark. A suspended account serves the
   *  "Temporarily unavailable" overlay instead of its pages, so nobody is
   *  looking at the design however published it is. */
  siteIsDark = false
): { label: string; tone: Tone; detail: string } {
  switch (status) {
    case 'live':
      return {
        label: 'Live',
        tone: 'success',
        detail: siteIsDark
          ? 'This design has been published. Your site is offline right now, so it goes up the moment your site is back.'
          : 'This design has been published: visitors see it on your site now.',
      };
    case 'installed':
      return {
        label: 'Added as drafts',
        tone: 'info',
        detail:
          'Everything this design adds is on your site as drafts. Only you can see it. Review it, then publish it when you are ready.',
      };
    case 'replaced':
      // None of its pages are left (persona issue 273): most often a design added
      // after it replaced them. It used to keep saying "Added as drafts" over
      // pages that were gone. The words say what is known, not a guessed cause.
      return {
        label: 'Pages gone',
        tone: 'warning',
        detail:
          'None of the pages this design added are on your site now. They go when another design is added to the site, or when they are deleted. To bring them back, remove this design and add it again. Removing it clears what else it left behind, and keeps the header, footer and look your site has now.',
      };
    case 'running':
      return {
        label: 'Setting up',
        tone: 'warning',
        detail: 'This design is still being added. Give it a moment, then refresh.',
      };
    case 'failed':
    default:
      return {
        label: 'Setup stopped',
        tone: 'error',
        detail:
          'Something went wrong partway through adding this design. Remove it to clear what was started, then try again.',
      };
  }
}

/**
 * What this console calls a part of the platform.
 *
 * ONE table, in `lib/surfaces/nav.ts`, which resolves through the brand's own
 * app registry. This file kept its own, and so did five others; measured
 * 2026-09-25, `commerce` alone had SIX names across the two consoles —
 *
 *     Sell (the rail) · Selling · Online store · Online stores · Store · commerce
 *
 * — and a Piggles shop owner met four of them on four different screens while
 * the rail beside her said Sell the whole time. Same defect as one order reading
 * four ways on four screens (issue 260), one level up: the APPS themselves.
 */
export { moduleLabel } from '../../lib/surfaces/nav';

/** A short "what it creates" line for a card: the two or three biggest things,
 *  in plain words. Empty designs (a bare starting point) say so rather than
 *  showing nothing. */
export function contentsSummary(contents: BlueprintContents): string {
  const parts = contentsLines(contents);
  if (parts.length === 0) return 'A clean starting point';
  return parts
    .slice(0, 3)
    .map((line) => line.text)
    .join(' · ');
}

export interface ContentsLine {
  key: string;
  text: string;
}

/** What the design brings, split the way the install itself splits it: the
 *  structure it always brings, and the examples that are a choice (issue 098). */
export interface ContentsGroups {
  structure: ContentsLine[];
  examples: ContentsLine[];
}

function counted(
  contents: BlueprintContents,
  keys: [keyof BlueprintContents, string, string][]
): ContentsLine[] {
  const out: ContentsLine[] = [];
  for (const [key, one, many] of keys) {
    const value = contents[key];
    if (typeof value === 'number' && value > 0) {
      out.push({ key, text: `${String(value)} ${value === 1 ? one : many}` });
    }
  }
  return out;
}

/** The two groups, largest concepts first inside each. The pages, the shelves and
 *  the email designs are the design; the stock on the shelves, the articles and
 *  the diary are somebody else's business, kept only if she asks for them. */
export function contentsGroups(contents: BlueprintContents): ContentsGroups {
  return {
    structure: counted(contents, [
      ['pages', 'page', 'pages'],
      ['categories', 'category', 'categories'],
      ['collections', 'collection', 'collections'],
      ['emails', 'email design', 'email designs'],
    ]),
    examples: counted(contents, [
      ['products', 'example product', 'example products'],
      ['content', 'example article', 'example articles'],
      ['schedulingServices', 'example service', 'example services'],
      ['schedulingResources', 'example team member', 'example team members'],
      ['schedulingLocations', 'example place', 'example places'],
    ]),
  };
}

/** Every non-empty "what it creates" count as a labelled line, structure first. */
export function contentsLines(contents: BlueprintContents): ContentsLine[] {
  const groups = contentsGroups(contents);
  return [...groups.structure, ...groups.examples];
}

/** What taking (or leaving) the examples actually does, for a confirm. */
export function examplesSentence(sampleData: boolean): string {
  return sampleData
    ? 'Its example products, articles and bookings come too, so there is something real on every screen to look at and change.'
    : 'Its examples are left out, so nothing arrives that is not yours. The pages and shelves come in empty, ready for your own.';
}

/** The server's own sentence for a 4xx, shown verbatim: the blueprint routes
 *  explain the real problem ("This template is already installed…") far better
 *  than a status code can. A 5xx carries no such sentence, so it falls back to
 *  the caller's wording. */
export function blueprintErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}

/** Medium date, or an em dash for nothing. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

/* ── What adding a design DOES to the site it is pointed at ────────────────── */

/**
 * A design is a whole site, and adding one to a site that has pages REPLACES
 * them. This is the sentence that says so, sized to the chosen site.
 *
 * It exists because three places on this pane promised the opposite — "nothing
 * here replaces what you already have", and a confirm dialog reading "Your
 * existing pages and products are left exactly as they are". The install path is
 * `siteService.installSite`, which syncs with `allowReplace: true`, and
 * `pagesToDelete` then returns every stored page absent from the incoming roster
 * — which is all of them, since an install mints fresh ids. Adding a second
 * design to a nine-page site left nine pages, all of them the second design's.
 *
 * And it cannot be undone from here. A draft version restore is deliberately
 * non-destructive (`draft-version-service`): it brings back the content of pages
 * that still exist and never resurrects a deleted one. So the sentence says that
 * too, rather than offering a recovery that is not there.
 *
 * What genuinely survives is everything that is not the site itself. The
 * installer only ever DELETES `builder_page` rows; products, articles, customers
 * and orders are added to, never removed. Saying so is the difference between a
 * warning somebody can act on and one that reads as "you may lose everything".
 */
export interface InstallImpact {
  /** True when pages will be destroyed, which is what makes this a danger. */
  readonly replaces: boolean;
  /** How many go. Null when nobody counted — never 0, which would mean "empty". */
  readonly pages: number | null;
  readonly sentence: string;
}

export function installImpact(siteName: string, pageCount: number | undefined): InstallImpact {
  const kept =
    'Everything else stays as it is: your products, articles, customers and orders are not touched.';

  if (pageCount === 0) {
    return {
      replaces: false,
      pages: 0,
      sentence: `${siteName} has no pages yet, so this design gives it its first ones. They arrive as drafts only you can see, and nothing is live until you publish it.`,
    };
  }

  // Nobody counted. Say the thing that is true either way rather than guessing at
  // a number, and never the reassuring half.
  if (pageCount === undefined) {
    return {
      replaces: true,
      pages: null,
      sentence: `A design is a whole site, not a set of pages added to one. Whatever ${siteName} has now is replaced by this design, along with its header, footer and look, and that cannot be undone. ${kept}`,
    };
  }

  const many = pageCount === 1 ? 'its 1 page' : `all ${String(pageCount)} of its pages`;
  return {
    replaces: true,
    pages: pageCount,
    sentence: `A design is a whole site, not a set of pages added to one. ${siteName} has ${pageCount === 1 ? '1 page' : `${String(pageCount)} pages`} now, and adding this design replaces ${many}, along with its header, footer and look. That cannot be undone. ${kept}`,
  };
}

/**
 * A design's look, said in words rather than in the key it is stored under.
 *
 * `contents.theme` is a SLUG — `glossy-fashion`, `retail-plant-modern`,
 * `b2b-apparel-blanks`, `fiveelements` — and it was drawn onto the pane exactly
 * as stored: "Comes with the glossy-fashion look". Measured 2026-09-25 on the
 * dev catalog: 191 designs carry a theme, 79 of the slugs have a hyphen in them,
 * and `marketplace_themes.name` is the slug again, so there is no display name
 * anywhere to reach for.
 *
 * 40 of the 191 slugs are the design's OWN name, slugified, so the sentence read
 * "Glossy Fashion comes with the Glossy Fashion look" — a name repeated back to
 * somebody who just read it. That case says the same thing without the echo.
 */
export function lookSentence(
  theme: unknown,
  designName: string
): { text: string; name: string | null } {
  if (typeof theme !== 'string' || theme.trim() === '') {
    return { text: 'Its colors, fonts and spacing come set up for you.', name: null };
  }
  const name = theme
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  if (name.toLowerCase() === designName.trim().toLowerCase()) {
    return { text: 'Its colors, fonts and spacing come set up for you.', name: null };
  }
  return { text: 'look (colors, fonts and spacing) comes set up for you.', name };
}

/**
 * What KIND of business a design was drawn for, in words rather than the trade's
 * own four labels.
 *
 * The catalog stores four verticals and nothing else: `services` (111 designs),
 * `retail` (50), `content` (18) and `b2b` (12), measured 2026-09-25. Both the
 * gallery card and the detail line title-cased the raw value with their own
 * private copy of the same three lines of code — so a shop owner read "Retail",
 * "Content", and, for twelve designs, "B2b".
 *
 * "Retail" is not wrong so much as EMPTY: it is a word from a catalog taxonomy,
 * and what somebody choosing a design wants to know is what the design is set up
 * to do. The fallback stays title-case, for a vertical added after this table.
 */
const VERTICAL_WORDS: Record<string, string> = {
  retail: 'For selling things',
  services: 'For taking bookings',
  content: 'For publishing',
  b2b: 'For selling to other businesses',
};

export function verticalLabel(vertical: string | null | undefined): string | null {
  if (!vertical) return null;
  const known = VERTICAL_WORDS[vertical.toLowerCase()];
  if (known) return known;
  return vertical
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
