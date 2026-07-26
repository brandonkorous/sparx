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
 * transactional-email redesign, i.e. what every tenant provisioned to date is holding.
 */
export const PRIOR_DEFAULT_BODY_FINGERPRINTS: Record<string, ReadonlySet<string>> = {
  'welcome-customer': new Set(['f0bab7ccfdcd7821f8bbc8385faa7c08beb000889cc6ae4a01c92272e0342308']),
  'win-back': new Set(['ef8658cbd7ce2f8cb29c1d7065dab56b38ddd8528bf8949c9c9090c7fc01f183']),
  'abandoned-cart': new Set(['c43ddf1e78a48270f73e43c9297f98f5ad7fe78dfe6c48769c7213cf0f3f83ab']),
  'post-purchase-review': new Set([
    '7dda0d718e85cc2c11313fb63f3fa3a5d87aa4438d24eea9008c1a8069413271',
  ]),
  'chat-satisfaction': new Set([
    '44ef6343f808e6d01e02f6cd1bc4a570ac6c169afa4fa84a0868ab039fe26481',
  ]),
  'b2b-account-approved': new Set([
    '441bf1990f64208d59bebe4fd11e905bf8e1828766e4a9414b142992d456dd3c',
  ]),
  'b2b-quote-received': new Set([
    'a499c9523e3f9f290ecdf7bfeebca52eebe394d59a3f05072eb4c9a9c53901d1',
  ]),
  'b2b-quote-expiring': new Set([
    'aefeec5abf93f72567f8b76d5cb46cb92efdaa2eef0a29cb603bcd1212b511a4',
  ]),
  'b2b-invoice-due': new Set(['85a3c8839930e20b0fa0151d2b8ca8d73e9a4a2d0b1202cca40b0c524d2c957e']),
  'invoicing-reminder': new Set([
    '46b9d6105ab16f7d4eb50251653b1edcf41d31b38483c1cc7cf43441988f2e28',
  ]),
  'invoicing-overdue': new Set([
    'fe853edb1970b843a3f225ed12ffae750c8f8cb4022ef842eeb4c3e546ac4962',
  ]),
  'invoicing-overdue-2': new Set([
    'bfbe0e4ed804ef9df1404e59bca2525f1c89a45621c95f88ef06bde5e55b024d',
  ]),
  'invoicing-overdue-final': new Set([
    'c1e4513b4182d5f479b04af2c025faad1c5b190f7c3d4c7959f69b43eee58064',
  ]),
  'invoicing-receipt': new Set([
    'e042ec5c9968ae990c6c3c561c38deeab1cf1df7cd1aae613cfb3d70cc43b613',
  ]),
  'order-confirmation': new Set([
    'acccea740153987a3686c2d8f20f0a716fe05c3070b2219e51c500251b1680f3',
  ]),
  'shipping-confirmation': new Set([
    'c9d48b50aaf7363fc5f029b24d1ec49476259ba20c7a29a746a47707d4162fdc',
  ]),
  'booking-confirmation': new Set([
    '5cd91e9ae085185fe763833e62d1b62dd05e2d559f4edfe2b5495ae436117e42',
  ]),
  'booking-reminder': new Set(['b60bcda1f3663363784f7992a24f44d7630603ef861b860bed805ae078c4f405']),
  'booking-rescheduled': new Set([
    '9ec84928a1821078bf0d4ad19c160c935ee5d8853ad15ecb028b2c4397907be9',
  ]),
  'booking-cancelled': new Set([
    '6d098a4219d4f1730c2772edb6e459010553b1118b6c6d7b67bb236ebfea9438',
  ]),
  'waitlist-offer': new Set(['c37718b0aa2622d42c21d3b9e2a2f9b766897b772d791ad9e016a0e17ed8fee7']),
  'booking-notification-internal': new Set([
    '215265b902cace174300b7d3b585c14b2eefde9056ed40f114fd87a9e4be2476',
  ]),
};

/** Is this stored body still an untouched prior shipped default for `key`? A null
 *  document (a not-yet-repaired legacy row) is never a match — the caller repairs those
 *  first, and a tree-converted body legitimately isn't a shipped silica default. */
export function isPriorDefaultBody(key: string, doc: SilicaEmailDocument | null): boolean {
  if (!doc) return false;
  return PRIOR_DEFAULT_BODY_FINGERPRINTS[key]?.has(bodyFingerprint(doc)) ?? false;
}
