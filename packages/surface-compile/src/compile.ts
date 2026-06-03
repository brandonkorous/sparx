// Compile a candidate class list into CSS through the Surface theme (docs/47 §5).
//
// Wraps @tailwindcss/node's programmatic compiler. `compile()` parses the static
// Surface theme entrypoint ONCE (it's tenant-independent — only the `--sf-*`
// references vary at runtime, in the browser), then `build(candidates)` emits the
// rules for whatever class set we hand it. Candidates Tailwind doesn't recognize
// simply produce nothing, so an unknown/typo'd author class can't break a build.
//
// The compiler is memoized: the entrypoint is identical for every tenant, so we
// pay the (heavier) parse cost once per process and only re-run the cheap
// candidate build per tenant.

import { fileURLToPath } from 'node:url';
import { compile, optimize } from '@tailwindcss/node';
import { SURFACE_THEME_CSS } from './theme';

// Resolve `@import 'tailwindcss/...'` relative to this package (tailwindcss is a
// direct dependency). `import.meta.url` works in both tsx runtime and vitest.
const BASE = fileURLToPath(new URL('.', import.meta.url));

type Compiler = Awaited<ReturnType<typeof compile>>;
let compilerPromise: Promise<Compiler> | null = null;

function getCompiler(): Promise<Compiler> {
  // Required hook; a one-shot compile doesn't watch dependencies.
  compilerPromise ??= compile(SURFACE_THEME_CSS, { base: BASE, onDependency: () => undefined });
  return compilerPromise;
}

export interface CompileOptions {
  /** Minify the output via Lightning CSS — use for the published tenant.css; skip
   *  for the editor's save-time temp.css to keep it fast + readable. */
  minify?: boolean;
}

/**
 * Compile a list of candidate class tokens into a CSS string. An empty list
 * short-circuits to `''` (no compiler work). Output is the Surface-themed
 * utilities for those classes; with `minify`, it's Lightning-CSS-optimized.
 */
export async function compileClasses(
  classes: string[],
  opts: CompileOptions = {}
): Promise<string> {
  if (classes.length === 0) return '';
  const compiler = await getCompiler();
  const css = compiler.build(classes);
  return opts.minify ? optimize(css, { minify: true }).code : css;
}
