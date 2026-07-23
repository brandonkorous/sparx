// The `site.legal-links` host core (docs/122) — the tenant's PUBLISHED legal
// documents, rendered live into a silica-framed footer.
//
// The default storefront footer already does this: `getLegalFooterLinks` reads the
// doc placements (docs/42 §5) and appends a "Legal" column only when something is
// published. A silica frame bypasses that footer entirely, so it needs the same
// behaviour as a mountable core — otherwise the starter has to hardcode
// `/privacy-policy` + `/terms-of-service`, which is what it used to do and what
// 404'd on every site whose owner hadn't written them yet.
//
// Renders NOTHING (heading included) when there are no placements. An empty "Legal"
// heading is worse than no column: it advertises a section that isn't there.
//
// A server component — the links are already resolved by the layout, so there is no
// client state here and nothing to hydrate.

export interface LegalFooterLink {
  label: string;
  href: string;
}

export function LegalFooterLinks({
  links,
  heading,
}: {
  links: LegalFooterLink[];
  /** The column title. Blank (the author cleared it in the Inspector) renders the
   *  links bare — for a bottom bar or a copyright row, where a heading is wrong. */
  heading?: string;
}) {
  if (links.length === 0) return null;
  return (
    <>
      {heading ? <h3 className="text-base-content text-sm font-semibold">{heading}</h3> : null}
      {links.map((l) => (
        // The same classes the starter's hand-authored footer columns use
        // (`footerColumn` in @sparx/silica-catalog), so the live column sits flush
        // beside Explore and Account rather than reading as a different component.
        <a
          key={l.href}
          href={l.href}
          className="text-base-content hover:text-base-content text-sm transition-colors"
        >
          {l.label}
        </a>
      ))}
    </>
  );
}

/** Narrow the author's Inspector value for the `heading` prop. Anything non-string
 *  falls back to the registered default; an empty string is a deliberate "no heading"
 *  and is preserved. */
export function toLegalHeading(value: unknown): string {
  return typeof value === 'string' ? value : 'Legal';
}
