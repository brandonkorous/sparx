// A path with a broken percent escape (`/%c0`) cannot be decoded, and Next answers
// it with a 500 before any page runs. It is the client's mistake: answer 400 here.

/** True when the path cannot be percent-decoded. */
export function isMalformedPath(pathname: string): boolean {
  try {
    decodeURIComponent(pathname);
    return false;
  } catch {
    return true;
  }
}

/** A 400 for a path with a broken escape, or null for any other request. */
export function malformedPathResponse(req: { nextUrl: { pathname: string } }): Response | null {
  if (!isMalformedPath(req.nextUrl.pathname)) return null;
  return new Response('Bad request\n', {
    status: 400,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' },
  });
}
