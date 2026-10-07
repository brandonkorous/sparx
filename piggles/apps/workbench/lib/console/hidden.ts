// Whole screens, and blocks inside shared screens, that this console does not have.
//
// Data only, in its own file for the same reason as ./copy.ts and
// ./vocabulary.ts: a list somebody revises should be findable without reading
// the wiring, and a rule that is pure data can be tested without rendering
// anything (hidden.test.ts).

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
export const PIGGLES_HIDDEN_SURFACES: ReadonlySet<string> = new Set([
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

  // sparx's SETUP FLOWS: the story canvas and the step-by-step switchboard.
  // Setting a business up is getpiggles' job (piggles/CLAUDE.md, "The three
  // surfaces"), and every Piggles business has been through it before this
  // console exists for them: it names the business, picks the trade and lays
  // down a design. So `SetupGate` found every one of them "already set up",
  // including a business made a minute earlier (issue 935), and the launcher
  // offered two doors onto a screen saying the door was closed. What a new
  // owner searching "set up" wants is `workbench.welcome`, which stays.
  'workbench.onboarding',
  'workbench.onboarding.story',
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
export const PIGGLES_HIDDEN_FEATURES: ReadonlySet<string> = new Set([
  'commerce.channels.market',
  'commerce.payments.sparx_pay',
]);
