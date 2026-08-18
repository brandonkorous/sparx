// Public /health endpoint for the Kubernetes liveness/readiness probes.
//
// Deliberately dependency-free — no database, no api-rest, no auth. The console
// sits behind Cloudflare Access and every other route redirects to a sign-in
// flow, so probing `/` would make the pod's health a function of the auth
// stack: a downstream outage would fail the probe and roll pods that are
// themselves fine. That is the exact failure that CrashLooped api-rest for 30h
// and SIGKILLed the workbench on the 2026-07-22 app-env roll.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function GET(): Response {
  return Response.json({ ok: true, service: 'admin' });
}
