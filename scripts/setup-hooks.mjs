// Points git at the repo's tracked hooks (`.githooks/`) so the pre-push guard
// runs on every clone. Invoked from the root `prepare` script after install.
//
// Runs cross-platform: pnpm executes lifecycle scripts through cmd.exe on
// Windows, where the old POSIX one-liner (`... 2>/dev/null || true`) broke —
// cmd has no `/dev/null` and no `true` builtin. Doing it in Node sidesteps the
// shell entirely.
//
// Best-effort by design: installing from a tarball or building in a Docker
// layer without a `.git` dir should never fail the install, so a non-zero
// `git config` (or missing git) is swallowed.

import { execSync } from 'node:child_process';

try {
  execSync('git config core.hooksPath .githooks', { stdio: 'ignore' });
} catch {
  // No git repo / git not on PATH — nothing to wire up, treat as a no-op.
}
