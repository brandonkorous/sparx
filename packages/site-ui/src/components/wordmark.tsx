// Wordmark — the brand lockup: the logo mark + the company name as a single
// linked unit (docs/46 §5.2). COMPOSITE (docs/23 §17) of the mark image + a name
// span — the prebuilt counterpart to the bare `Logo`, which renders mark-OR-name
// but never both.
//
// Responsive via the nearest `sf-frame` container query (the Builder render frame
// — `.bx-render` live, `.bx-canvas` in the editor), so it collapses at the
// SIMULATED device width in the canvas preview, not only the real viewport
// (docs/62, wordmark.css). `collapse` picks what survives a narrow frame:
//   · 'mark' (default) — hide the name, keep the mark (the common header pattern)
//   · 'name'           — hide the mark, keep the name
//   · 'none'           — always show both
//
// Degrades gracefully: with only a mark it shows the mark; with only a name (or
// neither) it shows the name, falling back to "Brand" like `Logo` — and
// `collapse` is ignored when only one part exists (nothing to hide).
//
// SERVER component. Links to `href` (default `/`), like `Logo`.

import * as React from 'react';
import { cx } from '../utils/cx';

export type WordmarkCollapse = 'mark' | 'name' | 'none';

export interface WordmarkProps {
  name?: string;
  src?: string;
  alt?: string;
  href?: string;
  /** What remains on a narrow frame. Defaults to `mark`. */
  collapse?: WordmarkCollapse;
  className?: string;
  style?: React.CSSProperties;
}

export function Wordmark({
  name,
  src,
  alt,
  href = '/',
  collapse = 'mark',
  className,
  style,
}: WordmarkProps) {
  const hasMark = Boolean(src);
  const hasName = name !== undefined && name.trim().length > 0;
  // Show the name when there is one, or as the "Brand" fallback when there's no
  // mark to stand in for it (parity with Logo's fallback).
  const showName = hasName || !hasMark;
  const label = hasName ? name : 'Brand';
  // Only collapse when BOTH parts exist — otherwise there's nothing to hide.
  const dataCollapse: WordmarkCollapse = hasMark && hasName ? collapse : 'none';

  return (
    <a
      href={href}
      className={cx('sf-wordmark', className)}
      data-collapse={dataCollapse}
      style={style}
    >
      {hasMark ? <img src={src} alt={alt ?? name ?? ''} className="sf-wordmark__mark" /> : null}
      {showName ? <span className="sf-wordmark__name">{label}</span> : null}
    </a>
  );
}
Wordmark.displayName = 'Wordmark';
