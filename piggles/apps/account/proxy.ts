// A server-action form posted from an older build (a page open across a deploy,
// or a bot replaying a scraped form) made Next.js answer 500 "Failed to find
// Server Action". This sends it back to a fresh copy of the page instead. The
// why, and what it never touches, is in @wizeworks/app-kit/stale-form-action.
// A header-named call to an unknown action gets Next's own 404 first, because
// on a prerendered page Next's answer to it is a 500.

import { NextResponse, type NextRequest } from 'next/server';
import {
  runningActionIds,
  staleFormActionRedirect,
  unknownActionResponse,
} from '@wizeworks/app-kit/stale-form-action';

export async function proxy(req: NextRequest) {
  const known = runningActionIds();
  return (
    unknownActionResponse(req, known) ??
    (await staleFormActionRedirect(req, known)) ??
    NextResponse.next()
  );
}

// Only two shapes need the proxy: a no-JavaScript form post (multipart, no
// `next-action` header) and a hydrated action call (a `next-action` header).
// Every other request never enters it.
export const config = {
  matcher: [
    {
      source: '/:path*',
      has: [{ type: 'header', key: 'content-type', value: 'multipart/form-data.*' }],
      missing: [{ type: 'header', key: 'next-action' }],
    },
    { source: '/:path*', has: [{ type: 'header', key: 'next-action' }] },
  ],
};
