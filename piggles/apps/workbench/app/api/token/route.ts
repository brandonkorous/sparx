// Mounted, not reimplemented.
//
// The trust boundary the whole client-rendered workbench turns on: it
// authenticates the caller by their same-origin session cookie and hands the
// browser a short-lived, tenant-stamped JWT for api-rest. Every shared surface
// calls it, so it has to exist at the same path under this shell as under
// sparx's — and it has to be the SAME route, not a copy that agrees today.
//
// The HANDLER is re-exported because there is nothing brand-shaped in it. It
// reads the session, stamps `tid` server-side, and signs. A second copy would be
// a second place for the TTL, the claim set or the cookie name to drift, and the
// two would drift silently — a stale copy still mints a token, it just mints the
// wrong one. See apps/workbench/app/api/token/route.ts.
//
// ── WHY `dynamic` IS DECLARED HERE AND NOT RE-EXPORTED ──────────────────────
//
// Route segment config is read by STATIC ANALYSIS at build time, not at runtime,
// so `export { dynamic } from '…'` is not a value Next can see:
//
//     Next.js can't recognize the exported `dynamic` field in route.
//     It mustn't be reexported.
//
// It compiles, it typechecks, it lints — and every request to this route returns
// a 500. Config is per-file by construction; only the handler travels.
export const dynamic = 'force-dynamic';

export { GET, type WorkbenchTokenResponse } from '@workbench/app/api/token/route';
