/** Is this module being evaluated by `next build` rather than a running server?
 *
 *  Next.js collects page data during the image build with NODE_ENV=production,
 *  so any "required in production" guard evaluated at module scope fires there —
 *  in an environment that deliberately has no database, no secrets and no
 *  network. That turns a correct runtime guard into a broken image build, which
 *  is what happened to /api/operator/bootstrap:
 *
 *      Error: OPERATOR_DATABASE_URL is not set...
 *      Error: Failed to collect page data for /api/operator/bootstrap
 *
 *  NEXT_PHASE is set by Next itself for exactly this purpose and is the
 *  documented way to tell the two apart. Guards should stay strict at runtime
 *  and skip only here: the build never opens a connection or signs a cookie, so
 *  there is nothing for them to protect, and the same check still runs when the
 *  container starts for real.
 */
export function isNextBuild(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}
