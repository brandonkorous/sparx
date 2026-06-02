// Single source of truth for Sparx's OWN platform legal document versions
// (docs/42 §6). The marketing pages that render each doc AND the onboarding
// acceptance recorder (Slice 6) read from here, so the version a tenant
// accepts is exactly the version that was on the page.
//
// Versioning is date-based (the day the text last materially changed). Bump
// the `version` when the prose changes; flip `material` when the change is
// significant enough to require existing tenants to re-accept (a minor
// clarification leaves `material` false and only updates the effective date).
//
// NOTE: when the backend acceptance recorder lands (Slice 6) this constant is
// promoted to a tiny dependency-free `@sparx/legal` package both apps/web and
// api-rest import; today only apps/web consumes it.

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
