'use client';

// Everything this console says about itself, in one place.
//
// ── WHY A SEAM WHEN THE APP OWNS ITS OWN SURFACES ───────────────────────────
//
// This app owns its ~500 surfaces outright (piggles/CLAUDE.md RULE #0), so in
// principle every one of them could simply be edited to say "Piggles". The seam
// survives the fork anyway, because the problem it solves is not ownership:
//
//   • ~220 screen NAMES and several hundred SENTENCES would each have to be
//     found and edited by hand, and the next platform improvement merged in from
//     upstream would quietly undo the ones it touched.
//   • A wording decision made in one file is a decision somebody can revise. The
//     same decision spread across four hundred files is a decision nobody can
//     find, let alone revise.
//   • The surfaces stay readable as PROSE to whoever maintains them, because the
//     fallback sitting inline at the call site is a real sentence rather than a
//     lookup key.
//
// So: the surfaces carry the platform's original wording as their fallback, and
// everything Piggles says differently is written here and in ./copy.ts,
// ./vocabulary.ts and ./state-art.tsx.
//
// ── WHAT IT CARRIES ─────────────────────────────────────────────────────────
//
//   name            the product's name, mid-sentence
//   moduleLabels    what each module is called, derived from the app registry
//   LoadingMark     the mark shown while a pane loads
//   hiddenSurfaces  whole screens this product does not have
//   hiddenFeatures  a block inside a screen this product does not have
//   copy            whole sentences, written by hand
//   surfaceTitles   what every screen is called
//   sectionTitles   what every nav group heading is called
//   StateArt        the mascot, posed to the pane's state
//
// Imported for its side effect from components/console-providers.tsx AND
// components/console-shell.tsx, at module scope, so it has run before the first
// render and before the surface catalog. Two import sites of one side-effect
// module is correct: ES modules evaluate once.

import { configureProduct } from '@/lib/product';
import type { ProductLoadingMarkProps } from '@/lib/product';
import type { WorkbenchModule } from '@/components/module-scope';
import { APPS } from '@piggles/config';
import { Mark } from '@piggles/brand/react';
import { PIGGLES_COPY } from './copy';
import { PIGGLES_SECTIONS } from './section-names';
import { PIGGLES_SURFACES } from './vocabulary';
import { PigglesStateArt } from './state-art';

/**
 * Module names, DERIVED from the app registry rather than restated here.
 *
 * The lexicon already exists — every Piggles app declares the platform modules
 * it fronts (`PigglesAppDef.modules`), so "the CRM module is called Customers"
 * is a fact the registry already holds. Writing it out a second time would give
 * the rail and the shared surfaces two sources that drift, and the drift would
 * show up somewhere nobody looks, like a permissions matrix.
 *
 * One app routinely fronts several modules — Sell is commerce + B2B + dropship —
 * and every one of them takes the app's name, which is the point: a Piggles user
 * has never heard of "dropship" and should not meet the word in a settings
 * table.
 */
const moduleLabels: Partial<Record<WorkbenchModule, string>> = Object.fromEntries(
  APPS.flatMap((app) => app.modules.map((module) => [module, app.label]))
);

/**
 * The pig-snout P, sized by class. `currentColor` throughout, so it takes the
 * ink of whatever it is dropped into and needs no per-theme variant — which is
 * why `tone` is accepted and deliberately unused.
 *
 * `piggles-mark-breathe` is the slow 4%-over-three-seconds scale defined in
 * globals.css, and it is not decoration: this mark is what a person looks at
 * while they wait, and something that breathes reads as patient where something
 * static reads as stuck. It was lost for a while when a second copy of this
 * adapter appeared without the class — see the note on `lib/product-adapter.tsx`
 * being deleted.
 */
function PigglesLoadingMark(_props: ProductLoadingMarkProps) {
  return <Mark className="piggles-mark-breathe text-primary h-16 w-16" title="Loading" />;
}

/**
 * Shared surfaces that are about a sparx PRODUCT rather than a capability.
 *
 * `commerce.market` is registered with the literal title "sparx.market" and no
 * `listed: false`, so it was appearing in this console's Sell panel and in ⌘K —
 * a nav row naming another company's marketplace, which a Piggles customer
 * cannot join and has never heard of.
 *
 * It is HIDDEN rather than renamed on purpose. The other three fields translate
 * a surface into Piggles' words; this one cannot be translated, because there is
 * no Piggles marketplace to translate it to. Substituting the brand name would
 * invent "Piggles.market" — a product nobody can sign up for, which is a worse
 * lie than the leak.
 *
 * Add a key here only when the surface is about a product this brand does not
 * have. A surface that merely says "sparx" in its copy is a different bug with a
 * different fix: `productName()`.
 */
const hiddenSurfaces = new Set([
  'commerce.market',

  // What a business pays WizeWorks. `finance.subscription` is registered as
  // "Your sparx bill" under a section called "What you pay sparx", and there is
  // no Piggles screen to rename it INTO: platform billing deliberately lives on
  // getpiggles.com and never in the operating console (piggles/CLAUDE.md, "The
  // three surfaces"). The rail's plan card already says which phase the account
  // is in and links out to the one place allowed to talk about money.
  'finance.subscription',

  // Turning modules on and off, priced per module. Piggles has no module pricing
  // (RULE #2) and its answer to "what else is there" is the All apps door in the
  // rail — a list with no prices, where adding one is a tap. A settings screen
  // built around the other model would contradict it on the same account.
  'platform.settings.modules',

  // sparx's RESELLER PROGRAMME — referrals, commissions, tier, bootcamps, and a
  // listing in the sparx partner directory. Named in piggles/CLAUDE.md as a
  // sparx product, and the default for those is exclude.
  //
  // Note what this does NOT remove. Piggles HAS a Partners app; it is about the
  // reader's own suppliers, exactly as meetpiggles.com/apps/partners describes
  // it. The app used to front this module by mistake, so somebody clicking
  // Partners for their suppliers got another company's affiliate scheme. It now
  // fronts the supplier and purchase-order surfaces instead — see `claims` in
  // @piggles/config.
  //
  // Hidden as a NAMESPACE, not as seven keys. The seven were written out once and
  // the eighth — `partner.bootcamp.detail`, the bootcamps list's own editor — was
  // missed, so a Piggles business could deep-link into sparx's partner training
  // programme (issue #002). `partner.*` cannot miss the ninth.
  'partner.*',
  // ...and the tenant-side half of it: granting a sparx partner agency access.
  'platform.settings.partner',
]);

/**
 * Blocks inside a shared surface that belong to a sparx PRODUCT.
 *
 * Same rule as above, one level down (piggles/CLAUDE.md, "A sparx PRODUCT is not
 * a Piggles capability"): exclude, never rename, never ask.
 *
 *   commerce.channels.market      the "offer it on the sparx marketplace" card
 *                                 on a product's Channels tab. The rest of that
 *                                 tab — Etsy, TikTok Shop, your own site — is a
 *                                 real shared capability and stays.
 *   commerce.payments.sparx_pay   WizeWorks' first-party gateway, operated under
 *                                 the sparx brand. A Piggles customer cannot
 *                                 sign up for it, so listing it would be a row
 *                                 that opens onto a dead end. Every
 *                                 bring-your-own processor stays.
 *
 * If Piggles ever gets its own first-party gateway, this entry comes out and the
 * copy gets written — but that needs a real thing behind it, not a rename.
 */
const hiddenFeatures = new Set(['commerce.channels.market', 'commerce.payments.sparx_pay']);

configureProduct({
  name: 'Piggles',
  moduleLabels,
  LoadingMark: PigglesLoadingMark,
  hiddenSurfaces,
  // Written by hand, in Piggles' voice — see copy.ts for why this is not the
  // sparx sentence with the name swapped, and why it never becomes that.
  copy: PIGGLES_COPY,
  hiddenFeatures,
  // What every screen and every group heading is CALLED. The shortest copy in
  // the product and the most-read, written under the same rule as the sentences
  // above — see vocabulary.ts.
  surfaceTitles: PIGGLES_SURFACES,
  sectionTitles: PIGGLES_SECTIONS,
  // Piggles herself, in every empty, waiting and failed pane — small, and
  // posed to the state rather than tinted to it. See state-art.tsx.
  StateArt: PigglesStateArt,
});
