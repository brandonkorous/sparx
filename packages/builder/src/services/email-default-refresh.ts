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
// A BRAND-NEW template gets an explicit EMPTY set. It has only ever had one body, so
// there is nothing to roll forward from — and its current fingerprint must NOT go in,
// or the refresh would treat an already-current row as stale and rewrite it on every
// pass. Empty is a decision; missing is an oversight, and the test tells them apart.

import { createHash } from 'node:crypto';
import type { SilicaEmailDocument } from '@sparx/builder-schemas';

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
  ]),
  'win-back': new Set([
    'ef8658cbd7ce2f8cb29c1d7065dab56b38ddd8528bf8949c9c9090c7fc01f183',
    '62079f2868e75c7fdaa218e0e73c304276ccaa09a20fb0a57e87406c7d7a8be4',
  ]),
  'abandoned-cart': new Set([
    'c43ddf1e78a48270f73e43c9297f98f5ad7fe78dfe6c48769c7213cf0f3f83ab',
    '650b5c77a6c80d7978311f2fb437e7e997fc800bc833cd437f03bdb78bf466e2',
  ]),
  'post-purchase-review': new Set([
    '7dda0d718e85cc2c11313fb63f3fa3a5d87aa4438d24eea9008c1a8069413271',
    'e3b0908f24f3139e2a09088304fcdc98b8cd24bf98021b5c25d0d42fc9faa581',
    // Outgoing (2026-07-29): pre-cross-sell body, replaced by the same + a commerce-gated
    // "More to explore" cross-sell (marketing send, rides under the unsubscribe footer).
    '820b636ac7f2d0b088f4d938734dda68ae55ce94186c36558d3e78d157608ec8',
  ]),
  'b2b-account-approved': new Set([
    '441bf1990f64208d59bebe4fd11e905bf8e1828766e4a9414b142992d456dd3c',
    '760ba43438870e3cb8492c739a6b04badc29cd630e180654f6eb00b273825a3a',
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
  ]),
  'chat-satisfaction': new Set([
    '44ef6343f808e6d01e02f6cd1bc4a570ac6c169afa4fa84a0868ab039fe26481',
    '45f8bc21409386d2247a3b4fa339343dc6f01f8219a907868ae772abad13b113',
  ]),
  'order-confirmation': new Set([
    'acccea740153987a3686c2d8f20f0a716fe05c3070b2219e51c500251b1680f3',
    'bfc3f25b44336ed6a4a26c5a192aa2bb01d30c896f6632ef4b6cd04ac1ba8550',
    // Outgoing (2026-07-29): pre-cross-sell body, replaced by the same + a single
    // commerce-gated "While you wait" nudge under the transactional content (CAN-SPAM
    // primary-purpose — the order is still the email's point).
    'fb1c69280d78ec34450b36aaaa2006e010543075fb8b53b666cca306999b5782',
  ]),
  'shipping-confirmation': new Set([
    'c9d48b50aaf7363fc5f029b24d1ec49476259ba20c7a29a746a47707d4162fdc',
    '488c49bdbb7abef2929bfc28e41648889527534cb7dd1576c760c2bf2019f223',
  ]),
  'order-delivered': new Set([
    '92833d0d5e436a08bf2fa8aea7036704d1e7892b8936e34a63865e1085a0ba23',
    // Outgoing (2026-07-29): pre-cross-sell body, replaced by the same + a commerce-gated
    // "Ready for your next find?" nudge (delivery is the natural re-purchase moment).
    '79be08e9f7e15517cd5e32b4db8741f7f6ec2749b842a61aad79ee527bbf4ed2',
  ]),
  'order-cancelled': new Set(['1e15199075b2e949414fb79039ab1b41aaf432acc81a0b56499d79a3d625d990']),
  'order-refunded': new Set(['ecb62f9de7b8a7f3a735c8db9b8e958d3375a069844b5c8dd17cfbd0c05a60b6']),
  'payment-failed': new Set(['58d0a758e8855642c53cf4816d0334d347d13364b73793297b8e1911803d83f9']),
  'subscription-confirmed': new Set([
    '5dd348c4bac3402e19a914307bcdd92806fd897628cf979060d4c603bde61a9f',
  ]),
  'subscription-renewed': new Set([
    '7cc2f44c0c81b39b4cb77173f11f481f62a1bc39dca97fd3c6528797832bc20c',
  ]),
  'subscription-payment-failed': new Set([
    'a4111c25fe70f06ad7a1478946b1b56fe01be80bb7d4cbabbae9e87fca66cca1',
  ]),
  'subscription-paused': new Set([
    '82d2689447e93f9e8705b703079005f39b5ed5d7463a50eae49b0f8f142aaaaa',
  ]),
  'subscription-resumed': new Set([
    'a41c20ab6d9d77d7331fb54fff4029278739ffa9f968530350cdb75f799ed0ac',
  ]),
  'subscription-cancelled': new Set([
    'c333f2db91a160f9e2efb37985961d4da5e7f3494d765135ee32f731977053db',
  ]),
  'return-approved': new Set(['530dd0e43444ee9645b702fd33ef423b972ae5aa214ce0345f6935971c3e99a2']),
  'return-received': new Set(['ffbc6d93cca341490c35be643f1f261ce304c543a6e5d74a73bd8e86370b4f7e']),
  'return-refunded': new Set(['fa810aec0d201b0aef078620fa40ec23a47bed247aa9ce4dc9ae7c44fc665524']),
  'b2b-order-approved': new Set([
    'fc09aded0e05d7213355165dd0bf3f8c77039e682c2ea42bb2edcf2a0fbbc38b',
  ]),
  'b2b-order-rejected': new Set([
    '5a521482b7f1a9b1c214285d48404920fa1bfcbd4df913f9c9525b99683ef995',
  ]),
  'booking-confirmation': new Set([
    '5cd91e9ae085185fe763833e62d1b62dd05e2d559f4edfe2b5495ae436117e42',
    '6815acdc436177354efca9ca26aa2973c3c4b14392051464c8ae6b1b6ee98772',
  ]),
  'booking-reminder': new Set([
    'b60bcda1f3663363784f7992a24f44d7630603ef861b860bed805ae078c4f405',
    '910192efb85ec9a543281abf0fd6be724cd68889c9b7dfd3b999b17065f367f2',
  ]),
  'booking-rescheduled': new Set([
    '9ec84928a1821078bf0d4ad19c160c935ee5d8853ad15ecb028b2c4397907be9',
    '5bc7e763b232eeda654b221f922b9e96db579c5a84052e2671a66a05921cb857',
  ]),
  'booking-cancelled': new Set([
    '6d098a4219d4f1730c2772edb6e459010553b1118b6c6d7b67bb236ebfea9438',
    '499671514f40a576eae94ee230818484478f6a822a3da3368656dda533c6eb99',
  ]),
  'waitlist-offer': new Set([
    'c37718b0aa2622d42c21d3b9e2a2f9b766897b772d791ad9e016a0e17ed8fee7',
    '3d2186a0e3509b4481d83333e1bc951aded5e128987ef0805ed7c9ab406c356d',
  ]),
  'booking-notification-internal': new Set([
    '215265b902cace174300b7d3b585c14b2eefde9056ed40f114fd87a9e4be2476',
    'f476ab97f48041ac8b64592b87f9849190951997e641d9f3c041a3e193156833',
  ]),

  // ── Shipped new; no prior design yet (docs/142) ────────────────────────────
  // An EXPLICIT empty set, not an omission. These two templates have only ever
  // had one body — the current one — so there is nothing to roll a pristine row
  // forward FROM. The set cannot contain the current fingerprint either: that
  // would make the refresh recognise an already-current row as stale and
  // "re-design" it on every pass, forever.
  //
  // Listing them empty rather than leaving them out is what keeps the checklist
  // honest — absent means someone forgot, empty means someone decided. Both keys
  // get their first entry the day either body is redesigned, following the
  // add-the-OUTGOING-body rule above.
  'subscription-authentication-required': new Set(),
  'subscription-invoice': new Set(),
};

/** Is this stored body still an untouched prior shipped default for `key`? A null
 *  document (a not-yet-repaired legacy row) is never a match — the caller repairs those
 *  first, and a tree-converted body legitimately isn't a shipped silica default. */
export function isPriorDefaultBody(key: string, doc: SilicaEmailDocument | null): boolean {
  if (!doc) return false;
  return PRIOR_DEFAULT_BODY_FINGERPRINTS[key]?.has(bodyFingerprint(doc)) ?? false;
}
