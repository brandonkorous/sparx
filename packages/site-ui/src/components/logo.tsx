// Logo — the site identity: a logo image, or the brand name as a wordmark
// fallback (docs/46 §5.2). SERVER component. Harvested from the storefront
// renderer's Logo leaf. Links to `href` (default `/`).

import * as React from 'react';
import { cx } from '../utils/cx';

export interface LogoProps {
  name?: string;
  src?: string;
  alt?: string;
  href?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Logo({ name, src, alt, href = '/', className, style }: LogoProps) {
  // Fall back to "Brand" for an absent OR empty name (parity with the renderer's
  // `name || 'Brand'`), written so it isn't the `a ? a : b` shape the
  // prefer-nullish-coalescing rule rewrites.
  const label = name && name.length > 0 ? name : 'Brand';
  return (
    <a href={href} className={cx('sf-logo', className)} style={style}>
      {src ? (
        <img src={src} alt={alt ?? name ?? ''} className="sf-logo__img" />
      ) : (
        <span className="sf-logo__name">{label}</span>
      )}
    </a>
  );
}
Logo.displayName = 'Logo';
