// Single source of truth for sparx's OWN platform legal document versions
// (docs/42 §6). The marketing pages that render each doc, the signUpMerchant
// acceptance recorder, and the re-acceptance check all read from here, so the
// version a tenant accepts is exactly the version that was on the page.
//
// Versioning is date-based (the day the text last materially changed). Bump
// `version` when the prose changes; flip `material` when the change is
// significant enough to require existing tenants to re-accept. Dependency-free
// on purpose so api-rest, @sparx/auth, and apps/web can all import it.

export interface LegalDocVersion {
  /** Date-based version string, e.g. "2026-06-02". */
  version: string;
  /** Human-facing effective date (same value, shown on the page). */
  effectiveDate: string;
  /** A bump with `material: true` forces existing tenants to re-accept. */
  material: boolean;
}

export const LEGAL_DOC_VERSIONS = {
  terms: { version: '2026-06-02', effectiveDate: '2026-06-02', material: true },
  privacy: { version: '2026-06-02', effectiveDate: '2026-06-02', material: true },
  dpa: { version: '2026-06-02', effectiveDate: '2026-06-02', material: true },
  aup: { version: '2026-06-02', effectiveDate: '2026-06-02', material: true },
} as const satisfies Record<string, LegalDocVersion>;

export type LegalDocType = keyof typeof LEGAL_DOC_VERSIONS;

/** The docs every tenant accepts at sign-up. The DPA is required for EU tenants
 *  only (docs/16 §10), so it is offered post-onboarding, not force-accepted. */
export const ONBOARDING_LEGAL_DOCS: LegalDocType[] = ['terms', 'privacy', 'aup'];

export function currentVersion(docType: LegalDocType): string {
  return LEGAL_DOC_VERSIONS[docType].version;
}

/** Given a map of the latest version a user has accepted per doc, return the
 *  onboarding docs that are stale (never accepted, or a newer MATERIAL version
 *  is live). Drives the dashboard re-acceptance banner. */
export function staleLegalDocs(accepted: Partial<Record<LegalDocType, string>>): LegalDocType[] {
  return ONBOARDING_LEGAL_DOCS.filter((doc) => {
    const meta = LEGAL_DOC_VERSIONS[doc];
    const have = accepted[doc];
    if (!have) return true;
    return have !== meta.version && meta.material;
  });
}
