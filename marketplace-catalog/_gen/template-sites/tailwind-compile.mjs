// The Tailwind v4 compile step for the template PREVIEW harness, run as a child process.
//
// Usage (invoked by preview.ts — not by hand):
//   node marketplace-catalog/_gen/template-sites/tailwind-compile.mjs -i <input.css> -o <out.css>
//
// WHY THIS FILE EXISTS: `preview.ts` used to shell out to `@tailwindcss/cli`, resolved by a
// hard-coded `node_modules/.pnpm/@tailwindcss+cli@4.3.0/...` path. That package entered the
// workspace as a dependency of `wizeworks/packages/site-ui`; when site-ui went away the CLI went with
// it, and every template generator's preview step started failing on a missing module — the
// review aid was dead for the whole second batch of templates. The compile itself was never
// the problem, so this reimplements exactly what the CLI does (compile the input CSS, scan
// the `@source` globs for candidates, build) against `@tailwindcss/node` + `@tailwindcss/oxide`,
// which ARE in the workspace because `tailwindcss` itself pulls them in. No new dependency,
// and nothing left to break the next time a package is retired.
//
// WHY the .pnpm glob (rather than a bare `import '@tailwindcss/node'`): marketplace-catalog has
// no node_modules of its own and pnpm does not hoist to the workspace root, so a bare specifier
// cannot resolve from here. Finding the versioned dir keeps this working across version bumps —
// the same technique, for the same reason, as `screenshot-template.mjs`.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

/** Resolve a workspace package from pnpm's store, version-agnostically. */
async function loadFromStore(pkgDirPrefix, ...entry) {
  const pnpmDir = join(repoRoot, 'node_modules', '.pnpm');
  const re = new RegExp(`^${pkgDirPrefix.replace(/[+@.]/g, '\\$&')}@\\d`);
  const match = readdirSync(pnpmDir).find((d) => re.test(d));
  if (!match) {
    throw new Error(
      `${pkgDirPrefix} not found under node_modules/.pnpm — run \`pnpm install\` at the repo root first.`
    );
  }
  return import(pathToFileURL(join(pnpmDir, match, 'node_modules', ...entry)).href);
}

function arg(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1 || !process.argv[i + 1]) {
    throw new Error(`tailwind-compile: missing ${flag} <path>`);
  }
  return process.argv[i + 1];
}

async function main() {
  const inputPath = arg('-i');
  const outPath = arg('-o');

  const { compile } = await loadFromStore('@tailwindcss+node', '@tailwindcss', 'node', 'dist', 'index.mjs');
  const { Scanner } = await loadFromStore('@tailwindcss+oxide', '@tailwindcss', 'oxide', 'index.js');

  const compiler = await compile(readFileSync(inputPath, 'utf8'), {
    base: dirname(inputPath),
    from: inputPath,
    onDependency: () => {},
  });

  // The compiler reports which files its `@source` directives select; oxide extracts the
  // candidate class names from them. `root` is the implicit source (auto-detection) — the
  // preview input declares its sources explicitly, so it is normally 'none'.
  const sources = compiler.sources.slice();
  if (compiler.root && compiler.root !== 'none') {
    sources.push({ ...compiler.root, negated: false });
  }
  const scanner = new Scanner({ sources });

  writeFileSync(outPath, compiler.build(scanner.scan()), 'utf8');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
