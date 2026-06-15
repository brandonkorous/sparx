// @sparx/surface-compile — the Surface per-tenant CSS compile (docs/47 §5).
//
// Pipeline: a Builder node tree → tree-shake the authored class literals
// (`collectClasses`) → compile them through the tenant-flavored Tailwind theme
// (`compileClasses`) → content-hash the output (`contentHash`). `buildTenantStylesheet`
// runs the whole pipeline. The save path compiles a non-minified temp sheet for the
// editor canvas; the publish path compiles a minified, content-hashed tenant.css.
//
// Server-side only — never import from a React/frontend package (it pulls
// Tailwind + Lightning CSS).

import type { BuilderNode } from '@sparx/builder-schemas';
import { collectClasses } from './extract';
import { compileClasses, type CompileOptions } from './compile';
import { validateClasses } from './allowlist';
import { contentHash } from './hash';

export { collectClasses } from './extract';
export { compileClasses, type CompileOptions } from './compile';
export {
  isClassAllowed,
  validateClasses,
  baseUtility,
  parseAllowlistConfig,
  BASE_RULES_DESCRIPTION,
  type ClassValidation,
  type AllowlistConfig,
  type AllowlistRule,
  type BaseRuleDescription,
} from './allowlist';
export { contentHash } from './hash';
export { SURFACE_THEME_CSS } from './theme';
export { REDUCED_MOTION_CSS, SCROLL_MOTION_CSS } from './motion';

export interface TenantStylesheet {
  /** The compiled CSS (minified when `minify` was set). */
  css: string;
  /** Content hash of `css` — the cache-bustable filename stem. */
  hash: string;
  /** The allowed, sorted class set the CSS was built from. */
  classes: string[];
  /** Author classes dropped by the safety allowlist (docs/61 §8), if any. */
  blocked: string[];
}

/**
 * Tree-shake + compile a tenant's authored classes into a stylesheet. Accepts a
 * single tree or several (page tree + site-layout chrome). Author classes are
 * filtered through the safety allowlist (docs/61 §8) before compiling; dropped
 * tokens are reported in `blocked`. An empty class set yields an empty sheet
 * (still hashed, so callers get a stable identity).
 */
export async function buildTenantStylesheet(
  roots: BuilderNode | BuilderNode[],
  opts: CompileOptions = {}
): Promise<TenantStylesheet> {
  const { allowed, blocked } = validateClasses(collectClasses(roots));
  const css = await compileClasses(allowed, opts);
  return { css, hash: contentHash(css), classes: allowed, blocked };
}
