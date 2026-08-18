// Public /health alias of /api/health. The prod smoke test (deploy-prod.yml) and
// the Cloud Monitoring uptime check both probe https://<host>/health, so the app
// serving app.sparx.works must answer it. Kept dependency-free for the same
// reason as /api/health: it must respond even when the database, api-rest, or
// auth are down, so a downstream outage never rolls the pods.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function GET(): Response {
  return Response.json({ ok: true, service: 'workbench' });
}
