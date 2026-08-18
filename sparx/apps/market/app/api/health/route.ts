// Unauthenticated liveness/readiness probe for the sparx.market app. The k8s
// probes hit this directly (k8s/apps/market.yaml) so they never depend on the
// api-rest backend or a populated marketplace.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function GET() {
  return Response.json({ ok: true });
}
