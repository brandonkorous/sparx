// SiteLogo / SiteWordmark — the TENANT's identity in their own site header.
//
// Not silica's `Wordmark`, which renders a typographic brand name in silica's own
// lockup. This is the site owner's mark: an uploaded logo image, their business
// name, or both as one linked unit — resolved from the site's Identity binding,
// so it is data, not design. That is the gap these fill (root CLAUDE.md RULE #1).
//
// `SiteWordmark` collapses on a narrow FRAME (the `bx-frame` container query), so
// the canvas preview collapses it at the simulated device width, not just at the
// real viewport. `collapse` picks what survives:
//   · 'mark' (default) — hide the name, keep the mark (the common header pattern)
//   · 'name'           — hide the mark, keep the name
//   · 'none'           — always show both
//
// Both degrade: with only a mark they show the mark; with only a name (or
// neither) they show the name, falling back to "Brand" so a header is never
// empty. `collapse` is ignored when only one part exists — nothing to hide.
//
// SERVER components.

import * as React from 'react';
import { cx } from '@wizeworks/silicaui-react/server';

const WIDE = '@3xl/bx-frame';

export interface SiteLogoProps {
  name?: string;
  src?: string;
  alt?: string;
  href?: string;
  className?: string;
}

/** Mark OR name — never both. The bare identity link. */
export function SiteLogo({
  name,
  src,
  alt,
  href = '/',
  className,
}: SiteLogoProps): React.ReactElement {
  // Written as a length check rather than `name || 'Brand'` so the
  // prefer-nullish-coalescing rule doesn't rewrite it into something that lets
  // an empty string through.
  const label = name && name.length > 0 ? name : 'Brand';
  return (
    <a href={href} className={cx('inline-flex items-center gap-2 no-underline', className)}>
      {src ? (
        <img src={src} alt={alt ?? name ?? ''} className="block max-h-10 w-auto" />
      ) : (
        <span className="font-head text-xl font-semibold">{label}</span>
      )}
    </a>
  );
}
SiteLogo.displayName = 'SiteLogo';

export type WordmarkCollapse = 'mark' | 'name' | 'none';

export interface SiteWordmarkProps {
  name?: string;
  src?: string;
  alt?: string;
  href?: string;
  /** What remains on a narrow frame. Defaults to `mark`. */
  collapse?: WordmarkCollapse;
  className?: string;
}

/** Mark AND name as one linked lockup — the prebuilt counterpart to SiteLogo. */
export function SiteWordmark({
  name,
  src,
  alt,
  href = '/',
  collapse = 'mark',
  className,
}: SiteWordmarkProps): React.ReactElement {
  const hasMark = Boolean(src);
  const hasName = name !== undefined && name.trim().length > 0;
  // Show the name when there is one, or as the "Brand" fallback when there's no
  // mark to stand in for it.
  const showName = hasName || !hasMark;
  const label = hasName ? name : 'Brand';
  // Only collapse when BOTH parts exist — otherwise there is nothing to hide.
  const collapsing = hasMark && hasName ? collapse : 'none';

  return (
    <a href={href} className={cx('inline-flex items-center gap-2.5 no-underline', className)}>
      {hasMark ? (
        <img
          src={src}
          alt={alt ?? name ?? ''}
          className={cx('block max-h-10 w-auto', collapsing === 'name' && `hidden ${WIDE}:block`)}
        />
      ) : null}
      {showName ? (
        <span
          className={cx(
            'font-head text-xl font-semibold',
            collapsing === 'mark' && `hidden ${WIDE}:inline`
          )}
        >
          {label}
        </span>
      ) : null}
    </a>
  );
}
SiteWordmark.displayName = 'SiteWordmark';
