// Does our cookie signature actually verify?
//
// `src/session-cookie.ts` reproduces better-call's `signCookieValue` because the
// package does not export it. Reproducing an implementation you cannot import is
// exactly the kind of claim that should not rest on having read the source
// carefully — a wrong signature produces a perfectly well-formed cookie that
// Better Auth silently treats as "signed out", which on the console means an
// endless bounce back to the account app with nothing in any log.
//
// So this signs a value the way we do and verifies it with better-call's OWN
// verifier, reached by deep path into its build output. The deep path is the
// point: if a future better-call moves or changes that file, this script fails
// loudly here rather than the console failing quietly in production.
//
// Run: node piggles/packages/auth-handoff/scripts/check-session-cookie.mjs

import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

/** The implementation under test, transcribed from src/session-cookie.ts. */
function signature(value, secret) {
  return createHmac('sha256', secret).update(value).digest('base64');
}

// better-call is better-auth's transport layer, not a direct dependency of this
// package — so it is reached THROUGH better-auth, which is where pnpm installs
// it (a package's own dependencies sit beside it). Resolving it any other way
// would risk finding a DIFFERENT copy than the one signing real cookies, and a
// different copy is precisely the drift this script exists to catch.
// `better-call/dist/crypto.mjs` is not in that package's `exports` map — which
// is the whole reason src/session-cookie.ts reproduces the function instead of
// importing it — so it cannot be resolved by specifier. We resolve better-auth
// itself, take the node_modules directory it landed in, and reach for its
// sibling by path.
const betterAuthEntry = require.resolve('better-auth', {
  paths: [fileURLToPath(new URL('../../../../packages/auth/', import.meta.url))],
});
const marker = `node_modules${sep}`;
const nodeModules = betterAuthEntry.slice(0, betterAuthEntry.lastIndexOf(marker) + marker.length);
const { getCryptoKey, verifySignature } = await import(
  pathToFileURL(join(nodeModules, 'better-call', 'dist', 'crypto.mjs')).href
);

const SECRET = 'a-test-secret-that-is-not-any-real-one';
// Token shapes Better Auth actually mints, plus the awkward ones: a signature is
// base64, so it can contain `+`, `/` and `=`, and a value containing a `.` must
// not confuse the split on the reading side.
const VALUES = [
  'CqK8sZ3nQm2vXt9LpR4dF7yB1aH6jN0e',
  'short',
  'a.value.with.dots',
  'unicode-ok-é-ü-中',
  '',
];

const key = await getCryptoKey(SECRET);
let failures = 0;

for (const value of VALUES) {
  const ours = signature(value, SECRET);
  const verified = await verifySignature(ours, value, key);
  console.log(`${verified ? 'ok  ' : 'FAIL'}  ${JSON.stringify(value)}`);
  if (!verified) failures += 1;
}

// A wrong secret must NOT verify — otherwise the check above proves nothing.
const forged = signature('CqK8sZ3nQm2vXt9LpR4dF7yB1aH6jN0e', 'a-different-secret');
const forgedVerifies = await verifySignature(forged, 'CqK8sZ3nQm2vXt9LpR4dF7yB1aH6jN0e', key);
console.log(`${forgedVerifies ? 'FAIL' : 'ok  '}  wrong secret is rejected`);
if (forgedVerifies) failures += 1;

if (failures > 0) {
  console.error(`\n${failures} check(s) failed — the session cookie would not verify.`);
  process.exit(1);
}
console.log('\nAll checks passed: our signature is better-call-compatible.');
