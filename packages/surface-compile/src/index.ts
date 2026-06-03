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
import { contentHash } from './hash';

export { collectClasses } from './extract';
export { compileClasses, type CompileOptions } from './compile';
export { contentHash } from './hash';
export { SURFACE_THEME_CSS } from './theme';

export interface TenantStylesheet {
  /** The compiled CSS (minified when `minify` was set). */
  css: string;
  /** Content hash of `css` — the cache-bustable filename stem. */
  hash: string;
  /** The unique, sorted class set the CSS was built from. */
  classes: string[];
}

/**
 * Tree-shake + compile a tenant's authored classes into a stylesheet. Accepts a
 * single tree or several (page tree + site-layout chrome). An empty class set
 * yields an empty sheet (still hashed, so callers get a stable identity).
 */
export async function buildTenantStylesheet(
  roots: BuilderNode | BuilderNode[],
  opts: CompileOptions = {}
): Promise<TenantStylesheet> {
  const classes = collectClasses(roots);
  const css = await compileClasses(classes, opts);
  return { css, hash: contentHash(css), classes };
}
