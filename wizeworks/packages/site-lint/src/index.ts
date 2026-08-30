// @wizeworks/site-lint — the pre-publish check engine (docs/builder-audit slice 9).
//
// `lintSite(site)` walks the composed document of every page — the shared header and
// footer, the page body, and every saved component expanded — and reports what a
// visitor will run into: links that go nowhere, images with no description, headings
// that skip a level, buttons nothing is wired to, styling that emits no CSS, pages
// that share or lack search metadata, and pages nothing links to. Alongside the
// findings it reports what each page WEIGHS (slice 12) — markup bytes, picture bytes,
// styling that emits no CSS — as a measurement rather than a defect.
//
// Pure: no network, no database, no clock. It leans on `@wizeworks/silica-catalog` for
// two things it must not answer twice — which classes the platform's CSS actually
// contains, and how a tree becomes HTML — so the check and the live page agree by
// construction. Advisory only: nothing here can block a publish.

export { lintSite } from './lint';

// The weight budget. `imageSourcesOf` is the first half of a two-step call: name the
// pictures, look their sizes up wherever they live, hand them back on `imageBytes`.
export { imageSourcesOf, measureSite, WEIGHT_BUDGET } from './budget';
export type { HeavyImage, PageWeight, SiteBudget, WeightBand } from './budget';

export type {
  LinkTargets,
  LintablePage,
  LintFinding,
  LintLocation,
  LintRuleId,
  LintScope,
  LintSeverity,
  LintStatus,
  SiteCapabilities,
  SiteLintInput,
  SiteLintReport,
} from './types';

// The route table is exported so a caller assembling `LinkTargets` can see which
// paths it does NOT need to supply, and so the storefront's own routes have one
// definition rather than a copy per consumer.
export { BUILTIN_PATHS, DYNAMIC_ROUTES, normalizePath, routePrefixForRecordType } from './routes';
export type { DynamicRoute, RosterKey } from './routes';
