import type { PigglesAppId } from '@piggles/config';

// The shape of an app's marketing page. One file per app under this directory;
// `./index.ts` assembles them.
//
// SEPARATE FROM `@piggles/config` ON PURPOSE. That package is a product adapter
// the console imports; this is prose the marketing site renders. An app's `label`
// and `purpose` are product structure and live there. A headline is not.
//
// ── `alsoKnownAs` is the load-bearing field ──────────────────────────────────
//
// It lists what the rest of the industry calls this app. Two jobs:
//
//   1. Search. Somebody who already knows they need "inventory management
//      software" types exactly that. The page has to contain the phrase to be
//      findable at all, and these are the terms the satellite domains
//      (pigglescms.com and friends) are pointed at.
//   2. The argument. Printing the jargon and then not using it again for the
//      rest of the page IS the product's central claim, demonstrated instead of
//      asserted. Delete this field and the page becomes a feature list.
//
// It is the ONE sanctioned place on a Piggles surface where a technical term is
// allowed to appear (piggles/CLAUDE.md RULE #3 bans them "outside an explicitly
// advanced context" — a page whose subject is the translation is that context).
// Do not let the vocabulary leak from here into `does[]` or into a chapter.
//
// ── Accuracy ────────────────────────────────────────────────────────────────
//
// Every line in `does[]` and every chapter describes something the shared
// platform genuinely implements today. This site sells a real product to people
// who will hold us to it, so a capability that is planned but not built does not
// get a bullet. When in doubt, check the module's surfaces before writing the
// sentence. `connects` is held to a harder version of the same rule — see below.

/** One thing an app does, in the customer's language. */
export interface AppClaim {
  title: string;
  body: string;
}

/**
 * A named part of an app, for the apps too large for six bullets.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * Every app page used to carry exactly six bullets, whichever app it was. Stock
 * fronts 53 screens and Invoices fronts 3, and both got six sentences — so the
 * template was describing the template rather than the app, and the largest
 * capabilities were the worst served. Social posting is the case that made it
 * obvious: eight networks, seven screens and a two-way inbox, folded into three
 * bullets on a page about search, so a reader looking for social media software
 * found nothing that said so.
 *
 * A chapter is the fix, and it is deliberately NOT "more bullets". It is a part
 * of the app with a name a person would use — "Posting to social", "Wholesale",
 * "Buying it in" — so a big app reads as a few understandable things rather than
 * one long list. An app that six bullets genuinely covers has no chapters, and
 * adding them to make the pages match would undo the point.
 */
export interface AppChapter {
  /** A claim, in the customer's words. Never the chapter's category name. */
  heading: string;
  /** One paragraph on what this part of the app is for. */
  body: string;
  /** What it does. As many as the part genuinely has — not a fixed count. */
  does: AppClaim[];
  /**
   * Third-party services this part connects to, by their real names.
   *
   * ── WHY NAMING THEM IS THE POINT ──────────────────────────────────────────
   *
   * "Post to social without doing it eight times" is a true sentence that fails
   * the only test that matters: somebody deciding whether this product does what
   * they need is looking for the word Instagram. The platform ships eight
   * network adapters and the site named none of them, which reads — correctly —
   * as a product that has not built it.
   *
   * Held to a harder accuracy rule than the prose around it, because a logo
   * wall is the most-copied lie in software marketing. A name goes here only
   * when a Piggles customer can connect that service TODAY. Not planned, not
   * behind a flag, not "coming soon" in the catalog it is drawn from.
   */
  connects?: string[];
}

export interface AppMarketing {
  /** The page h1. A claim in the customer's words — never the app's own name
   *  restated, which tells a visitor nothing they did not know from the link. */
  heading: string;
  /** One paragraph under the heading. */
  lede: string;
  /** What everyone else calls it. See the note above — this field is the point. */
  alsoKnownAs: string[];
  /** What it does, in plain language. Six each: this is the app at a glance, and
   *  six is what fits the grid twice over. Depth goes in `chapters`. */
  does: AppClaim[];
  /** The parts of the app, for an app too large for six bullets. */
  chapters?: AppChapter[];
  /** Apps this one is routinely used with. Rendered as real links, because the
   *  claim "it all works together" is only credible if the site itself does. */
  worksWith: PigglesAppId[];
  /** Optional photograph. Only where a real picture adds something a diagram of
   *  the software would not — see public/photos/README.md. */
  photo?: { src: string; alt: string };
}
