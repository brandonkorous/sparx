// Mounted, not reimplemented — see ./token/route.ts, including why `dynamic` is
// declared here rather than re-exported (route segment config is statically
// analysed, so a re-export is invisible to it and the route 500s at runtime).
//
// Persists which site the operator is working on as a server-set cookie. The
// site switcher in the console's own top bar posts here, exactly as sparx's
// does, and api-rest re-resolves the value under RLS regardless — so this is a
// preference, never a control.
export const dynamic = 'force-dynamic';

export { POST } from '@workbench/app/api/active-site/route';
