// SEO Audit Scorecard — types (docs/50 §7).
//
// The engine scores a NORMALIZED `AuditableEntity`, never a raw DB row: the
// caller (api-rest) is responsible for gathering the signals — some from the
// stored SEO columns, some by inspecting the published tree/HTML (H1 count,
// alt-text coverage, word count, internal links, structured data) — and handing
// the engine a flat, surface-agnostic shape. That keeps the scoring identical
// across Builder pages, CMS pages, products, and collections.

/** The storefront entity classes a scorecard can grade. */
export type EntityType = 'builder_page' | 'cms_page' | 'product' | 'collection';

/** Per-check outcome. `info` checks are shown but NOT scored (they contribute
 *  neither earned points nor denominator weight) — used for "by design" states
 *  like an intentional `noindex`, and for always-true platform facts (llms.txt). */
export type CheckStatus = 'pass' | 'warn' | 'fail' | 'info';

/** The four scoring buckets. */
export type CategoryKey = 'meta' | 'index' | 'content' | 'social';

/** Letter-grade band derived from the 0–100 score. */
export type Grade = 'excellent' | 'good' | 'needs-work' | 'poor';

/** Whether the entity's social (OG) image is a real upload, the 3.10 generated
 *  fallback card, or nothing at all. */
export type OgImageState = 'custom' | 'generated' | 'none';

/** The flat, normalized signal set the engine scores. Every field is something
 *  Sparx already holds or can derive from published content — no external crawl. */
export interface AuditableEntity {
  entityType: EntityType;

  // ── Title & meta ──────────────────────────────────────────────
  /** Effective `<title>` (author SEO title if set, else the resolved fallback). */
  title: string | null;
  /** The meta description (author SEO description), or null when unset. */
  description: string | null;

  // ── Indexability ──────────────────────────────────────────────
  /** True when the page is marked `noindex` (intentionally hidden from search). */
  noindex: boolean;
  /** An explicit canonical URL, or null for the default self-referential one. */
  canonical: string | null;
  /** The URL slug/path the entity resolves at (used for the readable-slug check). */
  slug: string | null;
  /** Whether the entity is currently emitted in `sitemap.xml`. */
  inSitemap: boolean;

  // ── Content ───────────────────────────────────────────────────
  /** Count of `<h1>` elements in the rendered page. */
  h1Count: number;
  /** Approximate body word count. */
  wordCount: number;
  /** Total content images. */
  imageCount: number;
  /** How many of those images have no alt text. */
  imagesMissingAlt: number;
  /** Count of in-site links in the body. */
  internalLinkCount: number;

  // ── Social & AIO ──────────────────────────────────────────────
  ogImage: OgImageState;
  /** schema.org @types present as JSON-LD, e.g. ['Product', 'BreadcrumbList']. */
  structuredDataTypes: string[];
  /** Whether the entity is reachable via the AIO surface (`llms.txt`/sitemap). */
  inLlmsTxt: boolean;
}

/** Content signals derived by walking a published structure (a Builder node tree
 *  or a CMS rich-text doc). The caller folds these into an `AuditableEntity`
 *  alongside the stored SEO fields. See `extract.ts`. */
export interface ContentSignals {
  h1Count: number;
  wordCount: number;
  imageCount: number;
  imagesMissingAlt: number;
  internalLinkCount: number;
}

/** A single graded check. */
export interface CheckResult {
  id: string;
  category: CategoryKey;
  label: string;
  status: CheckStatus;
  /** Points this check is worth at `pass` (0 for `info` checks). */
  weight: number;
  /** Points actually earned: weight (pass) · weight/2 (warn) · 0 (fail) · 0 (info). */
  earned: number;
  /** Short right-aligned value, e.g. "71 chars", "5 / 8 ok". */
  value?: string;
  /** One-line remediation shown for `warn`/`fail`. */
  tip?: string;
  /** Optional UI action hint (the surface decides how to render it). */
  action?: SeoAuditAction;
}

/** A machine-readable pointer to the fix, so the UI can deep-link without
 *  parsing the tip prose. `target` is interpreted per surface. */
export interface SeoAuditAction {
  label: string;
  target:
    | 'title'
    | 'description'
    | 'slug'
    | 'canonical'
    | 'noindex'
    | 'images'
    | 'headings'
    | 'og-image'
    | 'structured-data';
}

/** Roll-up for one category. `max` excludes any `info` checks in the category. */
export interface CategoryScore {
  key: CategoryKey;
  label: string;
  earned: number;
  max: number;
}

/** The complete result of `auditEntity`. `computedAt` is left undefined by the
 *  (clock-free) engine — the caller stamps it. */
export interface Scorecard {
  entityType: EntityType;
  score: number;
  grade: Grade;
  categories: CategoryScore[];
  checks: CheckResult[];
  /** The single highest-leverage fix, or null when nothing is wrong. */
  fixFirst: string | null;
  computedAt?: string;
}
