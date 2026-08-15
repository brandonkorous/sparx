// Liveness for getpiggles.com, and the thing meetpiggles.com/status checks for
// this surface.
//
// Dependency-free, matching the other two. This app is the AUTH AUTHORITY, which
// makes the temptation to ping Better Auth here strongest and the mistake
// worst: a health check that fails because the database is unwell gets the pod
// rolled, and rolling the only app that can mint a session turns a database
// blip into nobody being able to sign in anywhere.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function GET(): Response {
  return Response.json({ ok: true, service: 'piggles-account' });
}
