import * as React from 'react';
import { Img } from '@react-email/components';
import { useBrand } from './brand';

// EmailWordmark — the email header brand mark (docs/52 §1). Now an author-editable
// node (`email_wordmark`) at the top of the body tree rather than fixed frame
// chrome, it resolves its CONTENT from the active brand and its TREATMENT from the
// node's props:
//   • 'lockup' (default) — the logo AND the store name side by side: the brand
//     lockup, parity with the site header's <Wordmark> (packages/site-ui),
//   • 'logo'             — the logo alone (for logos that already bake in the name),
//   • 'name'             — the store/site name alone (the "spar<x>" mark when the
//                          brand is the sparx fallback).
// Each treatment DEGRADES gracefully when its part is missing (logo with no logo →
// name; lockup with only one part → that part; neither → the sparx default).
//
// Mail clients strip <style> blocks and don't honour CSS variables, so every value
// is inlined; brand colors/fonts come from the BrandContext.

export type WordmarkTreatment = 'lockup' | 'logo' | 'name';

export interface EmailWordmarkProps {
  /** Logo height + name font scale from this px size. Default 22. */
  size?: number;
  /** What the header shows; see the file header. Default the brand lockup. */
  treatment?: WordmarkTreatment;
  /** Horizontal alignment. Default left. */
  align?: 'left' | 'center';
}

export function EmailWordmark({
  size = 22,
  treatment = 'lockup',
  align = 'left',
}: EmailWordmarkProps) {
  const brand = useBrand();
  const logoUrl = brand.logoUrl;
  const hasLogo = Boolean(logoUrl);
  // "A name the TENANT chose", not "a name that isn't sparx". This compared
  // against the literal `'sparx'` until 2026-08-16, which made one brand's name
  // the definition of "unbranded" — so a Piggles tenant's platform email put
  // "sparx" beside their logo, and no amount of configuring Piggles could have
  // stopped it. The flag says what was actually meant, and the send that builds
  // the fallback is what sets it.
  const hasName = Boolean(brand.siteName) && !brand.siteNameIsPlatformDefault;

  // Which parts the treatment asks for, then a name fallback so the header is never
  // empty (a logo-only treatment with no logo, etc. → the name / sparx default).
  const wantLogo = treatment !== 'name' && hasLogo;
  const wantName = treatment !== 'logo' && hasName;
  const showLogo = wantLogo;
  const showName = wantName || !wantLogo;

  const nameStyle: React.CSSProperties = {
    fontFamily: brand.fontHeading,
    fontSize: size,
    fontWeight: 500,
    letterSpacing: '-0.03em',
    lineHeight: 1,
    color: brand.foreground,
    verticalAlign: 'middle',
  };

  const nameNode = hasName ? (
    <span style={nameStyle}>{brand.siteName}</span>
  ) : (
    <span style={nameStyle}>
      spar<span style={{ color: brand.primary }}>x</span>
    </span>
  );

  return (
    <div style={{ textAlign: align }}>
      {showLogo && logoUrl ? (
        <Img
          src={logoUrl}
          alt={brand.siteName ?? 'Logo'}
          height={Math.round(size * 1.4)}
          style={{
            display: 'inline-block',
            verticalAlign: 'middle',
            width: 'auto',
            maxHeight: Math.round(size * 1.6),
            ...(showName ? { marginRight: 8 } : {}),
          }}
        />
      ) : null}
      {showName ? nameNode : null}
    </div>
  );
}
