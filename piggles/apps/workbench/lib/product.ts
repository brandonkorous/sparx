// The product adapter — the ONE seam through which a brand reaches shared code.
//
// This app owns its surfaces outright (piggles/CLAUDE.md RULE #0), so nothing
// here is forced on it by another product. It survives the fork because the
// problem it solves is still real: ~220 screens and several hundred sentences
// would otherwise each need editing by hand to say "Piggles", and a wording
// decision made in one place is a wording decision somebody can revise.
//
// Almost everything that makes this app look like Piggles rides a token — a
// hue, a radius, a font. These are the things that cannot:
//
//   • THE PRODUCT'S NAME. A handful of shared strings say it out loud ("a new
//     version of sparx is ready"). Under the other brand that sentence names a
//     product the reader has never heard of.
//   • WHAT A MODULE IS CALLED. `moduleLabel()` is called from shared surfaces —
//     the AI tool-policy matrix and the automation step editor both render it —
//     so a brand that calls CRM "Customers" cannot express that in its shell
//     alone.
//   • THE LOADING MARK. Every pane's Suspense fallback shows the brand's mascot.
//     Sparky in a Piggles console is a leak, and a generic spinner in either is
//     a loss.
//
// ── WHY A REGISTRY AND NOT A REACT CONTEXT ──────────────────────────────────
//
// `moduleLabel()` is a plain function called from render bodies, `.map()`s and
// option tables across a dozen surfaces; making it a hook would mean touching
// every one and would still not reach the non-React callers (the update toast is
// raised imperatively). A module-level registry answers all of them, and the two
// shells are separate builds, so there is no realm in which both are configured
// at once.
//
// ── HOW TO USE IT ───────────────────────────────────────────────────────────
//
// A shell calls `configureProduct()` ONCE, at module scope in its shell file, so
// it has run before anything renders. sparx's shell does not have to call it at
// all: the defaults below ARE sparx, which keeps this file from being a thing
// the platform has to remember to feed.

import type { ComponentType } from 'react';
import type { WorkbenchModule } from '../components/module-scope';

/** Props the loading mark is handed. Deliberately one field — a brand's mark is
 *  its own business, and the only thing the workbench knows that the mark cannot
 *  read for itself is which way the theme is currently pointing.
 *
 *  Note what is NOT here: a size. A numeric size has to become an inline
 *  `style`, which is banned, so a mark sizes itself with a utility class. */
export interface ProductLoadingMarkProps {
  tone: 'light' | 'dark';
}

/**
 * Which state a pane is in, for a brand that draws them.
 *
 * Deliberately the STATE, never a pose or a filename. A surface says where it is
 * and the brand decides what that looks like — which is the same contract the
 * mascot package states for itself ("a surface names the SITUATION it is in and
 * gets the pose; it never names a pose directly").
 */
export type ProductState =
  | 'waiting'
  /** A list narrowed by a search or filter matched nothing. */
  | 'no-results'
  /** A list with nothing in it yet — an invitation, not a problem. */
  | 'first-run'
  /** A pane that works and has nothing to show: no record chosen, nothing applies. */
  | 'empty'
  /** The server could not be reached. The data exists; retrying is the move. */
  | 'unreachable'
  /** The record is gone. Retrying cannot help. */
  | 'missing';

export interface ProductStateArtProps {
  state: ProductState;
  /** The module whose surface this is, so a brand with per-app artwork can use
   *  it — an empty Bookings pane and an empty Stock pane are different pictures.
   *  Absent where the component genuinely does not know. */
  module?: string;
}

interface ProductAdapter {
  /** The customer-facing product name, as it appears mid-sentence. */
  name: string;
  /** Overrides for `moduleLabel()`. Partial on purpose: a brand states only what
   *  it renames, and anything absent falls through to the platform's own label. */
  moduleLabels: Partial<Record<WorkbenchModule, string>>;
  /** The mark shown while a pane loads. `null` means "use the platform's". */
  LoadingMark: ComponentType<ProductLoadingMarkProps> | null;
  /**
   * Surface keys this product does NOT have, by key.
   *
   * The other three fields translate a shared surface into a brand's words. This
   * one is for the surfaces that cannot be translated at all, because they are
   * about a PRODUCT rather than a capability: sparx.market is a marketplace that
   * exists under one brand and not the other, and "Set up sparx Pay" names a
   * thing with no counterpart to rename it to. Substituting the brand name there
   * would invent a product ("Piggles.market") that nobody can sign up for, which
   * is worse than the leak it replaces.
   *
   * A brand states its own absences, so nothing here is a brand check in shared
   * code — the platform reads a list it was handed (piggles/CLAUDE.md RULE #0).
   *
   * Read through `surfaceIsVisible`, which the rail AND the launcher both go
   * through, so a hidden surface is hidden in both. Hiding is about what is
   * OFFERED; api-rest still gates every route independently.
   */
  hiddenSurfaces: ReadonlySet<string>;
  /**
   * Sentences this brand writes for itself, by key.
   *
   * ── WHY THIS IS NOT `productName()` INTERPOLATION ─────────────────────────
   *
   * The obvious shortcut is to make every branded sentence a template and drop
   * the product name in. It does not work, and it is worth being precise about
   * why, because it LOOKS like it works:
   *
   *   "Counted by sparx itself, without cookies, so there is nothing for
   *    visitors to accept and nothing to set up."
   *
   * Substituting the name yields a sentence in sparx's voice with a different
   * noun in it. sparx writes for an operator and can say "counted server-side";
   * Piggles writes for somebody who did not choose to be in software today and
   * needs the same fact told differently, at a different length, sometimes in a
   * different order. That is a rewrite, not a variable.
   *
   * So a brand supplies WHOLE SENTENCES, written by a person in that brand's
   * voice. The key is a stable id; the surface passes its own text as the
   * fallback, so sparx's file still reads as prose and a brand that has not
   * written an override yet degrades to something true rather than something
   * empty.
   */
  copy: Readonly<Record<string, string>>;
  /**
   * Blocks INSIDE a shared surface that this product does not have.
   *
   * `hiddenSurfaces` handles a whole pane. This handles the smaller case: a
   * section of a surface that is about a product one brand operates and the
   * other does not — the marketplace card on a product's Channels tab, the
   * first-party payment option in the provider list. The rest of the surface is
   * a real shared capability and stays.
   *
   * Same contract as the rest of this file: the brand states its own absences
   * and the platform reads a list it was handed, so no shared surface ever asks
   * which brand it is running under.
   */
  hiddenFeatures: ReadonlySet<string>;
  /**
   * What this product calls each SCREEN, by surface key.
   *
   * ── WHY THE MODULE LEXICON WAS NOT ENOUGH ─────────────────────────────────
   *
   * `moduleLabels` renames the twenty modules. It does nothing for the ~220
   * listed surfaces inside them, and those are what a person actually reads:
   * open the Sell app under a brand written for shop owners and the panel says
   * Fitment · Configurator · Product types · Collections · Price lists ·
   * Checkout sessions. Every one of those is a category name written for an
   * operator, and two of them — "collections" and price books — are named in
   * piggles/CLAUDE.md RULE #3 as terms a person must never be made to learn.
   *
   * Two were worse than jargon. `finance.subscription` was titled "Your sparx
   * bill" and `platform.settings.modules` sat under a section called "What sparx
   * does" — the product's own name, in the navigation, under another brand.
   *
   * ── WHAT MAY GO IN HERE ───────────────────────────────────────────────────
   *
   * The same contract as `copy`: whole names, written by a person in the brand's
   * voice, never a mechanical substitution. A screen's name is the shortest copy
   * in the product and the most read, so it gets the same care as a sentence.
   *
   * Applies to STATIC titles only. A surface whose title is a function is naming
   * a RECORD — "Order #1043", the customer's own words — and that is the
   * tenant's data rather than the platform's vocabulary. Renaming it is not a
   * thing a brand should be able to do, so the function always wins.
   */
  surfaceTitles: Readonly<Record<string, string>>;
  /**
   * What this product calls each GROUP HEADING inside a nav panel, keyed by the
   * platform's own section string.
   *
   * Keyed by the string rather than by `module.section` on purpose: the platform
   * ships "Setup", "Set up", "Setting up", "Settings" and "Reports"/"Reporting"
   * as separate strings meaning the same thing in different modules, and one
   * override per string lets a brand collapse them into one word everywhere at
   * once. A section name that genuinely means two different things in two
   * modules is a reason to rename it upstream, not to key this differently.
   */
  sectionTitles: Readonly<Record<string, string>>;
  /**
   * The brand's ARTWORK for a pane state, or `null` to keep the platform's
   * tinted glyph.
   *
   * ── WHY THIS IS ITS OWN FIELD AND NOT `LoadingMark` ───────────────────────
   *
   * `LoadingMark` is the brand's MARK — a logo, shown while something loads.
   * This is a picture of a SITUATION, and the two want different art: the right
   * answer for "this list is empty" is not a smaller logo.
   *
   * ── WHAT IT REPLACES ──────────────────────────────────────────────────────
   *
   * silica's `EmptyState` renders its icon inside a chip, and that chip is
   * colorless by design. The platform's answer is to tone the glyph per state
   * (error red, no-results amber, first-run the app's hue), which is a real
   * improvement over five identical grey pictures — but it is still five
   * identical PICTURES, told apart by a color.
   *
   * A brand that has a character can do better: the pose says it. Thinking for a
   * failure, resting for a quiet inbox, celebrating for a finished queue. So
   * when this is set the chip is replaced outright rather than decorated —
   * a mascot inside a faded grey chip would be the worst of both.
   *
   * Small on purpose at every call site. This appears in a pane a person is
   * trying to work in, and a character that fills the region is a mood board
   * rather than a state.
   */
  StateArt: ComponentType<ProductStateArtProps> | null;
}

// The resting state, before lib/console/product.tsx configures it at module
// scope. `name` used to read 'sparx' here — the platform's default, carried in
// by the fork — which meant the one string that says the product's name out loud
// named a DIFFERENT product for however long a mis-ordered import left this
// unconfigured. There is no ordering in which 'Piggles' is the wrong answer in
// this application, so it is the default.
const adapter: ProductAdapter = {
  name: 'Piggles',
  moduleLabels: {},
  LoadingMark: null,
  hiddenSurfaces: new Set(),
  copy: {},
  hiddenFeatures: new Set(),
  surfaceTitles: {},
  sectionTitles: {},
  StateArt: null,
};

/** Point the shared surfaces at a brand. Call once, at module scope, from the
 *  shell — before the first render, and never conditionally. */
export function configureProduct(next: Partial<ProductAdapter>): void {
  Object.assign(adapter, next);
}

/** The product's name, for the few shared strings that say it out loud. */
export function productName(): string {
  return adapter.name;
}

/** The brand's name for a module, or `undefined` to use the platform's. */
export function productModuleLabel(module: WorkbenchModule): string | undefined {
  return adapter.moduleLabels[module];
}

/** The brand's loading mark, or `null` to use the platform's. */
export function productLoadingMark(): ComponentType<ProductLoadingMarkProps> | null {
  return adapter.LoadingMark;
}

/** Whether this product hides a surface outright. See `hiddenSurfaces`. */
export function productHidesSurface(key: string): boolean {
  return adapter.hiddenSurfaces.has(key);
}

/**
 * This brand's wording for `key`, or the surface's own if it has not written one.
 *
 * The fallback is REQUIRED and is the sparx text, kept inline at the call site.
 * Two reasons it is not a lookup table of its own: the shared surface stays
 * readable as prose to whoever maintains it, and a brand that has written no
 * override renders a true sentence rather than a key or a blank.
 */
export function productCopy(key: string, fallback: string): string {
  return adapter.copy[key] ?? fallback;
}

/**
 * The same, for a sentence that has values in it.
 *
 * A template literal cannot be handed to `productCopy` — by the time it is a
 * string the values are already baked in, so a brand override would have to
 * reproduce them. Instead the brand writes `{name}` placeholders and passes the
 * values here:
 *
 *   productCopyWith('modules.disable', `${name} stops working…`, { name })
 *
 * A placeholder with no matching value is left alone rather than blanked, so a
 * typo in an override shows up as a visible `{nmae}` in the sentence instead of
 * silently deleting a word.
 */
export function productCopyWith(
  key: string,
  fallback: string,
  values: Record<string, string | number>
): string {
  const template = adapter.copy[key];
  if (!template) return fallback;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match
  );
}

/**
 * Whether this product hides a block inside a shared surface.
 *
 * Named per block, not per surface — `commerce.channels.market` rather than
 * `commerce.product.channels` — because the surface stays and only the block
 * goes.
 */
export function productHidesFeature(key: string): boolean {
  return adapter.hiddenFeatures.has(key);
}

/** This brand's name for a screen, or `undefined` to use the platform's. Only
 *  consulted for STATIC titles — see `surfaceTitles`. */
export function productSurfaceTitle(surfaceKey: string): string | undefined {
  return adapter.surfaceTitles[surfaceKey];
}

/** This brand's name for a nav group heading, or `undefined` for the
 *  platform's. */
export function productSectionTitle(section: string): string | undefined {
  return adapter.sectionTitles[section];
}

/** The brand's picture for a pane state, or `null` to keep the platform's tinted
 *  glyph. See `StateArt`. */
export function productStateArt(): ComponentType<ProductStateArtProps> | null {
  return adapter.StateArt;
}
