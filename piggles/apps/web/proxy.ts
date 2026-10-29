// A server-action form posted from an older build (a page open across a deploy,
// or a bot replaying a scraped form) made Next.js answer 500 "Failed to find
// Server Action". This sends it back to a fresh copy of the page instead. The
// why, and what it never touches, is in @wizeworks/app-kit/stale-form-action.
// A header-named call to an unknown action gets Next's own 404 first, because
// on a prerendered page Next's answer to it is a 500. A request Next cannot read
// (`/%c0`, a multipart body with no boundary) gets a 400; see
// @wizeworks/app-kit/malformed-path.

import { NextResponse, type NextRequest } from 'next/server';
import {
  runningActionIds,
  staleFormActionRedirect,
  unknownActionResponse,
} from '@wizeworks/app-kit/stale-form-action';
import { malformedRequestResponse } from '@wizeworks/app-kit/malformed-path';

export async function proxy(req: NextRequest) {
  const known = runningActionIds();
  return (
    malformedRequestResponse(req) ??
    unknownActionResponse(req, known) ??
    (await staleFormActionRedirect(req, known)) ??
    NextResponse.next()
  );
}

// Every request but a build asset enters the proxy. It used to see only the two
// shapes the action guards need (a multipart post, a `next-action` call), so a GET
// to a broken path (`/%c0`) never reached the 400 above and Next answered it with
// a 500 (app.sparx.works and mypiggles.com, still on 2026-10-29). Each check
// returns on a header or the path, so a page pays for none of them.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
