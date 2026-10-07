/**
 * A site handle without the business's own name in front of it (persona issue 927).
 *
 * A site's address is `<handle>.<business>.<zone>`, so a site called "Juniper Row
 * Lookbook" was offered `juniper-row-lookbook.juniper-row.piggles.site`, the
 * business named twice, on the one field that can never be changed afterwards.
 * Only ever applied to a handle derived from the name: one somebody typed is theirs.
 * Left whole when nothing would be left, or when what is left is reserved.
 */
export function withoutBusinessName(handle: string, businessSlug: string): string {
  const prefix = `${businessSlug}-`;
  if (!handle.startsWith(prefix)) return handle;
  const rest = handle.slice(prefix.length);
  return rest === '' || rest === 'primary' ? handle : rest;
}
