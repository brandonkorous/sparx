// Liveness/readiness for k8s. Deliberately NOT the shared route: that one
// answers `{ service: 'workbench' }`, and two Deployments reporting the same
// service name is how a probe failure gets attributed to the wrong pod.
//
// Dependency-free, like its counterpart — it has to answer even when the
// database, api-rest or auth are down, or a downstream outage rolls these pods
// and turns a partial outage into a total one.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function GET(): Response {
  return Response.json({ ok: true, service: 'piggles-console' });
}
