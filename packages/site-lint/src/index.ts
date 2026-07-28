// @sparx/site-lint — the pre-publish check engine (docs/builder-audit slice 9).
//
// `lintSite(site)` walks the composed document of every page — the shared header and
// footer, the page body, and every saved component expanded — and reports what a
// visitor will run into: links that go nowhere, images with no description, headings
// that skip a level, buttons nothing is wired to, styling that emits no CSS, and
// pages that share or lack search metadata.
//
// Pure and dependency-free apart from the silica node types and the catalog's class
// vocabulary. Advisory only — nothing here can block a publish.

export { lintSite } from './lint';
export type {
  LinkTargets,
  LintablePage,
  LintFinding,
  LintLocation,
  LintRuleId,
  LintScope,
  LintSeverity,
  LintStatus,
  SiteLintInput,
  SiteLintReport,
} from './types';

// The route table is exported so a caller assembling `LinkTargets` can see which
// paths it does NOT need to supply, and so the storefront's own routes have one
// definition rather than a copy per consumer.
export { BUILTIN_PATHS, DYNAMIC_ROUTES, normalizePath } from './routes';
export type { DynamicRoute, RosterKey } from './routes';
