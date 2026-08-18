import { NextResponse } from 'next/server';

// Reports the release this pod is serving. The value is stamped into the image
// via the APP_VERSION build-arg → runtime env (see sparx/apps/workbench/Dockerfile);
// the client compares it against the version baked into its own bundle
// (NEXT_PUBLIC_APP_VERSION) to detect that a new release shipped while the tab
// was open. Must never be cached — during a rolling deploy the answer changes
// pod-to-pod, and a stale cached value would defeat the whole check.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export function GET(): NextResponse {
  return NextResponse.json(
    { version: process.env.APP_VERSION ?? 'dev' },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
