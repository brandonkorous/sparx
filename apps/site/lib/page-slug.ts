// The current storefront path → the page slug the API speaks (docs/115).
//
// Its own module because BOTH runtimes need it and they must agree exactly: the
// legacy builder runtime and the silica behavior runtime each submit a contact form
// with a `pageSlug`, and the server looks the form up on THAT page. Two copies that
// drifted by a leading slash would 404 half the submissions.

/** Home is `null`; every other route is its path with the slashes trimmed
 *  (`/contact` → `contact`, `/about/team` → `about/team`). A form the server can't
 *  find on the page is then looked up in the site frame, so a footer form submits
 *  from any route. */
export function pageSlugFromPath(pathname: string | null): string | null {
  const seg = (pathname ?? '/').replace(/^\/+|\/+$/g, '');
  return seg === '' ? null : seg;
}
