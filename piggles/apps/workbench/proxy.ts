// Edge proxy (Next.js `proxy` file convention, formerly `middleware`).
//
// Its one job: a request Next cannot read gets the client's 400, not Next's 500.
// That is a broken percent escape (`/%c0`, which mypiggles.com answered with a 500
// on 2026-10-22 and still did on 2026-10-29) or a multipart body with no boundary.
// See @wizeworks/app-kit/malformed-path. This app has no server actions, so the
// stale-action guards the other apps run are not needed here.

import { NextResponse, type NextRequest } from 'next/server';
import { malformedRequestResponse } from '@wizeworks/app-kit/malformed-path';

export function proxy(req: NextRequest) {
  return malformedRequestResponse(req) ?? NextResponse.next();
}

// Every request but a build asset: each check returns on a header or the path.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
