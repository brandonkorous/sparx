// Unauthenticated liveness/readiness probe target for k8s. Must stay dependency
// free — it has to answer even when the database, api-rest, or auth are down,
// otherwise a downstream outage rolls the pods and turns a partial outage into
// a total one.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function GET(): Response {
  return Response.json({ ok: true, service: 'workbench' });
}
