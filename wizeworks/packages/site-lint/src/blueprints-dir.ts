import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Where the shipped blueprint bundles are, resolved rather than counted.
//
// Both blueprint tests read the repo on purpose — the bundles are data files
// about to be published, and a fixture can drift from what is on disk. That means
// they need a path OUT of this package, and both of them used to spell it
// `join(process.cwd(), '..', '..', 'marketplace-catalog', 'blueprints')`.
//
// That is two `..`s from `packages/site-lint`, which was correct until the tree
// move put this package at `wizeworks/packages/site-lint` and made it three. Nine
// tests then failed with ENOENT — better than the four structural checks that
// went SILENTLY GREEN over an empty directory in the same move, but the same
// defect: a path constant that encodes its own depth is one refactor from wrong.
//
// So: walk up to the workspace root and resolve from there. Moving this package
// again cannot break it, and a MISSING catalog fails loudly with the path it
// looked for, rather than reporting a clean sweep of nothing.

function workspaceRoot(): string {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `No pnpm-workspace.yaml above ${process.cwd()} — cannot locate the repo root.`
      );
    }
    dir = parent;
  }
}

export const BLUEPRINTS = join(workspaceRoot(), 'marketplace-catalog', 'blueprints');

/**
 * Every blueprint slug on disk.
 *
 * An absent or empty directory THROWS rather than returning `[]`. A sweep over
 * nothing passes every assertion it makes and reports success, which is the one
 * outcome a content guard must never produce.
 */
export function blueprintSlugs(): string[] {
  if (!existsSync(BLUEPRINTS)) {
    throw new Error(
      `Blueprint bundles not found at ${BLUEPRINTS} — this guard would scan nothing.`
    );
  }
  const slugs = readdirSync(BLUEPRINTS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (slugs.length === 0) {
    throw new Error(`No blueprint bundles in ${BLUEPRINTS} — this guard would scan nothing.`);
  }
  return slugs;
}
