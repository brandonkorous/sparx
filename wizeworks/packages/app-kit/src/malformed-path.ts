// Requests Next.js cannot even read, which it answers with a 500 before any page
// runs. Both are the client's mistake, so the proxy answers 400 first.
//
// A path with a broken percent escape (`/%c0`) cannot be decoded.
//
// A multipart body with no boundary cannot be split into parts: the boundary is
// the separator between them (RFC 2046 §5.1.1 makes it required, 1 to 70
// characters). A page POST makes Next parse the body as a form, which throws
// "Failed to parse body as FormData", and the answer is 500. A scanner sent
// `multipart/form-data; boundary=` to sparx.works four times on 2026-10-27. A
// route handler cannot read such a body either, so no path is exempt.
//
// Neither check reads the body: a header and the path are enough.

const BAD_REQUEST: ResponseInit = {
  status: 400,
  headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' },
};

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
  return new Response('Bad request\n', BAD_REQUEST);
}

/** True when a content type says multipart/form-data but names no usable boundary. */
export function isBoundlessMultipart(contentType: string | null): boolean {
  if (contentType === null) return false;
  const [type = '', ...params] = contentType.split(';');
  if (type.trim().toLowerCase() !== 'multipart/form-data') return false;
  for (const param of params) {
    const eq = param.indexOf('=');
    if (eq === -1 || param.slice(0, eq).trim().toLowerCase() !== 'boundary') continue;
    const value = param
      .slice(eq + 1)
      .trim()
      .replace(/^"(.*)"$/, '$1');
    return value.length === 0 || value.length > 70;
  }
  return true;
}

/** A 400 for a multipart body with no boundary, or null for any other request. */
export function malformedFormResponse(req: { headers: Headers }): Response | null {
  if (!isBoundlessMultipart(req.headers.get('content-type'))) return null;
  return new Response('Bad request\n', BAD_REQUEST);
}

/** Either 400 above, or null when the request can be read. */
export function malformedRequestResponse(req: {
  nextUrl: { pathname: string };
  headers: Headers;
}): Response | null {
  return malformedPathResponse(req) ?? malformedFormResponse(req);
}
