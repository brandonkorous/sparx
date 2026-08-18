// The platform legal documents each brand publishes, and which of them a tenant
// accepts at sign-up (docs/42 §6).
//
// The marketing page that renders a document, the sign-up acceptance recorder,
// and the re-acceptance check all read from here, so the version a tenant
// accepts is exactly the version that was on the page they were shown.
//
// ── WHY THIS IS KEYED BY BRAND ──────────────────────────────────────────────
//
// It used to be one flat map, described in its own header as "sparx's OWN
// platform legal document versions" — and it was, because sparx was the only
// product when it was written. `signUpMerchant` then recorded every tenant as
// having accepted those versions, whichever brand they had signed up through.
//
// So a Piggles owner, on a screen that said "creating an account means you agree
// to the Piggles terms and privacy policy" and linked to meetpiggles.com, had a
// row written against their tenant recording acceptance of a DIFFERENT company's
// documents at a version they were never shown — plus an acceptable-use policy
// that does not exist on any Piggles address. An acceptance record naming a
// document the person never saw is worse than no record: it is evidence of the
// wrong thing, and it looks like evidence of the right thing.
//
// A table keyed by brand is a REGISTRY, not a brand conditional (wizeworks/CLAUDE.md
// RULE #0): nothing here branches on which brand it is, and a third brand is one
// more entry rather than an edit to any code path.
//
// ── WHY EACH BRAND'S `onboarding` LIST DIFFERS, LEGITIMATELY ────────────────
//
// sparx publishes a separate acceptable-use policy; Piggles covers the same
// ground inside its terms ("What you cannot do with it"). So sparx asks for
// three documents and Piggles asks for two, and BOTH are complete. The list is
// per brand precisely so this stays a statement of fact rather than a lie in
// either direction — a brand must never be recorded as accepting a document it
// does not publish.

export interface LegalDocVersion {
  /** Date-based version string, e.g. "2026-06-02". */
  version: string;
  /** Human-facing effective date (same value, shown on the page). */
  effectiveDate: string;
  /** A bump with `material: true` forces existing tenants to re-accept. */
  material: boolean;
}

/** Every document type the platform knows how to render and record. A brand
 *  need not publish all of them — see `BrandLegal.onboarding`. */
export type LegalDocType = 'terms' | 'privacy' | 'dpa' | 'aup';

export interface BrandLegal {
  /** Versions for the documents this brand publishes. */
  versions: Partial<Record<LegalDocType, LegalDocVersion>>;
  /**
   * The documents this brand asks a new tenant to accept at sign-up.
   *
   * The DPA is deliberately absent from both: it is required for EU tenants
   * only (docs/16 §10) and is offered after onboarding rather than force-
   * accepted, because an addendum nobody read is not an addendum.
   */
  onboarding: LegalDocType[];
  /** The published subprocessor list. Versioned like the documents above — the
   *  DPA promises notice of material changes and a version string is how that
   *  notice is evidenced — but deliberately NOT part of `onboarding`, because a
   *  subprocessor change gives the customer a right to OBJECT rather than an
   *  obligation to re-accept a contract. */
  subprocessors: LegalDocVersion;
}

const SPARX_LEGAL: BrandLegal = {
  versions: {
    terms: { version: '2026-07-28', effectiveDate: '2026-07-28', material: true },
    privacy: { version: '2026-07-28', effectiveDate: '2026-07-28', material: true },
    dpa: { version: '2026-07-28', effectiveDate: '2026-07-28', material: true },
    aup: { version: '2026-07-28', effectiveDate: '2026-07-28', material: true },
  },
  onboarding: ['terms', 'privacy', 'aup'],
  subprocessors: { version: '2026-07-28', effectiveDate: '2026-07-28', material: false },
};

const PIGGLES_LEGAL: BrandLegal = {
  versions: {
    terms: { version: '2026-08-17', effectiveDate: '2026-08-17', material: true },
    privacy: { version: '2026-08-17', effectiveDate: '2026-08-17', material: true },
    dpa: { version: '2026-08-17', effectiveDate: '2026-08-17', material: true },
    // No `aup` entry, and that absence is the statement: acceptable use is a
    // clause of the terms here, not a separate document. Recording acceptance of
    // one would name a page that does not exist.
  },
  onboarding: ['terms', 'privacy'],
  subprocessors: { version: '2026-08-17', effectiveDate: '2026-08-17', material: false },
};

const BY_BRAND: Record<string, BrandLegal> = {
  sparx: SPARX_LEGAL,
  piggles: PIGGLES_LEGAL,
};

/**
 * The legal documents a brand publishes.
 *
 * Falls back to sparx for an unrecognised brand, which is the only safe
 * direction: `Tenant.platformBrand` defaults to `"sparx"`, so an absent or
 * unexpected value genuinely IS a sparx tenant. Returning nothing would silently
 * record no acceptance at all — the failure that leaves you unable to show
 * anybody agreed to anything.
 */
export function brandLegal(brand: string | null | undefined): BrandLegal {
  return BY_BRAND[brand ?? 'sparx'] ?? SPARX_LEGAL;
}

/** The version of one document for one brand, or undefined if this brand does
 *  not publish it. */
export function currentVersion(
  brand: string | null | undefined,
  docType: LegalDocType
): string | undefined {
  return brandLegal(brand).versions[docType]?.version;
}

/**
 * The documents a tenant of this brand still owes acceptance for — never
 * accepted, or a newer MATERIAL version is live. Drives the re-acceptance banner.
 *
 * A document in `onboarding` with no version entry is skipped rather than
 * reported stale: that combination is a configuration mistake, and prompting
 * somebody to re-accept a document nobody can open helps no one.
 */
export function staleLegalDocs(
  brand: string | null | undefined,
  accepted: Partial<Record<LegalDocType, string>>
): LegalDocType[] {
  const legal = brandLegal(brand);
  return legal.onboarding.filter((doc) => {
    const meta = legal.versions[doc];
    if (!meta) return false;
    const have = accepted[doc];
    if (!have) return true;
    return have !== meta.version && meta.material;
  });
}

/** The rows to write when somebody accepts at sign-up: one per document this
 *  brand actually publishes and actually showed them. */
export function acceptanceRows(
  brand: string | null | undefined
): { docType: LegalDocType; docVersion: string }[] {
  const legal = brandLegal(brand);
  return legal.onboarding.flatMap((docType) => {
    const meta = legal.versions[docType];
    return meta ? [{ docType, docVersion: meta.version }] : [];
  });
}
