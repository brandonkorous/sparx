// Liveness for meetpiggles.com, and the thing /status checks for this surface.
//
// Deliberately dependency-free, matching sparx/apps/workbench's. It has to answer even
// when the database, api-rest or auth are down: a health check that fails
// because a DOWNSTREAM service is unwell gets the pod rolled, which turns a
// partial outage into a total one.
//
// `service` is unique per surface on purpose. Two Deployments answering with the
// same name is how a probe failure gets attributed to the wrong pod.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function GET(): Response {
  return Response.json({ ok: true, service: 'piggles-web' });
}
