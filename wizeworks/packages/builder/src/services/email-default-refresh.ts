// Refreshing an already-provisioned default email to the current shipped design,
// WITHOUT ever clobbering a tenant's edits.
//
// `provisionDefaultEmails` only ever CREATES the default rows a tenant is missing — it
// never touches a row that already exists. So a tenant provisioned before a default's
// body was redesigned keeps sending the OLD body forever. This module is the safe
// refresh: it recognises a row that is STILL the untouched shipped default (of any past
// version) and replaces its body with the current one; a row a tenant has edited is
// left completely alone.
//
// "Untouched" is decided by CONTENT, not a flag (BuilderEmail carries no edit marker):
// a pristine row's stored body is byte-identical — modulo node ids — to a shipped
// default. `bodyFingerprint` strips the ids and hashes the rest, so every tenant
// provisioned from the same code hashes the same, and the first edit changes the hash.
// `PRIOR_DEFAULT_BODY_FINGERPRINTS` is the set of every past shipped body per key; a row
// whose DRAFT and PUBLISHED bodies BOTH hash into it is safe to replace.
//
// Going forward: when a default body is redesigned again, add the OUTGOING body's
// fingerprint to that key's set here (never remove one) so every historical pristine
// version stays recognised. Regenerate with the same id-stripped canonical sha256 the
// `canon`/`bodyFingerprint` below compute.
//
// That rule was kept by hand, and it slipped: the 2026-09-16 wording sweep changed
// almost every body and appended nothing, which left 870 untouched rows in dev on old
// wording (persona issue 919). So `email-default-history.json` now lists every body
// each default has shipped, oldest first, ending on today's. The test fails when a
// body changes until its outgoing fingerprint is here AND appended to the history, and
// fails when a body in the history is missing here.
//
// A BRAND-NEW template gets an explicit EMPTY set. It has only ever had one body, so
// there is nothing to roll forward from — and its current fingerprint must NOT go in,
// or the refresh would treat an already-current row as stale and rewrite it on every
// pass. Empty is a decision; missing is an oversight, and the test tells them apart.

import { createHash } from 'node:crypto';
import type { SilicaEmailDocument } from '@wizeworks/builder-schemas';

/** Strip every `id` (the only per-provision-varying field) and sort object keys, so two
 *  structurally-identical bodies serialise identically regardless of node-id minting. */
function canon(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v).sort()) {
      if (k === 'id') continue;
      out[k] = canon((v as Record<string, unknown>)[k]);
    }
    return out;
  }
  return v;
}

/** The id-stripped canonical fingerprint of a document's BODY (its `root.children` — the
 *  authored sections; the header/footer frame is composed at send time and never stored).
 *  Subject/preheader are deliberately excluded: they're mirrored on the row and a body
 *  redesign leaves them unchanged, so the body alone is the edit signal. */
export function bodyFingerprint(doc: SilicaEmailDocument): string {
  const children = doc.root?.children ?? null;
  return createHash('sha256')
    .update(JSON.stringify(canon(children)))
    .digest('hex');
}

/**
 * Every PRIOR shipped default body, by template key, as a set of id-stripped
 * fingerprints. A stored body that hashes into a key's set is the untouched shipped
 * default of some past version; anything else is a tenant edit (or already the current
 * design) and is left alone.
 *
 * Seed set (2026-07-26): the pre-redesign bodies — the design shipped before the
 * transactional-email redesign. APPENDED (also 2026-07-26): the redesign bodies as they
 * shipped BEFORE the block-spacing fix (`copyBlock` now spaces its children) — i.e. what
 * every tenant provisioned since the redesign is holding, so the spacing rolls out to
 * them too. Every shipped default key is covered (the P1–P5 additions included). Per the
 * rule, fingerprints are only ever appended here, never removed.
 */
export const PRIOR_DEFAULT_BODY_FINGERPRINTS: Record<string, ReadonlySet<string>> = {
  'welcome-customer': new Set([
    'f0bab7ccfdcd7821f8bbc8385faa7c08beb000889cc6ae4a01c92272e0342308',
    '5e068708036c840526d04d75509e26b2a02229543c5567f3ff4df06d36dbaba2',
    // Outgoing (2026-07-29): the sparse "heading + para + button" welcome that was the
    // last SHIPPED default, replaced now by the module-aware orientation body (a
    // `featureList` + per-module `moduleFeature` cards). Append so pristine tenants refresh.
    '9e617bb9b2a8265fb8ccb6240ac799188470f2956dfcab622c6a9de3683940c9',
    // Outgoing (2026-08-11 email redesign): the module-orientation body BEFORE the
    // content rail — replaced now by the same + a CMS-gated "Fresh from …" content rail.
    'ef13a8e8b2411f3237b321213dd441ada811166b257582dff047d9baf65c9bc9',
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // e67dc14ad (2026-07-26) through 9177c0242 (2026-07-27), until 01481f53d (2026-07-29):
    '0d7178e5aa1c8df6f845d7d3227269e92c51a3a6c97de13952bedf283d7e1284',
    // 788298f62 (2026-07-29) through 475d3e695 (2026-08-04), until 5151ec196 (2026-08-07):
    'dd409b6d496d12e00258bbc1fe1b1c1fa66e75481c735120e3afa62fe41cb4c1',
    // 62b77fb02 (2026-08-11) through 5e402a0a8 (2026-08-24), until 851aa54d6 (2026-09-16):
    'a16e6034f69a128bff0da8c1eee7a4a627f3eb5491f62b72f7cd90be258d91f2',
  ]),
  'win-back': new Set([
    'ef8658cbd7ce2f8cb29c1d7065dab56b38ddd8528bf8949c9c9090c7fc01f183',
    '62079f2868e75c7fdaa218e0e73c304276ccaa09a20fb0a57e87406c7d7a8be4',
    // Outgoing (2026-08-11 email redesign): the bare "heading + para + button" win-back,
    // replaced now by the same + a CMS-gated content rail (fresh stories re-engage).
    '40ba0e44f634fa0a1405d72a162a01185e34099466138829fb686cef5ff2cefe',
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // e67dc14ad (2026-07-26) through 475d3e695 (2026-08-04), until 5151ec196 (2026-08-07):
    '2d4cc3f23188cbbc2b6a1f5c7f3dc6e1af48cbe68dbcd369286af7fcb2e732d0',
    // 62b77fb02 (2026-08-11) through 5e402a0a8 (2026-08-24), until 851aa54d6 (2026-09-16):
    '9d9f6c3b3b490cb6b48694747523d4dee22defeb02fb7ca130d0ae7f788c8c3e',
  ]),
  'abandoned-cart': new Set([
    'c43ddf1e78a48270f73e43c9297f98f5ad7fe78dfe6c48769c7213cf0f3f83ab',
    '650b5c77a6c80d7978311f2fb437e7e997fc800bc833cd437f03bdb78bf466e2',
    // Outgoing (2026-08-11 email redesign): pre-thumbnail body, replaced now by product
    // thumbnails on the cart line items + a "You might also like" cross-sell rail.
    '2a8998435942d33c9433830afee08cf444e2b1893592d09ab15dde1b34fdc163',
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // 62b77fb02 (2026-08-11) through 5e402a0a8 (2026-08-24), until 851aa54d6 (2026-09-16):
    'fed9f856f7af3ecc9ee7d812719a8e089e978c564daf2261d0619ba93d2c7105',
  ]),
  'post-purchase-review': new Set([
    '7dda0d718e85cc2c11313fb63f3fa3a5d87aa4438d24eea9008c1a8069413271',
    'e3b0908f24f3139e2a09088304fcdc98b8cd24bf98021b5c25d0d42fc9faa581',
    // Outgoing (2026-07-29): pre-cross-sell body, replaced by the same + a commerce-gated
    // "More to explore" cross-sell (marketing send, rides under the unsubscribe footer).
    '820b636ac7f2d0b088f4d938734dda68ae55ce94186c36558d3e78d157608ec8',
    // Outgoing (2026-08-11 email redesign): pre-thumbnail body, replaced by product
    // thumbnails on the reviewed line items.
    '566cc3887c2e25670ab4ab1a61fcb7869b54331f8491fd97883b43365f0d890a',
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // 788298f62 (2026-07-29) through 475d3e695 (2026-08-04), until 5151ec196 (2026-08-07):
    'a29ae5ca1a3da37c8d6d80b27f9fb755feba4752d2a9bf88c94ffc91ba8b6026',
  ]),
  'b2b-account-approved': new Set([
    '441bf1990f64208d59bebe4fd11e905bf8e1828766e4a9414b142992d456dd3c',
    '760ba43438870e3cb8492c739a6b04badc29cd630e180654f6eb00b273825a3a',
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // e67dc14ad (2026-07-26) through 5e402a0a8 (2026-08-24), until 851aa54d6 (2026-09-16):
    '78c799737a6a34ffc6df8bf0a39ab08fa24e6793c958578475e91984806cafb6',
  ]),
  'b2b-quote-received': new Set([
    'a499c9523e3f9f290ecdf7bfeebca52eebe394d59a3f05072eb4c9a9c53901d1',
    'a87adec01e4d2bf760469fd245b072a5a29b4d4536522525412927f130beaaa8',
  ]),
  'b2b-invoice-due': new Set([
    '85a3c8839930e20b0fa0151d2b8ca8d73e9a4a2d0b1202cca40b0c524d2c957e',
    '083da5f21ae88b77d41b8d81aa299ba3674fb6fe38d2248fec3266bbb1255e0d',
  ]),
  'b2b-quote-expiring': new Set([
    'aefeec5abf93f72567f8b76d5cb46cb92efdaa2eef0a29cb603bcd1212b511a4',
    '93db2c145ad0c0798377ab2c0dd7ad853ee73ca6180dce10b04db6e6525366cc',
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // e67dc14ad (2026-07-26) through 5e402a0a8 (2026-08-24), until 851aa54d6 (2026-09-16):
    '42a79ccc64baafd91fbd540b49e924aeb75fb81a815fce4b79c453e594a55efd',
  ]),
  'invoicing-reminder': new Set([
    '46b9d6105ab16f7d4eb50251653b1edcf41d31b38483c1cc7cf43441988f2e28',
    '0a3dfa7b575c880242d9287167c5ce83f344262c50f0f4eed7b6e73bef59e8c2',
  ]),
  'invoicing-overdue': new Set([
    'fe853edb1970b843a3f225ed12ffae750c8f8cb4022ef842eeb4c3e546ac4962',
    '03b3faa55e7925fe95c5d734a60cd85819177cfcda05e2229c730ea7f3925eea',
  ]),
  'invoicing-overdue-2': new Set([
    'bfbe0e4ed804ef9df1404e59bca2525f1c89a45621c95f88ef06bde5e55b024d',
    'c28abc8212ab3d2689b527b62e52af88b63fb0bea53300edf4d70ddf513e9a57',
  ]),
  'invoicing-overdue-final': new Set([
    'c1e4513b4182d5f479b04af2c025faad1c5b190f7c3d4c7959f69b43eee58064',
    '549b4b6ac7c278f22cdeae890c2a52723efa03ae2ff59c51ec383f428e6709c9',
  ]),
  'invoicing-receipt': new Set([
    'e042ec5c9968ae990c6c3c561c38deeab1cf1df7cd1aae613cfb3d70cc43b613',
    '9219ccf27e555e17b13050a77e65ba86d3b3856009f92d3f1b91f9abbed3e92f',
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // e67dc14ad (2026-07-26) through 5e402a0a8 (2026-08-24), until 851aa54d6 (2026-09-16):
    'b757b2d42f047fac502317749e8598b9c5f4702477b012d80d94a4208dd4e071',
  ]),
  'chat-satisfaction': new Set([
    '44ef6343f808e6d01e02f6cd1bc4a570ac6c169afa4fa84a0868ab039fe26481',
    '45f8bc21409386d2247a3b4fa339343dc6f01f8219a907868ae772abad13b113',
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // e67dc14ad (2026-07-26) through 475d3e695 (2026-08-04), until 5151ec196 (2026-08-07):
    'd965513c6a0904dbc2b05516b2ef22fcc27d09a671aa9b287d7bd288e39844cb',
  ]),
  'order-confirmation': new Set([
    'acccea740153987a3686c2d8f20f0a716fe05c3070b2219e51c500251b1680f3',
    'bfc3f25b44336ed6a4a26c5a192aa2bb01d30c896f6632ef4b6cd04ac1ba8550',
    // Outgoing (2026-07-29): pre-cross-sell body, replaced by the same + a single
    // commerce-gated "While you wait" nudge under the transactional content (CAN-SPAM
    // primary-purpose — the order is still the email's point).
    'fb1c69280d78ec34450b36aaaa2006e010543075fb8b53b666cca306999b5782',
    // Outgoing (2026-08-11 email redesign): the "While you wait" body, replaced now by
    // the full receipt — product thumbnails, a subtotal/shipping/tax/total cost summary,
    // a self-dropping ship-to card, and a "Pairs well with" rail.
    '20ac7029d9ba4bea9fa35e4bd603f04bac5401b3791ae64cf2dc6c870ea6f8e1',
    // Outgoing (2026-10-01, persona issue 064): every receipt body shipped since the
    // 2026-08-11 redesign, none of which was ever appended here, so a tenant on any
    // of them was never refreshed. Each one printed "Shipping to [object Object]"
    // and promised tracking to a customer collecting from the counter. Computed
    // from the shipped code at each commit, oldest first: the redesign itself
    // (62b77fb02, unchanged through 17743942f); + "Ready from" / "Due on collection"
    // (5e402a0a8, issue 026); the em-dash sweep (851aa54d6, unchanged at d1b4166fc);
    // + the refundable core deposit row (issue 051, never committed before this).
    // And one older gap found the same way: the body shipped 788298f62 (2026-07-29)
    // through 475d3e695 (2026-08-04), still held by 14 untouched rows in dev.
    '2aef252cb40e5a4263550b9563e7231a10ff24a8d8afc6f706c252423babbbb8',
    '716f0860b7fd1a17a5c9f3d1418ae9aeef052922ffcef4a289c2022d3eb28b84',
    'bf43e27847e614760c9d6b9c4e1326a4d4b654b9bcc02796ba7a7c945467a6af',
    'ed8cb5381a0afcee19d6d5639a335177dcd5a2ba9ccd254da3682d8f23f57bac',
    '1407b8ecb544a6ace2860f517f086f68fa13efbe91feb64ba9ba307dc131dce2',
    // Outgoing (2026-10-01, issue 064): the first pickup/delivery split, which still
    // promised "we'll let you know when it's ready to pick up" to a counter sale
    // already handed over. Never released, but the dev refresh put it on rows.
    'a29816b886fbe85b5205d40ed960bc213ee82c21cd4bb558775085892c6cdcbb',
  ]),
  'shipping-confirmation': new Set([
    'c9d48b50aaf7363fc5f029b24d1ec49476259ba20c7a29a746a47707d4162fdc',
    '488c49bdbb7abef2929bfc28e41648889527534cb7dd1576c760c2bf2019f223',
    // Outgoing (2026-08-11 email redesign): pre-thumbnail body, replaced by product
    // thumbnails on the shipped line items.
    'd1ea5c3abfeec15b164f3e7622afa9768c3a7183c01f09754c0488d2e366a454',
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // e67dc14ad (2026-07-26) through 475d3e695 (2026-08-04), until 5151ec196 (2026-08-07):
    'f6486c6a8f3934f29692f623682713d89f86027511b2799be52f8143e3533827',
    // 62b77fb02 (2026-08-11) through 5e402a0a8 (2026-08-24), until 851aa54d6 (2026-09-16):
    'db101f76cda9bcd87fb2f32549647c5888bb981d9ef2b458659ba2bae614bed8',
  ]),
  'order-delivered': new Set([
    '92833d0d5e436a08bf2fa8aea7036704d1e7892b8936e34a63865e1085a0ba23',
    // Outgoing (2026-07-29): pre-cross-sell body, replaced by the same + a commerce-gated
    // "Ready for your next find?" nudge (delivery is the natural re-purchase moment).
    '79be08e9f7e15517cd5e32b4db8741f7f6ec2749b842a61aad79ee527bbf4ed2',
    // Outgoing (2026-08-11 email redesign): the product-rail body, replaced now by the
    // same + a CMS-gated content rail ("While it's fresh") for content-and-commerce.
    '48e7eac39513db9790afa45cd27f4b16af5d8c3e021b00d646a93b1243f7ebdf',
    // Outgoing (2026-10-01, persona issue 064): the bodies that told a customer who
    // collected their order at the counter that it "has been delivered", replaced by
    // one that says "You picked up order …" for a pickup. The content-rail body as
    // shipped (62b77fb02 through 5e402a0a8), then after the em-dash sweep (851aa54d6
    // through d1b4166fc); neither had been appended. Plus the body shipped 788298f62
    // (2026-07-29) through 475d3e695 (2026-08-04), still held by 18 untouched rows in
    // dev, which had not been appended either.
    '5a9760f56f1e5e67faf360c1e13f178849e6f11ce6ba72f852c097664c9468e8',
    'd1acc230009aad6b3e219aedc6b56b66a89d7269d30e0df074b3e0e1cd2d9b67',
    '39c373a4d7518e64424dc474e6bec58430f0e1bf2c9fa19584d8299d5ae252af',
  ]),
  'order-cancelled': new Set([
    '1e15199075b2e949414fb79039ab1b41aaf432acc81a0b56499d79a3d625d990',
    // Outgoing (2026-09-19): the same body saying "cancelled". The console has
    // shown "Canceled" on the very same event since the status labels were swept,
    // so the email a customer got and the badge the owner saw disagreed. Append so
    // pristine tenants refresh onto the American spelling.
    'cd57be51c961359d651dc9bc6f968f51bc9f91b815e913f19cd45e98e9e7dbd6',
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // e67dc14ad (2026-07-26) through 475d3e695 (2026-08-04), until 5151ec196 (2026-08-07):
    '23add6118358b8e3af2d9ba06858fb8b6a57070d98daf7661a1e3bfdf2c21fbb',
    // 5151ec196 (2026-08-07) through 5e402a0a8 (2026-08-24), until 851aa54d6 (2026-09-16):
    '6b98f032ae2a84ef30a69a766e5ad168f6730de5efb184cadaa9607b00ffa8f6',
  ]),
  'order-refunded': new Set([
    'ecb62f9de7b8a7f3a735c8db9b8e958d3375a069844b5c8dd17cfbd0c05a60b6',
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // e67dc14ad (2026-07-26) through 475d3e695 (2026-08-04), until 5151ec196 (2026-08-07):
    '7b6cf0daadd0c9f274ac0f5c69d6b3d290ebfd68b268035db3a745aab2934130',
    // 5151ec196 (2026-08-07) through 5e402a0a8 (2026-08-24), until 851aa54d6 (2026-09-16):
    '21f6c12e7f7d6867979323b23742bb91c5269648ed049021c2f37fb68a88858a',
  ]),
  'payment-failed': new Set([
    '58d0a758e8855642c53cf4816d0334d347d13364b73793297b8e1911803d83f9',
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // e67dc14ad (2026-07-26) through 475d3e695 (2026-08-04), until 5151ec196 (2026-08-07):
    '15c880bc12404b842056d0f28310169569c5d84fcd9db44db63d2eb6d48ee6d9',
    // 5151ec196 (2026-08-07) through 5e402a0a8 (2026-08-24), until 851aa54d6 (2026-09-16):
    '9dfe5274badf419739d558bb65bd89881347822d5a3d30830fe1e97524995474',
  ]),
  'subscription-confirmed': new Set([
    '5dd348c4bac3402e19a914307bcdd92806fd897628cf979060d4c603bde61a9f',
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // e67dc14ad (2026-07-26) through 475d3e695 (2026-08-04), until 5151ec196 (2026-08-07):
    '95cd6aea2266f53f158e2c6a23b07533ef25fe5ecfd234e70c1503fe5d9abf88',
    // 5151ec196 (2026-08-07) through 5e402a0a8 (2026-08-24), until 851aa54d6 (2026-09-16):
    '3ca6d25456350b8e72c5a26ce53111a02df2751886d6cf42cedf0df653a8044a',
  ]),
  'subscription-renewed': new Set([
    '7cc2f44c0c81b39b4cb77173f11f481f62a1bc39dca97fd3c6528797832bc20c',
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // e67dc14ad (2026-07-26) through 475d3e695 (2026-08-04), until 5151ec196 (2026-08-07):
    '0d01639a6d2472cfda11922be2981cad1c84d563502705864e9bfdfd4906116b',
    // 5151ec196 (2026-08-07) through 5e402a0a8 (2026-08-24), until 851aa54d6 (2026-09-16):
    '79326e9fa0f2d50a5da8480cd8bb6f09248e3835396e935936e717b3a4f2aec6',
  ]),
  'subscription-payment-failed': new Set([
    'a4111c25fe70f06ad7a1478946b1b56fe01be80bb7d4cbabbae9e87fca66cca1',
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // e67dc14ad (2026-07-26) through 475d3e695 (2026-08-04), until 5151ec196 (2026-08-07):
    'ceb75c65401b5d874b42928c0f71a0187438296ce7b9063f9d2e74e753035fc8',
    // 5151ec196 (2026-08-07) through 5e402a0a8 (2026-08-24), until 851aa54d6 (2026-09-16):
    'e56454df776e517798c66cdb8c4414ad59bd192cf9433521c27ea18c3316df45',
  ]),
  'subscription-paused': new Set([
    '82d2689447e93f9e8705b703079005f39b5ed5d7463a50eae49b0f8f142aaaaa',
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // e67dc14ad (2026-07-26) through 475d3e695 (2026-08-04), until 5151ec196 (2026-08-07):
    'ee3c1244380f2d144ffcdc8426b1a9c67f5cbf0fa242db9717a43c2cb697e13e',
    // 5151ec196 (2026-08-07) through 5e402a0a8 (2026-08-24), until 851aa54d6 (2026-09-16):
    'e235787f03bdcda525dea68fb215bf9c11e2bc8cc0f373464328543b5a29eb29',
  ]),
  'subscription-resumed': new Set([
    'a41c20ab6d9d77d7331fb54fff4029278739ffa9f968530350cdb75f799ed0ac',
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // e67dc14ad (2026-07-26) through 475d3e695 (2026-08-04), until 5151ec196 (2026-08-07):
    '8d6841e747ac2b197bdd44bb53ca4054c9fa4981e4a59154cb020c889145fd0a',
    // 5151ec196 (2026-08-07) through 5e402a0a8 (2026-08-24), until 851aa54d6 (2026-09-16):
    'b2d18d7426ef3172dd088009c8443b31d7e3230340d7669631a2008ba25fc830',
  ]),
  'subscription-cancelled': new Set([
    'c333f2db91a160f9e2efb37985961d4da5e7f3494d765135ee32f731977053db',
    // Outgoing (2026-09-19): the same body saying "cancelled". The console has
    // shown "Canceled" on the very same event since the status labels were swept,
    // so the email a customer got and the badge the owner saw disagreed. Append so
    // pristine tenants refresh onto the American spelling.
    'f50fcbcc8494e352c0be930ae72a193a2c5ddc6d9e1a6bd242e097488a86ea03',
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // e67dc14ad (2026-07-26) through 475d3e695 (2026-08-04), until 5151ec196 (2026-08-07):
    '9e0af426c643fc547adab614a003d559c8147efd4c704faa4dee155fb41ee0ed',
    // 5151ec196 (2026-08-07) through 5e402a0a8 (2026-08-24), until 851aa54d6 (2026-09-16):
    '2e739dac0b05607156ca5f71c1f64bcbb94b48da354d2f1994ca2e432b4d7ab6',
  ]),
  'return-approved': new Set([
    '530dd0e43444ee9645b702fd33ef423b972ae5aa214ce0345f6935971c3e99a2',
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // e67dc14ad (2026-07-26) through 475d3e695 (2026-08-04), until 5151ec196 (2026-08-07):
    '7a127da3f0ff2c09123b54858bab135c2f987dd082eee964e9861140b2f8ea0e',
    // 5151ec196 (2026-08-07) through 5e402a0a8 (2026-08-24), until 851aa54d6 (2026-09-16):
    '960ea98ff8e22880df35dd9b25e6ccea7fcfcaa913955f38a8ede04338e29232',
  ]),
  'return-received': new Set([
    'ffbc6d93cca341490c35be643f1f261ce304c543a6e5d74a73bd8e86370b4f7e',
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // e67dc14ad (2026-07-26) through 475d3e695 (2026-08-04), until 5151ec196 (2026-08-07):
    '03f190ecb9565d6e391ce979e9406be26c1908fa325219616d130332594fd9dd',
    // 5151ec196 (2026-08-07) through 5e402a0a8 (2026-08-24), until 851aa54d6 (2026-09-16):
    '607b7bfc7c36649228d18ed95552b7bf195b4cfa261f2859a18856aa245dbcb2',
  ]),
  'return-refunded': new Set([
    'fa810aec0d201b0aef078620fa40ec23a47bed247aa9ce4dc9ae7c44fc665524',
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // e67dc14ad (2026-07-26) through 475d3e695 (2026-08-04), until 5151ec196 (2026-08-07):
    '86045f3dfc4b97d26c6ac21d24cd5954729779a89ce3ec4a82c0e187f2ef8886',
    // 5151ec196 (2026-08-07) through 5e402a0a8 (2026-08-24), until 851aa54d6 (2026-09-16):
    '272901407ad080014a12ed9fa84dcc3ca64b2976821ec0c2c7bb510cd4f8605a',
  ]),
  // New in 2026-09 (persona issue 448). They were committed with one body each,
  // and were once listed empty for that reason, but the dev database had already
  // copied an earlier one.
  'return-exchanged': new Set([
    // Found missing (2026-10-06, persona issue 919): the body with an em dash
    // after the greeting. The dev database copied it to every business on
    // 2026-09-08 and 09-09, a week before the sweep (851aa54d6) replaced it.
    // Never committed, so read from those rows (24 rows, all identical).
    'fe2b6db832a19db20d6b883a7b21e7394573ee61140af17211348a998f87ed1d',
  ]),
  'return-replacement-shipped': new Set([
    // Found missing (2026-10-06, persona issue 919): the body with an em dash
    // after the greeting. The dev database copied it to every business on
    // 2026-09-08 and 09-09, a week before the sweep (851aa54d6) replaced it.
    // Never committed, so read from those rows (25 rows, all identical).
    'd988bca26c55b55da33493f903a572d999cfdb690e428f90d0fc35b42faeeaad',
  ]),
  'return-denied': new Set([
    // Found missing (2026-10-06, persona issue 919): the body with an em dash
    // after the greeting. The dev database copied it to every business on
    // 2026-09-08 and 09-09, a week before the sweep (851aa54d6) replaced it.
    // Never committed, so read from those rows (25 rows, all identical).
    '827c0185ba86aca586fee00c0a94a7868502f890bc3b312fc97295d4e5409bdf',
  ]),
  'b2b-order-approved': new Set([
    'fc09aded0e05d7213355165dd0bf3f8c77039e682c2ea42bb2edcf2a0fbbc38b',
    // Found missing (2026-10-03, sparx persona issue 087): the body shipped from
    // the tree move (17743942f) until the em-dash sweep (851aa54d6), "Hi … — order
    // … has been approved", never appended, so a tenant still on it was never
    // refreshed. Computed with today's kit, which has not changed since.
    '4d0e35c65f33518517213e00b984b6c9b85a6628b14ddac739389dd553eb3a5f',
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // e67dc14ad (2026-07-26) through 475d3e695 (2026-08-04), until 5151ec196 (2026-08-07):
    '14013c90b8718217fd694cbe4102e84c74664a53857de742d43190e9fcfd01b1',
  ]),
  'b2b-order-rejected': new Set([
    '5a521482b7f1a9b1c214285d48404920fa1bfcbd4df913f9c9525b99683ef995',
    // Outgoing (2026-10-03, sparx persona issue 087): the bodies that told the
    // buyer nothing about who turned the order down or why, and sent them to
    // their account manager even when the no came from their own colleague.
    // The em-dash body (17743942f until 851aa54d6), never appended, then the
    // colon body that replaced it.
    'a36ea61f9a1c1edef74b6ef6d00f1bb8e76fdf4ba9e64c196556fa7f32d3f9b8',
    '842bba138d62324d3cd75c07f8479ed23255aec8dc220f4140aba7e5579c8334',
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // e67dc14ad (2026-07-26) through 475d3e695 (2026-08-04), until 5151ec196 (2026-08-07):
    '8b972f373395e32180618105cd8dae603f9b28120b9ae9b73cbe632e3d815a99',
  ]),
  'booking-confirmation': new Set([
    '5cd91e9ae085185fe763833e62d1b62dd05e2d559f4edfe2b5495ae436117e42',
    '6815acdc436177354efca9ca26aa2973c3c4b14392051464c8ae6b1b6ee98772',
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // e67dc14ad (2026-07-26) through 475d3e695 (2026-08-04), until 5151ec196 (2026-08-07):
    '4d9f1002649eda66c7c464bafaf7191adeb95afa177de5417d0e4b1cd2159157',
    // 5151ec196 (2026-08-07) through 5e402a0a8 (2026-08-24), until 851aa54d6 (2026-09-16):
    'b4b723e8021c8fbdd2b907e6bd4b52894ba9a43057ad922ac080ad0d74dfc8a6',
  ]),
  'booking-reminder': new Set([
    'b60bcda1f3663363784f7992a24f44d7630603ef861b860bed805ae078c4f405',
    '910192efb85ec9a543281abf0fd6be724cd68889c9b7dfd3b999b17065f367f2',
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // e67dc14ad (2026-07-26) through 475d3e695 (2026-08-04), until 5151ec196 (2026-08-07):
    'b63a55a5d84ee08e44f555e984bb9a51f21c30f65633b4b2c77b33c0070a07ad',
    // 5151ec196 (2026-08-07) through 5e402a0a8 (2026-08-24), until 851aa54d6 (2026-09-16):
    'a83ef51eb4271e2af8b16fda02d5ffa47777ff7302f3e6d159c8408862a41e2e',
  ]),
  'booking-rescheduled': new Set([
    '9ec84928a1821078bf0d4ad19c160c935ee5d8853ad15ecb028b2c4397907be9',
    '5bc7e763b232eeda654b221f922b9e96db579c5a84052e2671a66a05921cb857',
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // e67dc14ad (2026-07-26) through 475d3e695 (2026-08-04), until 5151ec196 (2026-08-07):
    'de5714691b8470cc27547604953af81cd40d6f8f7cdf1d6c67f2de170a864b0e',
    // 5151ec196 (2026-08-07) through 5e402a0a8 (2026-08-24), until 851aa54d6 (2026-09-16):
    'd8543fc1a9eacba8dc340f101039d4b891feaae7999a9c1f29457e2a715be84d',
  ]),
  'booking-cancelled': new Set([
    '6d098a4219d4f1730c2772edb6e459010553b1118b6c6d7b67bb236ebfea9438',
    '499671514f40a576eae94ee230818484478f6a822a3da3368656dda533c6eb99',
    // Outgoing (2026-09-19): the same body saying "cancelled". The console has
    // shown "Canceled" on the very same event since the status labels were swept,
    // so the email a customer got and the badge the owner saw disagreed. Append so
    // pristine tenants refresh onto the American spelling.
    '94a8710e7b9af518a54c6b636809cbe74b51ff129a65059a6553e9ab0de11a08',
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // e67dc14ad (2026-07-26) through 475d3e695 (2026-08-04), until 5151ec196 (2026-08-07):
    'e6523a634c4fdc888522631cdf8b24d32984e532e99ba379b3bac11649302676',
    // 5151ec196 (2026-08-07) through 5e402a0a8 (2026-08-24), until 851aa54d6 (2026-09-16):
    'e1248588503ee1c3a4a722656d22443877fb2a43c590831aef69efa56a3b19e6',
  ]),
  'waitlist-offer': new Set([
    'c37718b0aa2622d42c21d3b9e2a2f9b766897b772d791ad9e016a0e17ed8fee7',
    '3d2186a0e3509b4481d83333e1bc951aded5e128987ef0805ed7c9ab406c356d',
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // e67dc14ad (2026-07-26) through 475d3e695 (2026-08-04), until 5151ec196 (2026-08-07):
    '0063d0f605d8940e47b24d857d4844535c55baf0c97bf14675c9f13a7b943a32',
    // 5151ec196 (2026-08-07) through 5e402a0a8 (2026-08-24), until 851aa54d6 (2026-09-16):
    '2bb659bed9405b8eb70c66a4f48414fcdb7a5aaebe0eab05e717cf6922290122',
  ]),
  'booking-notification-internal': new Set([
    '215265b902cace174300b7d3b585c14b2eefde9056ed40f114fd87a9e4be2476',
    'f476ab97f48041ac8b64592b87f9849190951997e641d9f3c041a3e193156833',
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // e67dc14ad (2026-07-26) through 475d3e695 (2026-08-04), until 5151ec196 (2026-08-07):
    'ca965838aedf69ea8887926c6628d411a19252bf1b62bd612338ecd8f21a6c58',
    // 5151ec196 (2026-08-07) through 5e402a0a8 (2026-08-24), until 851aa54d6 (2026-09-16):
    '20c39a55ea20f4723921fd85032903b33fb97706c3f782e4ab424972660cde7e',
  ]),

  // ── docs/142 ────────────────────────────────────────────────────────────────
  // These two were listed EMPTY, as "only ever had one body". They had three:
  // the code shows two earlier ones, and 25 businesses in dev were still on them.
  // That is why `email-default-history.json` now holds every body each default
  // has shipped, and the test checks this list against it instead of trusting a
  // note. The set must never contain the CURRENT fingerprint: the refresh would
  // then rewrite an already-current row on every pass.
  'subscription-authentication-required': new Set([
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // 475d3e695 (2026-08-04) only, until 5151ec196 (2026-08-07):
    'f321ea5e3b2f53226ab5f1f24e31d2090ad4625bb62a3e86fb78f2fdc666e9b4',
    // 5151ec196 (2026-08-07) through 5e402a0a8 (2026-08-24), until 851aa54d6 (2026-09-16):
    '1430ff986d8fa633f50b78b7457865eb095e6c791d9d4a26c5a4e5696dce6346',
  ]),
  'subscription-invoice': new Set([
    // Found missing (2026-10-06, persona issue 919): shipped bodies never
    // appended, computed from the code at each commit that shipped them.
    // 475d3e695 (2026-08-04) only, until 5151ec196 (2026-08-07):
    '9c398e09bdba20dbddb8147dcd22506add9d5e42ca17c74d7a5d323c51051cbc',
    // 5151ec196 (2026-08-07) through 5e402a0a8 (2026-08-24), until 851aa54d6 (2026-09-16):
    'f820904bf342c35e5a30cb819efae18e9ff0c710892437a99e2261594a1e43ce',
  ]),
};

/** Is this stored body still an untouched prior shipped default for `key`? A null
 *  document (a not-yet-repaired legacy row) is never a match — the caller repairs those
 *  first, and a tree-converted body legitimately isn't a shipped silica default. */
export function isPriorDefaultBody(key: string, doc: SilicaEmailDocument | null): boolean {
  if (!doc) return false;
  return PRIOR_DEFAULT_BODY_FINGERPRINTS[key]?.has(bodyFingerprint(doc)) ?? false;
}
