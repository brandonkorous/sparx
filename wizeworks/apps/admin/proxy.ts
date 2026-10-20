// A server-action form posted from an older build (a page open across a deploy,
// or a bot replaying a scraped form) made Next.js answer 500 "Failed to find
// Server Action". This sends it back to a fresh copy of the page instead. The
// why, and what it never touches, is in @wizeworks/app-kit/stale-form-action.

import { NextResponse, type NextRequest } from 'next/server';
import { runningActionIds, staleFormActionRedirect } from '@wizeworks/app-kit/stale-form-action';

export async function proxy(req: NextRequest) {
  return (await staleFormActionRedirect(req, runningActionIds())) ?? NextResponse.next();
}

// Only a no-JavaScript form post can carry the shape: multipart, with no
// `next-action` header. Every other request never enters the proxy.
export const config = {
  matcher: [
    {
      source: '/:path*',
      has: [{ type: 'header', key: 'content-type', value: 'multipart/form-data.*' }],
      missing: [{ type: 'header', key: 'next-action' }],
    },
  ],
};
