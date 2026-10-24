// A catch-all slug no tenant page can own, answered not-found before any api-rest call.
// Missed `/_next/static/…` chunks skip the proxy and landed here; api-rest refused their
// long slugs with VALIDATION_ERROR and the page 500'd (WW-3).

/** The longest slug any page lookup accepts (a CMS entry's, 255); builder pages stop at 160. */
export const MAX_PAGE_SLUG = 255;

/** Why this slug cannot be a page, or null when it might be one. */
export function unservableSlug(slug: string): 'asset' | 'too-long' | null {
  if (slug === '_next' || slug.startsWith('_next/')) return 'asset';
  return slug.length > MAX_PAGE_SLUG ? 'too-long' : null;
}

/** The joined slug, or null when a segment is a broken escape no page can have. */
export function joinSlug(parts: string[]): string | null {
  try {
    return parts.map((p) => decodeURIComponent(p)).join('/');
  } catch {
    return null;
  }
}
