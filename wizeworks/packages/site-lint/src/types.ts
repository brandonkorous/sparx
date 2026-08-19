// The vocabulary of a pre-publish check: what a finding IS, where it points, and
// what the engine is given to find one.
//
// Every string a tenant reads is written here rather than at the call site, because
// the same finding surfaces in three places (the Check step before publish, the MCP
// tool's text answer, and any future report) and they must not drift into three
// different explanations of the same problem. The audience is a business owner with
// no technical vocabulary: "This link goes to a page that doesn't exist", never
// "404 on href".

import type { Node as SilicaNode, SymbolDef, Theme } from '@wizeworks/silicaui-html';
import type { SiteBudget } from './budget';

/* ── What the engine is asked to check ──────────────────────────────────────── */

/**
 * One page as the linter needs it: silica's routable body plus the sparx-owned
 * per-page metadata silica's flat `Page` does not model (SEO, indexing, whether it
 * is a one-off page or a template rendering many records).
 *
 * Deliberately a MIRROR of the fields on `BuilderPageDto` rather than an import of
 * it: this package must stay usable from the storefront, the API and a test with no
 * schema dependency, and every field here is one the engine actually reads.
 */
export interface LintablePage {
  /** The `BuilderPage` row id — half of the click-to-node address. */
  id: string;
  /** The name the author sees in the page switcher. */
  name: string;
  /** Route path as authored: `''`, `/`, `about`, `/about` are all accepted and
   *  normalized once, here, so no rule has to think about the leading slash. */
  slug: string;
  /** The authored page body. */
  root: SilicaNode;
  seoTitle?: string | null;
  seoDescription?: string | null;
  canonical?: string | null;
  ogImage?: string | null;
  /** Deliberately hidden from search engines. Suppresses every SEO finding on this
   *  page — nagging about a description for a page the owner chose to hide is noise. */
  noindex?: boolean;
  /** `'singleton'` (one page) or `'collection'` (one template rendering every record
   *  of `recordType`). A collection template's path is a pattern rather than a
   *  location, so relative links on one are not resolved. Mirrors `BuilderPageKind`;
   *  absent is treated as a singleton. */
  kind?: 'singleton' | 'collection';
  recordType?: string | null;
}

/**
 * What a link is ALLOWED to point at.
 *
 * Every roster is optional, and the distinction between `undefined` and `[]` is the
 * whole contract: `undefined` means the caller did not tell us what exists, so a
 * link into that space is left alone; `[]` means the caller looked and there are
 * none, so a link into it is provably broken. Getting that backwards would either
 * flag every product link on a site whose products the caller never loaded, or stay
 * silent on the one case the check exists for.
 *
 * The engine folds the pages being linted into `paths` itself — a caller never has
 * to restate its own page roster.
 */
export interface LinkTargets {
  /** Every OTHER routable path beyond the pages being linted and the storefront's
   *  own built-in routes: CMS `page` entries, legal pages, anything else the
   *  catch-all resolves.
   *
   *  Supplying this — even as `[]` — turns ON bare-path checking, because it is the
   *  caller asserting the roster is now complete. Omitting it leaves a link like
   *  `/warranty` alone: the engine cannot tell "typo" from "a CMS page nobody
   *  mentioned", and guessing wrong here means telling an owner their working page
   *  is broken. */
  paths?: readonly string[];
  productHandles?: readonly string[];
  collectionHandles?: readonly string[];
  categoryHandles?: readonly string[];
  /** Blog post slugs, for `/blog/<slug>`. */
  postSlugs?: readonly string[];
  /** Bookable service ids, for `/book/<serviceId>`. */
  serviceIds?: readonly string[];
}

/** The whole site as the linter sees it — what `lintSite` takes. */
export interface SiteLintInput {
  pages: readonly LintablePage[];
  /**
   * Every page the site HAS, for the checks that read addresses rather than trees.
   *
   * Defaults to `pages`. A caller that drops pages before the walk — the API service
   * skips any with no saved draft — must pass the full set here, or a page that
   * silently occupies your home address is invisible precisely because nobody has
   * opened it yet.
   */
  addressing?: readonly PageAddress[];
  /** The shared chrome wrapping every page. Its `root` must contain an outlet; a
   *  frame without one renders no page content at all, which is its own finding. */
  frame?: { root: SilicaNode } | null;
  /** Saved components, keyed by symbol id. An instance is expanded through these so
   *  a problem inside a saved component is found once, where it is fixed. */
  symbols?: Record<string, SymbolDef> | null;
  /** The active theme — what every `bg-primary` / `text-base-content` in the trees
   *  actually paints. Without it the contrast rules return nothing rather than
   *  guessing at a default palette; every other rule is unaffected. */
  theme?: Theme | null;
  targets?: LinkTargets;
  /** What each picture on the site WEIGHS, keyed by the exact `src` it is referenced
   *  by — the answer to `imageSourcesOf(input)`, which a caller with a media library
   *  looks up and hands back. This engine has no network, so a source missing from
   *  here is reported as unsized rather than assumed weightless. Omit it entirely and
   *  every picture is unsized; the HTML weight and the styling count still stand. */
  imageBytes?: Readonly<Record<string, number>>;
}

/* ── What comes back ────────────────────────────────────────────────────────── */

/**
 * How much a finding matters — NEVER whether a publish may proceed. The owner
 * decides; the tool advises (docs/builder-audit slice 11).
 *
 *   · `error`      — a visitor gets something visibly broken: a link to nothing, a
 *                    page with no content, an image with no source.
 *   · `warning`    — the page works but is degraded: no image description, a button
 *                    nothing happens on, styling that emits no CSS.
 *   · `suggestion` — worth doing, nothing is broken: heading outline, SEO wording.
 */
export type LintSeverity = 'error' | 'warning' | 'suggestion';

/** Every check the engine can report. A stable id per rule so a surface can filter,
 *  count, or link to an explanation without matching on prose. */
export type LintRuleId =
  // Links
  | 'link-broken'
  | 'link-no-destination'
  | 'link-anchor-missing'
  | 'link-mailto-empty'
  // Images
  | 'image-no-source'
  | 'image-no-description'
  // Embeds (video / map / anything else framed from another site)
  | 'embed-no-source'
  // Headings
  | 'heading-missing'
  | 'heading-multiple-top'
  | 'heading-level-skipped'
  | 'heading-empty'
  // Interactive
  | 'button-does-nothing'
  | 'control-no-label'
  // Styling
  | 'class-no-css'
  | 'class-preview-blind'
  | 'class-container-orphan'
  // Color
  | 'contrast-low'
  | 'contrast-unreadable'
  // Structure
  | 'page-empty'
  | 'frame-no-outlet'
  | 'symbol-missing'
  | 'duplicate-node-id'
  // Search-engine metadata
  | 'seo-title-missing'
  | 'seo-title-duplicate'
  | 'seo-description-missing'
  | 'seo-description-duplicate'
  | 'seo-page-hidden'
  // Addressing
  | 'page-address-duplicate';

/** Which authored tree a finding lives in — the tree the fix happens in, which is
 *  not always the page it was seen on. A broken link in the footer belongs to the
 *  frame; one inside a saved component belongs to that component. */
export type LintScope = 'page' | 'frame' | 'symbol' | 'site';

/** Where a finding is, precisely enough for a surface to open the right editor and
 *  select the right node. */
export interface LintLocation {
  scope: LintScope;
  /** `BuilderPage` id for a page, symbol id for a saved component; null for the
   *  frame (a site has one) and for site-wide findings. */
  ownerId: string | null;
  /** What the author calls it: "Home", "Header & footer", "Product card". */
  ownerName: string;
  /** The silica node id to select. Null when the finding is about the page or site
   *  itself rather than one node, or when the node carries no id (template trees
   *  are id-free until stamped). */
  nodeId: string | null;
  /** A human trail to the node for the cases `nodeId` is null — `section › div › a`.
   *  Never used for addressing; it exists so a finding is still findable by eye. */
  nodePath: string;
  /** Pages the finding was seen on, by name. One entry for a page-scoped finding;
   *  for the frame and saved components it is every page that shows them, which is
   *  what makes "fix this once" legible instead of looking like N problems. */
  seenOn: string[];
}

/** One thing worth telling the owner about. */
export interface LintFinding {
  rule: LintRuleId;
  severity: LintSeverity;
  /** One plain sentence naming the problem, no jargon. Shown as the row. */
  title: string;
  /** Why it matters and what to do, in the same voice. Shown when expanded. */
  detail: string;
  location: LintLocation;
  /** The offending value verbatim when there is one — the href, the class, the
   *  duplicated title. Shown as evidence so the owner recognises what we mean. */
  evidence?: string;
  /**
   * A correction an editor may apply on the author's behalf — present ONLY when the
   * answer is a single unambiguous substitution AND applying it cannot make the page
   * worse. Absent is the default and the safe reading.
   *
   * MOST FINDINGS WILL NEVER CARRY ONE, and that is the point rather than a gap. "This
   * looks like a link but is not one" is fixed by choosing a destination, which is the
   * author's sentence to write; "these words are hard to read" is fixed by a color
   * decision. Offering to make those choices would be a guess wearing the clothes of a
   * fix — and a check that silently changes a page is a worse failure than one that only
   * describes it.
   */
  fix?: LintFix;
}

/**
 * The only fix kind so far: swap one class token for another on the node the finding
 * names. Deliberately narrow — a fix that can only replace one class is a fix whose
 * blast radius is knowable by reading it.
 */
export interface LintFix {
  kind: 'replace-class';
  /** The exact token to remove, as it appears in the node's class string. */
  from: string;
  /** The token to put in its place. */
  to: string;
  /** One short line for the button's tooltip, in the owner's language. */
  label: string;
}

/** Advisory only. `fail` means "a visitor will see something broken", never "you
 *  may not publish" — nothing in this package can stop a publish. */
export type LintStatus = 'pass' | 'warn' | 'fail';

/** The little a page needs to have an ADDRESS — no tree, so this can cover pages
 *  the walk never reached. */
export interface PageAddress {
  id: string;
  name: string;
  slug: string | null;
  kind?: 'singleton' | 'collection';
  recordType?: string | null;
}

export interface SiteLintReport {
  status: LintStatus;
  findings: LintFinding[];
  counts: Record<LintSeverity, number>;
  /** How many pages were walked — so a surface can say "checked 7 pages" rather
   *  than showing a clean result that might just mean nothing was inspected. */
  pagesChecked: number;
  /** What each page WEIGHS, alongside the findings and deliberately not among them.
   *  A heavy page is a trade, not a defect — a photographer's portfolio is meant to
   *  be full of large pictures — so nothing here carries a severity or moves
   *  `status`. See `budget.ts` for what the number does and does not include. */
  budget: SiteBudget;
}
