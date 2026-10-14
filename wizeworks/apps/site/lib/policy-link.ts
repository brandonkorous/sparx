// The shop's own returns policy, from the legal pages it has published (sparx
// persona issue 210). The return pages linked to "/returns-policy", the template's
// default address, and a shop that published its policy anywhere else (Gillett's
// is "/refund-policy") sent the buyer to a page that does not exist.

/** One published legal page, as the placements read gives it. */
export interface PolicyLink {
  href: string;
  legalKind: string | null;
}

/** The returns policy's address, or the refund policy's when there is no
 *  returns policy. Null when the shop has published neither: then no link. */
export function returnsPolicyLink(links: readonly PolicyLink[]): string | null {
  return (
    links.find((l) => l.legalKind === 'returns')?.href ??
    links.find((l) => l.legalKind === 'refund')?.href ??
    null
  );
}
